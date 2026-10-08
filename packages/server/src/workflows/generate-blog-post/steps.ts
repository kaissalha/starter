import { and, eq } from "drizzle-orm";
import { getWorkflowMetadata } from "workflow";
import type { z } from "zod";

import {
	createEmptyBlogPostDocument,
	getBlogTranslationSource,
	type BlogPostDocument,
	type Iso6391LanguageCode,
} from "@starter/infinite-website/contracts";

import type { blogGenerationLocaleSchema, blogGenerationSchema } from "../../ai/prompts";
import type { StockImageCandidate } from "../../lib/stock-images";

export type BlogGenerationInput = {
	initialDraft?: boolean;
	instructions: string;
	locale?: Iso6391LanguageCode;
	organizationId: string;
	postId: string;
	token: string;
	topic: string;
};

const findBlogCoverCandidate = async (topic: string) => {
	try {
		const { searchStockImages } = await import("../../lib/stock-images");
		const { chooseStockImageCandidate } = await import("../../services/stock-image-choice");
		const { items } = await searchStockImages({ orientation: "landscape", query: topic });

		const chosen = await chooseStockImageCandidate({
			candidates: items,
			functionId: "blog-cover-image-selection",
			policy: "background",
			purpose: `Blog article cover image about: ${topic}`,
			query: topic,
		});

		return chosen ?? items[0];
	} catch {
		return undefined;
	}
};

const listBlogArabicFields = (ar: z.infer<typeof blogGenerationLocaleSchema>) => [
	{ path: "/ar/title", value: ar.title },
	{ path: "/ar/excerpt", value: ar.excerpt },
	{ path: "/ar/seoTitle", value: ar.seoTitle },
	{ path: "/ar/seoDescription", value: ar.seoDescription },
	{ path: "/ar/coverAlt", value: ar.coverAlt },
	...ar.paragraphs.map((value, index) => ({ path: `/ar/paragraphs/${index}`, value })),
];

const reviewBlogArabic = async ({
	businessName,
	output,
	prompt,
	repairAttempt = false,
}: {
	businessName: string;
	output: z.infer<typeof blogGenerationSchema>;
	prompt: string;
	repairAttempt?: boolean;
}): Promise<z.infer<typeof blogGenerationSchema>> => {
	const { evaluateDecision } = await import("../../ai/decisions");

	const { blogGenerationPrompt, blogGenerationSchema, createWebsiteArabicLocalizationEvaluation } =
		await import("../../ai/prompts");

	const { log } = await import("@starter/observability");
	const { models } = await import("../../mastra/models");
	const { generateText, Output } = await import("ai");

	const decision = await evaluateDecision({
		functionId: "blog-arabic-localization-evaluation",
		memoize: true,
		policy: "background",
		...createWebsiteArabicLocalizationEvaluation({ businessName, fields: listBlogArabicFields(output.ar) }),
	});

	const verdict = decision?.answers.verdict;
	const accepted = verdict?.choice === "acceptable" && (verdict.probabilities?.acceptable ?? 0) >= 0.85;
	await log.info({
		accepted,
		functionId: "blog-arabic-localization-evaluation",
		message: "Blog Arabic localization review completed",
		verdict: verdict?.choice,
	});

	if (accepted) {
		return output;
	}

	if (repairAttempt) {
		throw new Error("Blog Arabic localization repair did not pass review");
	}

	if (!verdict) {
		throw new Error("Blog Arabic localization review is unavailable");
	}

	const repaired = await generateText({
		abortSignal: AbortSignal.timeout(180_000),
		maxRetries: 1,
		model: models.cheapFast.model,
		output: Output.object({ schema: blogGenerationSchema }),
		prompt: `${prompt}\n<untrusted-previous-draft>${JSON.stringify(output)}</untrusted-previous-draft>\nThe Arabic fields of the previous draft were rejected with issue code "${verdict.choice}". Rewrite every Arabic field as natural, clear Arabic for the same article while preserving the English fields unchanged.`,
		providerOptions: models.cheapFast.providerOptions,
		system: blogGenerationPrompt,
	});

	if (JSON.stringify(repaired.output.en) !== JSON.stringify(output.en)) {
		throw new Error("Blog Arabic localization repair changed the English draft");
	}

	return reviewBlogArabic({ businessName, output: repaired.output, prompt, repairAttempt: true });
};

const resolveBlogCoverImage = async ({
	candidate,
	organizationId,
	topic,
}: {
	candidate?: StockImageCandidate;
	organizationId: string;
	topic: string;
}) => {
	try {
		if (!candidate) {
			return null;
		}

		const { bindStockImageCandidate } = await import("../../lib/stock-images");
		const { createFile, findFileByUrl } = await import("../../services/storage");
		const image = await bindStockImageCandidate({ candidate });

		if (!(await findFileByUrl({ organizationId, url: image.src }))) {
			await createFile({
				access: "public",
				contentType: "image/jpeg",
				kind: "image",
				metadata: { height: image.height, width: image.width },
				name: topic,
				organizationId,
				sourceType: "url",
				url: image.src,
			});
		}

		return { src: image.src };
	} catch {
		return null;
	}
};

export const prepareInitialBlogDraft = async (input: BlogGenerationInput) => {
	"use step";
	const { blogPosts, db } = await import("@starter/db");
	const { readBlogPost } = await import("../../services/blog-posts/access");
	const { workflowRunId } = getWorkflowMetadata();
	await db
		.insert(blogPosts)
		.values({
			document: createEmptyBlogPostDocument(),
			generationRunId: workflowRunId,
			generationStatus: "writing",
			generationToken: input.token,
			id: input.postId,
			organizationId: input.organizationId,
			slug: `post-${input.postId}`,
		})
		.onConflictDoNothing();
	const post = await readBlogPost(input);

	return post.generationRunId === workflowRunId && post.generationToken === input.token;
};

export const generateBlogDraft = async (input: BlogGenerationInput) => {
	"use step";
	const { db, organizations, websites } = await import("@starter/db");
	const { readBlogPost } = await import("../../services/blog-posts/access");
	const { projectBlogGenerationLocale, streamBlogDraft } = await import("./stream");
	const post = await readBlogPost(input);

	if (post.generationToken !== input.token || post.generationStatus !== "writing") {
		return null;
	}

	const [organization] = await db
		.select({ brief: websites.brief, name: organizations.name })
		.from(organizations)
		.leftJoin(websites, eq(websites.organizationId, organizations.id))
		.where(eq(organizations.id, input.organizationId))
		.limit(1);

	const prompt = `${input.locale ? `Translate the source article faithfully to ${input.locale}.` : `Topic: ${input.topic}\nInstructions: ${input.instructions}`}\n<untrusted-data>${JSON.stringify({ organization, source: input.locale ? getBlogTranslationSource(post.document) : undefined })}</untrusted-data>`;

	if (input.locale) {
		return (await streamBlogDraft({ document: post.document, locale: input.locale, prompt })).document;
	}

	const [result, candidate] = await Promise.all([
		streamBlogDraft({ document: post.document, prompt }),
		post.document.coverImage ? Promise.resolve(undefined) : findBlogCoverCandidate(input.topic),
	]);

	if (!result.output) {
		return result.document;
	}

	const coverImage =
		post.document.coverImage ??
		(await resolveBlogCoverImage({ candidate, organizationId: input.organizationId, topic: input.topic }));

	const output = await reviewBlogArabic({ businessName: organization?.name ?? "", output: result.output, prompt });

	return {
		...post.document,
		ar: projectBlogGenerationLocale(output.ar),
		coverImage,
		en: projectBlogGenerationLocale(output.en),
	} satisfies BlogPostDocument;
};

export const completeBlogDraft = async ({
	document,
	input,
}: {
	document: BlogPostDocument;
	input: BlogGenerationInput;
}) => {
	"use step";
	const { saveGeneratedBlogPost } = await import("../../services/blog-posts/service");
	const { closeBlogGenerationStream } = await import("./stream");
	await saveGeneratedBlogPost({ ...input, document });
	await closeBlogGenerationStream();
};

export const failBlogDraft = async (input: BlogGenerationInput, cause?: string) => {
	"use step";

	if (cause) {
		const { log } = await import("@starter/observability");
		log.error({
			cause,
			message: "Blog generation failed",
			organizationId: input.organizationId,
			postId: input.postId,
		});
	}

	const { blogPosts, db } = await import("@starter/db");
	const { closeBlogGenerationStream } = await import("./stream");
	await db
		.update(blogPosts)
		.set({
			generationError: "Blog generation failed. Please try again.",
			generationRunId: null,
			generationStatus: "failed",
			generationToken: null,
			updatedAt: new Date().toISOString(),
		})
		.where(
			and(
				eq(blogPosts.id, input.postId),
				eq(blogPosts.organizationId, input.organizationId),
				eq(blogPosts.generationToken, input.token)
			)
		);
	await closeBlogGenerationStream();
};
