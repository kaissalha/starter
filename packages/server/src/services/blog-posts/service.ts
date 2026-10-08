import { and, count, desc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { getRun } from "workflow/api";
import { z } from "zod";

import { blogPosts, db, type BlogPostRecord, type Transaction } from "@starter/db";
import {
	blogPostDocumentSchema,
	blogPublishDocumentSchema,
	createEmptyBlogPostDocument,
} from "@starter/infinite-website/contracts";

import {
	projectBlogPost,
	readBlogPost,
	requireBlogMember,
	requireBlogRevision,
	translateBlogDatabaseError,
	validateBlogMedia,
} from "./access";
import {
	blogPostCreateSchema,
	blogPostListInputSchema,
	blogPostRevisionSchema,
	blogPostUpdateSchema,
	blogSlugSchema,
	BlogPostError,
	type BlogActor,
} from "./contracts";

const reconcileBlogWorkflow = async (post: BlogPostRecord) => {
	if (post.generationStatus !== "writing") {
		return post;
	}

	if (!post.generationRunId && Date.now() - Date.parse(post.updatedAt) < 300_000) {
		return post;
	}

	if (post.generationRunId) {
		const run = getRun(post.generationRunId);

		if ((await run.exists) && ["pending", "running"].includes(await run.status)) {
			return post;
		}
	}

	const [failed] = await db
		.update(blogPosts)
		.set({
			generationError: "Generation stopped before the draft was saved. Please try again.",
			generationRunId: null,
			generationStatus: "failed",
			generationToken: null,
		})
		.where(
			and(
				eq(blogPosts.id, post.id),
				eq(blogPosts.organizationId, post.organizationId),
				eq(blogPosts.revision, post.revision),
				eq(blogPosts.generationStatus, "writing")
			)
		)
		.returning();

	return failed ?? post;
};

export const cancelBlogWorkflowRun = async (runId: string | null) => {
	if (!runId) {
		return;
	}

	try {
		const run = getRun(runId);

		if (await run.exists) {
			await run.cancel({ cancelReason: "Blog generation cancelled by its owner" });
		}
	} catch {}
};

export const listBlogPosts = async ({
	actor,
	input,
}: {
	actor: BlogActor;
	input: z.input<typeof blogPostListInputSchema>;
}) => {
	await requireBlogMember({ actor });
	const { page, pageSize, search, status } = blogPostListInputSchema.parse(input);

	const condition = and(
		eq(blogPosts.organizationId, actor.organizationId),
		search
			? sql`position(lower(${search}) in lower((${blogPosts.document}->'en'->>'title') || ' ' || (${blogPosts.document}->'ar'->>'title'))) > 0`
			: undefined,
		status === "published" ? isNotNull(blogPosts.publishedDocument) : undefined,
		status === "draft" ? isNull(blogPosts.publishedDocument) : undefined,
		status === "writing" || status === "failed" ? eq(blogPosts.generationStatus, status) : undefined
	);

	const [data, totals] = await Promise.all([
		db
			.select()
			.from(blogPosts)
			.where(condition)
			.orderBy(desc(status === "published" ? blogPosts.publishedAt : blogPosts.createdAt), desc(blogPosts.id))
			.limit(pageSize)
			.offset((page - 1) * pageSize),
		db.select({ total: count() }).from(blogPosts).where(condition),
	]);

	return {
		data: (await Promise.all(data.map(reconcileBlogWorkflow))).map(projectBlogPost),
		page,
		pageSize,
		total: totals[0]?.total ?? 0,
	};
};

export const getBlogPost = async ({ actor, postId }: { actor: BlogActor; postId: string }) => {
	await requireBlogMember({ actor });

	return projectBlogPost(
		await reconcileBlogWorkflow(await readBlogPost({ organizationId: actor.organizationId, postId }))
	);
};

export const createBlogPost = async ({
	actor,
	input,
}: {
	actor: BlogActor;
	input: z.input<typeof blogPostCreateSchema>;
}) => {
	const parsed = blogPostCreateSchema.parse(input);

	return db.transaction(async (transaction) => {
		await requireBlogMember({ actor, permission: "write", transaction });
		const document = parsed.document ?? createEmptyBlogPostDocument();
		await validateBlogMedia({ document, organizationId: actor.organizationId, transaction });

		const [post] = await transaction
			.insert(blogPosts)
			.values({
				document,
				organizationId: actor.organizationId,
				slug: parsed.slug ?? `post-${crypto.randomUUID()}`,
			})
			.onConflictDoNothing()
			.returning();

		if (!post) {
			throw new BlogPostError("CONFLICT", "A post with this slug already exists.");
		}

		return projectBlogPost(post);
	});
};

const mutateBlogPost = async ({
	actor,
	input,
	mutate,
	permission = "write",
}: {
	actor: BlogActor;
	input: z.input<typeof blogPostRevisionSchema>;
	mutate: (post: BlogPostRecord, transaction: Transaction) => Promise<Partial<BlogPostRecord>>;
	permission?: "write" | "delete";
}) => {
	const { postId, revision } = blogPostRevisionSchema.parse(input);

	try {
		return await db.transaction(async (transaction) => {
			await requireBlogMember({ actor, permission, transaction });
			const post = await readBlogPost({ organizationId: actor.organizationId, postId, transaction });
			requireBlogRevision({ post, revision });
			const changes = await mutate(post, transaction);

			const [saved] = await transaction
				.update(blogPosts)
				.set({ ...changes, revision: revision + 1, updatedAt: new Date().toISOString() })
				.where(
					and(
						eq(blogPosts.id, postId),
						eq(blogPosts.organizationId, actor.organizationId),
						eq(blogPosts.revision, revision)
					)
				)
				.returning();

			if (!saved) {
				throw new BlogPostError("CONFLICT", "The post changed elsewhere. Reload before saving.");
			}

			return projectBlogPost(saved);
		});
	} catch (error) {
		if (error instanceof Error) {
			translateBlogDatabaseError(error);
		}

		throw error;
	}
};

export const updateBlogPost = async ({
	actor,
	input,
}: {
	actor: BlogActor;
	input: z.input<typeof blogPostUpdateSchema>;
}) => {
	const parsed = blogPostUpdateSchema.parse(input);
	const staleRunIds: Array<string | null> = [];

	const saved = await mutateBlogPost({
		actor,
		input: { postId: parsed.postId, revision: parsed.revision },
		mutate: async (post, transaction) => {
			if (post.firstPublishedAt && post.slug !== parsed.slug) {
				throw new BlogPostError("BAD_REQUEST", "The slug cannot change after first publication.");
			}

			await validateBlogMedia({ document: parsed.document, organizationId: actor.organizationId, transaction });
			staleRunIds.push(post.generationStatus === "writing" ? post.generationRunId : null);

			return {
				document: parsed.document,
				generationError: null,
				generationRunId: null,
				generationStatus: "idle",
				generationToken: null,
				slug: parsed.slug,
			};
		},
	});

	await Promise.all(staleRunIds.map(cancelBlogWorkflowRun));

	return saved;
};

export const publishBlogPost = ({
	actor,
	input,
}: {
	actor: BlogActor;
	input: z.input<typeof blogPostRevisionSchema>;
}) =>
	mutateBlogPost({
		actor,
		input,
		mutate: async (post, transaction) => {
			if (post.generationStatus === "writing") {
				throw new BlogPostError("CONFLICT", "Wait for generation to finish before publishing.");
			}

			const parsed = blogPublishDocumentSchema.safeParse(post.document);

			if (!parsed.success) {
				throw new BlogPostError(
					"BAD_REQUEST",
					"A title and article body in both English and Arabic are required before publication."
				);
			}

			await validateBlogMedia({ document: parsed.data, organizationId: actor.organizationId, transaction });

			const base = parsed.data.en.title
				.normalize("NFKD")
				.replaceAll(/\p{M}/gu, "")
				.toLowerCase()
				.replaceAll(/[^a-z\d]+/gu, "-")
				.replaceAll(/^-+|-+$/gu, "")
				.slice(0, 80)
				.replace(/-+$/u, "");

			const candidates =
				base &&
				post.firstPublishedAt === null &&
				/^post-[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/u.test(post.slug)
					? [base, ...[2, 3, 4, 5, 6, 7, 8, 9].map((suffix) => `${base}-${suffix}`)]
					: [];

			const taken = new Set(
				candidates.length === 0
					? []
					: (
							await transaction
								.select({ slug: blogPosts.slug })
								.from(blogPosts)
								.where(
									and(
										eq(blogPosts.organizationId, actor.organizationId),
										inArray(blogPosts.slug, candidates),
										ne(blogPosts.id, post.id)
									)
								)
						).map(({ slug }) => slug)
			);

			const now = new Date().toISOString();

			return {
				firstPublishedAt: post.firstPublishedAt ?? now,
				publishedAt: post.publishedAt ?? post.firstPublishedAt ?? now,
				publishedDocument: parsed.data,
				publishedRevision: post.revision + 1,
				publishedUpdatedAt: now,
				slug:
					candidates.length === 0
						? post.slug
						: blogSlugSchema.parse(
								candidates.find((candidate) => !taken.has(candidate)) ??
									`${base}-${post.id.slice(0, 8)}`
							),
			};
		},
	});

export const unpublishBlogPost = ({
	actor,
	input,
}: {
	actor: BlogActor;
	input: z.input<typeof blogPostRevisionSchema>;
}) =>
	mutateBlogPost({
		actor,
		input,
		mutate: async () => ({ publishedAt: null, publishedDocument: null, publishedRevision: null }),
		permission: "delete",
	});

export const deleteBlogPost = async ({
	actor,
	input,
}: {
	actor: BlogActor;
	input: z.input<typeof blogPostRevisionSchema>;
}) => {
	const { postId, revision } = blogPostRevisionSchema.parse(input);

	const { deleted, staleRunId } = await db.transaction(async (transaction) => {
		await requireBlogMember({ actor, permission: "delete", transaction });
		const post = await readBlogPost({ organizationId: actor.organizationId, postId, transaction });
		requireBlogRevision({ post, revision });

		const [deleted] = await transaction
			.delete(blogPosts)
			.where(
				and(
					eq(blogPosts.organizationId, actor.organizationId),
					eq(blogPosts.id, postId),
					eq(blogPosts.revision, revision)
				)
			)
			.returning({ id: blogPosts.id });

		if (!deleted) {
			throw new BlogPostError("CONFLICT", "The post changed elsewhere.");
		}

		return { deleted, staleRunId: post.generationStatus === "writing" ? post.generationRunId : null };
	});

	await cancelBlogWorkflowRun(staleRunId);

	return deleted;
};

export const cancelBlogPostGeneration = async ({
	actor,
	input,
}: {
	actor: BlogActor;
	input: z.input<typeof blogPostRevisionSchema>;
}) => {
	const current = await getBlogPost({ actor, postId: input.postId });

	const saved = await mutateBlogPost({
		actor,
		input,
		mutate: async () => ({
			generationError: null,
			generationRunId: null,
			generationStatus: "idle",
			generationToken: null,
		}),
	});

	await cancelBlogWorkflowRun(current.generationRunId);

	return saved;
};

export const saveGeneratedBlogPost = async ({
	document,
	organizationId,
	postId,
	token,
}: {
	document: z.input<typeof blogPostDocumentSchema>;
	organizationId: string;
	postId: string;
	token: string;
}) => {
	const validated = blogPostDocumentSchema.parse(document);
	await validateBlogMedia({ document: validated, organizationId });

	const [post] = await db
		.update(blogPosts)
		.set({
			document: validated,
			generationError: null,
			generationRunId: null,
			generationStatus: "idle",
			generationToken: null,
			revision: sql`${blogPosts.revision} + 1`,
			updatedAt: new Date().toISOString(),
		})
		.where(
			and(
				eq(blogPosts.id, postId),
				eq(blogPosts.organizationId, organizationId),
				eq(blogPosts.generationToken, token),
				eq(blogPosts.generationStatus, "writing")
			)
		)
		.returning();

	return post ? projectBlogPost(post) : null;
};
