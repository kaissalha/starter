import { z } from "zod";

import { iso6391LanguageCodes, blogPostDocumentSchema } from "@starter/infinite-website/contracts";

export const blogSlugSchema = z
	.string()
	.trim()
	.min(1)
	.max(120)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);

export const blogPostIdSchema = z.strictObject({ postId: z.uuid() }).meta({ id: "BlogPostId" });

export const blogGenerationStreamInputSchema = blogPostIdSchema.extend({
	afterCursor: z.string().regex(/^\d+$/u).optional(),
	runId: z.string().min(1),
});

export const blogGenerationPreviewSchema = z.strictObject({
	document: blogPostDocumentSchema,
	locale: z.enum(iso6391LanguageCodes),
});

export const blogGenerationEnvelopeSchema = blogGenerationPreviewSchema.extend({ cursor: z.string() });

export type BlogGenerationPreview = z.infer<typeof blogGenerationPreviewSchema>;

export const blogPostRevisionSchema = blogPostIdSchema
	.extend({ revision: z.int().positive() })
	.meta({ id: "BlogPostRevision" });

export const blogPostCreateSchema = z
	.strictObject({ document: blogPostDocumentSchema.optional(), slug: blogSlugSchema.optional() })
	.meta({ id: "CreateBlogPost" });

export const blogPostUpdateSchema = blogPostRevisionSchema
	.extend({ document: blogPostDocumentSchema, slug: blogSlugSchema })
	.meta({ id: "UpdateBlogPost" });

export const blogPostGenerateSchema = blogPostRevisionSchema
	.extend({ instructions: z.string().max(4000).default(""), topic: z.string().trim().min(1).max(500) })
	.meta({ id: "GenerateBlogPost" });

export const blogPostGenerateNewSchema = blogPostGenerateSchema
	.omit({ postId: true, revision: true })
	.meta({ id: "GenerateNewBlogPost" });

export const blogPostTranslateSchema = blogPostRevisionSchema
	.extend({ locale: z.enum(iso6391LanguageCodes) })
	.meta({ id: "TranslateBlogPost" });

export const blogPostListInputSchema = z
	.strictObject({
		page: z.int().min(1).max(100_000).default(1),
		pageSize: z.int().min(1).max(100).default(20),
		search: z.string().trim().max(200).default(""),
		status: z.enum(["all", "draft", "published", "writing", "failed"]).default("all"),
	})
	.meta({ id: "ListBlogPostsInput" });

export const blogPostSchema = z
	.strictObject({
		createdAt: z.string(),
		document: blogPostDocumentSchema,
		firstPublishedAt: z.string().nullable(),
		generationError: z.string().nullable(),
		generationRunId: z.string().nullable(),
		generationStatus: z.enum(["idle", "writing", "failed"]),
		id: z.uuid(),
		organizationId: z.string(),
		publishedAt: z.string().nullable(),
		publishedDocument: blogPostDocumentSchema.nullable(),
		publishedRevision: z.int().nullable(),
		revision: z.int(),
		slug: blogSlugSchema,
		updatedAt: z.string(),
	})
	.meta({ id: "BlogPost" });

export const blogPostGenerationStatusSchema = blogPostSchema
	.pick({
		generationError: true,
		generationRunId: true,
		generationStatus: true,
		id: true,
		revision: true,
		updatedAt: true,
	})
	.meta({ id: "BlogPostGenerationStatus" });

export const blogPostListResultSchema = z
	.strictObject({ data: z.array(blogPostSchema), page: z.number(), pageSize: z.number(), total: z.number() })
	.meta({ id: "ListBlogPostsResult" });

export type BlogPost = z.infer<typeof blogPostSchema>;

export type BlogActor = { organizationId: string; userId: string };

export class BlogPostError extends Error {
	constructor(
		public readonly code: "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "BAD_REQUEST",
		message: string
	) {
		super(message);
		this.name = "BlogPostError";
	}
}
