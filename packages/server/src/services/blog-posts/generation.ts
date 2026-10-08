import { and, eq, sql } from "drizzle-orm";
import { start } from "workflow/api";
import { z } from "zod";

import { blogPosts, db } from "@starter/db";
import type { Iso6391LanguageCode } from "@starter/infinite-website/contracts";
import {
	createEmptyBlogPostDocument,
	getBlogLocaleContent,
	getBlogTranslationSource,
} from "@starter/infinite-website/contracts";

import { generateBlogPostWorkflow } from "../../workflows/generate-blog-post";
import type { BlogGenerationInput } from "../../workflows/generate-blog-post/steps";
import { projectBlogPost, readBlogPost, requireBlogMember, requireBlogRevision } from "./access";
import {
	blogPostGenerateNewSchema,
	blogPostGenerateSchema,
	blogPostTranslateSchema,
	BlogPostError,
	type BlogActor,
} from "./contracts";
import { cancelBlogWorkflowRun, createBlogPost, getBlogPost } from "./service";

const startBlogGeneration = async ({
	actor,
	input,
}: {
	actor: BlogActor;
	input: { instructions: string; locale?: Iso6391LanguageCode; postId: string; revision: number; topic: string };
}) => {
	const token = crypto.randomUUID();
	await db.transaction(async (transaction) => {
		await requireBlogMember({ actor, permission: "write", transaction });
		const post = await readBlogPost({ organizationId: actor.organizationId, postId: input.postId, transaction });
		requireBlogRevision({ post, revision: input.revision });

		if (post.generationStatus === "writing") {
			throw new BlogPostError("CONFLICT", "This post is already being written.");
		}

		if (input.locale) {
			const target = getBlogLocaleContent({ document: post.document, locale: input.locale });
			const source = getBlogTranslationSource(post.document);

			if (
				target.title.trim() ||
				target.excerpt.trim() ||
				target.seoTitle.trim() ||
				target.seoDescription.trim() ||
				target.coverAlt.trim() ||
				target.body.content.some((node) => node.type !== "paragraph" || (node.content?.length ?? 0) > 0)
			) {
				throw new BlogPostError(
					"BAD_REQUEST",
					"Translation requires an empty target language. Clear it explicitly before replacing it."
				);
			}

			if (!source) {
				throw new BlogPostError("BAD_REQUEST", "Write a source title and article before translating.");
			}
		}

		const [claimed] = await transaction
			.update(blogPosts)
			.set({
				generationError: null,
				generationRunId: null,
				generationStatus: "writing",
				generationToken: token,
				revision: sql`${blogPosts.revision} + 1`,
				updatedAt: new Date().toISOString(),
			})
			.where(
				and(
					eq(blogPosts.id, input.postId),
					eq(blogPosts.organizationId, actor.organizationId),
					eq(blogPosts.revision, input.revision)
				)
			)
			.returning();

		if (!claimed) {
			throw new BlogPostError("CONFLICT", "The post changed elsewhere.");
		}
	});

	const workflowInput: BlogGenerationInput = {
		instructions: input.instructions,
		organizationId: actor.organizationId,
		postId: input.postId,
		token,
		topic: input.topic,
	};

	if (input.locale) {
		workflowInput.locale = input.locale;
	}

	try {
		const run = await start(generateBlogPostWorkflow, [workflowInput]);

		const [bound] = await db
			.update(blogPosts)
			.set({ generationRunId: run.runId })
			.where(
				and(
					eq(blogPosts.id, input.postId),
					eq(blogPosts.organizationId, actor.organizationId),
					eq(blogPosts.generationToken, token)
				)
			)
			.returning({ id: blogPosts.id });

		if (!bound) {
			await cancelBlogWorkflowRun(run.runId);
		}
	} catch (error) {
		await db
			.update(blogPosts)
			.set({
				generationError: "Blog generation could not start. Please try again.",
				generationStatus: "failed",
				generationToken: null,
			})
			.where(
				and(
					eq(blogPosts.id, input.postId),
					eq(blogPosts.organizationId, actor.organizationId),
					eq(blogPosts.generationToken, token)
				)
			);
		throw error;
	}

	return projectBlogPost(await readBlogPost({ organizationId: actor.organizationId, postId: input.postId }));
};

export const generateBlogPost = ({
	actor,
	input,
}: {
	actor: BlogActor;
	input: z.input<typeof blogPostGenerateSchema>;
}) => startBlogGeneration({ actor, input: blogPostGenerateSchema.parse(input) });

export const translateBlogPost = ({
	actor,
	input,
}: {
	actor: BlogActor;
	input: z.input<typeof blogPostTranslateSchema>;
}) => startBlogGeneration({ actor, input: { ...blogPostTranslateSchema.parse(input), instructions: "", topic: "" } });

export const generateNewBlogPost = async ({
	actor,
	input,
}: {
	actor: BlogActor;
	input: z.input<typeof blogPostGenerateNewSchema>;
}) => {
	const { instructions, topic } = blogPostGenerateNewSchema.parse(input);
	const document = createEmptyBlogPostDocument();
	document.en.title = topic.slice(0, 200);
	const post = await createBlogPost({ actor, input: { document } });

	return startBlogGeneration({ actor, input: { instructions, postId: post.id, revision: post.revision, topic } });
};

export const getBlogPostGenerationStatus = async ({ actor, postId }: { actor: BlogActor; postId: string }) => {
	const { generationError, generationRunId, generationStatus, id, revision, updatedAt } = await getBlogPost({
		actor,
		postId,
	});

	return { generationError, generationRunId, generationStatus, id, revision, updatedAt };
};
