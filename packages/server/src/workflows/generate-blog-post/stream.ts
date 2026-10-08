import { Output, streamText, type DeepPartial } from "ai";
import { getWritable } from "workflow";
import type { z } from "zod";

import type { Iso6391LanguageCode } from "@starter/infinite-website/contracts";
import { blogPostDocumentSchema, getBlogBodyText, type BlogPostDocument } from "@starter/infinite-website/contracts";

import { blogGenerationLocaleSchema, blogGenerationPrompt, blogGenerationSchema } from "../../ai/prompts";
import { models } from "../../mastra/models";
import type { BlogGenerationPreview } from "../../services/blog-posts/contracts";
import { translateBlogDocument } from "../../services/blog-posts/translation";

export const projectBlogGenerationLocale = (content: DeepPartial<z.infer<typeof blogGenerationLocaleSchema>> = {}) => ({
	body: {
		content: (content.paragraphs?.length ? content.paragraphs : [""]).map((text) => ({
			content: text ? [{ text, type: "text" as const }] : [],
			type: "paragraph" as const,
		})),
		type: "doc" as const,
	},
	coverAlt: content.coverAlt ?? "",
	excerpt: content.excerpt ?? "",
	seoDescription: content.seoDescription ?? "",
	seoTitle: content.seoTitle ?? "",
	title: content.title ?? "",
});

export const streamBlogDraft = async ({
	document,
	locale,
	prompt,
}: {
	document: BlogPostDocument;
	locale?: Iso6391LanguageCode;
	prompt: string;
}) => {
	const writer = getWritable<BlogGenerationPreview>().getWriter();
	const lastEmission = { time: 0 };

	const emit = async (preview: BlogPostDocument) => {
		if (Date.now() - lastEmission.time < 100) {
			return;
		}

		const parsed = blogPostDocumentSchema.safeParse(preview);

		if (parsed.success) {
			await writer.write({
				document: parsed.data,
				locale: locale ?? (parsed.data.en.title || getBlogBodyText(parsed.data.en.body.content) ? "en" : "ar"),
			});
			lastEmission.time = Date.now();
		}
	};

	const options = {
		abortSignal: AbortSignal.timeout(180_000),
		maxRetries: 2,
		model: models.cheapFast.model,
		prompt,
		providerOptions: models.cheapFast.providerOptions,
		system: blogGenerationPrompt,
		telemetry: { functionId: "blog-draft-generation", recordInputs: false, recordOutputs: false },
	};

	try {
		if (locale) {
			const translated = await translateBlogDocument({ document, locale });
			await writer.write({ document: blogPostDocumentSchema.parse(translated), locale });

			return { document: translated, output: null };
		}

		const result = streamText({ ...options, output: Output.object({ schema: blogGenerationSchema }) });

		for await (const partial of result.partialOutputStream) {
			await emit({
				...document,
				ar: projectBlogGenerationLocale(partial.ar),
				en: projectBlogGenerationLocale(partial.en),
			});
		}

		const output = await result.output;

		const generated = {
			...document,
			ar: projectBlogGenerationLocale(output.ar),
			en: projectBlogGenerationLocale(output.en),
		};

		await writer.write({ document: blogPostDocumentSchema.parse(generated), locale: "en" });

		return { document: generated, output };
	} finally {
		writer.releaseLock();
	}
};

export const closeBlogGenerationStream = async () => {
	const writer = getWritable<BlogGenerationPreview>().getWriter();

	try {
		await writer.close();
	} finally {
		writer.releaseLock();
	}
};
