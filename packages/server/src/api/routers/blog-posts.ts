import { openapi } from "@orpc/openapi";
import { eventIterator } from "@orpc/server";
import { z } from "zod";

import {
	BlogPostError,
	blogGenerationEnvelopeSchema,
	blogGenerationStreamInputSchema,
	blogPostCreateSchema,
	blogPostGenerateNewSchema,
	blogPostGenerateSchema,
	blogPostGenerationStatusSchema,
	blogPostIdSchema,
	blogPostListInputSchema,
	blogPostListResultSchema,
	blogPostRevisionSchema,
	blogPostSchema,
	blogPostTranslateSchema,
	blogPostUpdateSchema,
	cancelBlogPostGeneration,
	createBlogPost,
	deleteBlogPost,
	generateBlogPost,
	generateNewBlogPost,
	getBlogPostGenerationStatus,
	getBlogPost,
	listBlogPosts,
	publishBlogPost,
	streamBlogGeneration,
	translateBlogPost,
	unpublishBlogPost,
	updateBlogPost,
} from "../../services/blog-posts";
import { organizationPermission, authedWithOrganization, publicApi } from "../base";

const procedure = authedWithOrganization
	.errors({
		BAD_REQUEST: { message: "Invalid blog content." },
		CONFLICT: { message: "The blog post changed elsewhere." },
		FORBIDDEN: { message: "Organization membership is required." },
		NOT_FOUND: { message: "Blog post not found." },
	})
	.use(async ({ context, errors, next }) => {
		try {
			return await next({
				context: { blogActor: { organizationId: context.organizationId, userId: context.session.user.id } },
			});
		} catch (error) {
			if (error instanceof BlogPostError) {
				throw errors[error.code]({ message: error.message });
			}

			throw error;
		}
	});

const list = procedure
	.meta(publicApi(true))
	.meta(
		openapi({
			method: "GET",
			operationId: "listBlogPosts",
			path: "/blog-posts",
			summary: "List blog posts",
			tags: ["blog-posts"],
		})
	)
	.input(blogPostListInputSchema)
	.output(blogPostListResultSchema)
	.handler(({ context, input }) => listBlogPosts({ actor: context.blogActor, input }));

const get = procedure
	.meta(publicApi(true))
	.meta(
		openapi({
			method: "GET",
			operationId: "getBlogPost",
			path: "/blog-posts/{postId}",
			summary: "Get a blog post",
			tags: ["blog-posts"],
		})
	)
	.input(blogPostIdSchema)
	.output(blogPostSchema)
	.handler(({ context, input }) => getBlogPost({ actor: context.blogActor, postId: input.postId }));

const create = procedure
	.use(organizationPermission("write"))
	.meta(publicApi(true))
	.meta(
		openapi({
			method: "POST",
			operationId: "createBlogPost",
			path: "/blog-posts",
			summary: "Create a draft blog post manually",
			tags: ["blog-posts"],
		})
	)
	.input(blogPostCreateSchema)
	.output(blogPostSchema)
	.handler(({ context, input }) => createBlogPost({ actor: context.blogActor, input }));

const update = procedure
	.use(organizationPermission("write"))
	.meta(publicApi(true))
	.meta(
		openapi({
			method: "PUT",
			operationId: "updateBlogPost",
			path: "/blog-posts/{postId}",
			summary: "Edit a blog post draft",
			tags: ["blog-posts"],
		})
	)
	.input(blogPostUpdateSchema)
	.output(blogPostSchema)
	.handler(({ context, input }) => updateBlogPost({ actor: context.blogActor, input }));

const publish = procedure
	.use(organizationPermission("write"))
	.meta(publicApi(true))
	.meta(
		openapi({
			method: "POST",
			operationId: "publishBlogPost",
			path: "/blog-posts/{postId}/publish",
			summary: "Publish a blog post",
			tags: ["blog-posts"],
		})
	)
	.input(blogPostRevisionSchema)
	.output(blogPostSchema)
	.handler(({ context, input }) => publishBlogPost({ actor: context.blogActor, input }));

const unpublish = procedure
	.use(organizationPermission("delete"))
	.meta(publicApi(true))
	.meta(
		openapi({
			method: "POST",
			operationId: "unpublishBlogPost",
			path: "/blog-posts/{postId}/unpublish",
			summary: "Unpublish a blog post",
			tags: ["blog-posts"],
		})
	)
	.input(blogPostRevisionSchema)
	.output(blogPostSchema)
	.handler(({ context, input }) => unpublishBlogPost({ actor: context.blogActor, input }));

const remove = procedure
	.use(organizationPermission("delete"))
	.meta(publicApi(true))
	.meta(
		openapi({
			method: "DELETE",
			operationId: "deleteBlogPost",
			path: "/blog-posts/{postId}",
			summary: "Delete a blog post",
			tags: ["blog-posts"],
		})
	)
	.input(blogPostRevisionSchema)
	.output(z.strictObject({ id: z.uuid() }))
	.handler(({ context, input }) => deleteBlogPost({ actor: context.blogActor, input }));

const generate = procedure
	.use(organizationPermission("write"))
	.meta(publicApi(true))
	.meta(
		openapi({
			method: "POST",
			operationId: "generateBlogPost",
			path: "/blog-posts/{postId}/generate",
			summary: "Write an existing blog post with AI",
			tags: ["blog-posts"],
		})
	)
	.input(blogPostGenerateSchema)
	.output(blogPostSchema)
	.handler(({ context, input }) => generateBlogPost({ actor: context.blogActor, input }));

const translate = procedure
	.use(organizationPermission("write"))
	.meta(publicApi(true))
	.meta(
		openapi({
			method: "POST",
			operationId: "translateBlogPost",
			path: "/blog-posts/{postId}/translate",
			summary: "Translate a blog post into its empty language",
			tags: ["blog-posts"],
		})
	)
	.input(blogPostTranslateSchema)
	.output(blogPostSchema)
	.handler(({ context, input }) => translateBlogPost({ actor: context.blogActor, input }));

const cancel = procedure
	.use(organizationPermission("write"))
	.meta(publicApi(true))
	.meta(
		openapi({
			method: "POST",
			operationId: "cancelBlogPostGeneration",
			path: "/blog-posts/{postId}/cancel",
			summary: "Cancel a running blog post generation",
			tags: ["blog-posts"],
		})
	)
	.input(blogPostRevisionSchema)
	.output(blogPostSchema)
	.handler(({ context, input }) => cancelBlogPostGeneration({ actor: context.blogActor, input }));

const generateNew = procedure
	.use(organizationPermission("write"))
	.meta(publicApi(true))
	.meta(
		openapi({
			method: "POST",
			operationId: "generateNewBlogPost",
			path: "/blog-posts/generate",
			summary: "Create a draft blog post and write it with AI",
			tags: ["blog-posts"],
		})
	)
	.input(blogPostGenerateNewSchema)
	.output(blogPostSchema)
	.handler(({ context, input }) => generateNewBlogPost({ actor: context.blogActor, input }));

const generationStatus = procedure
	.meta(publicApi(true))
	.meta(
		openapi({
			method: "GET",
			operationId: "getBlogPostGenerationStatus",
			path: "/blog-posts/{postId}/generation",
			summary: "Get a blog post's generation status",
			tags: ["blog-posts"],
		})
	)
	.input(blogPostIdSchema)
	.output(blogPostGenerationStatusSchema)
	.handler(({ context, input }) => getBlogPostGenerationStatus({ actor: context.blogActor, postId: input.postId }));

const streamGeneration = procedure
	.meta(publicApi(true))
	.meta(
		openapi({
			method: "GET",
			operationId: "streamBlogPostGeneration",
			path: "/blog-posts/{postId}/generation/{runId}/events",
			summary: "Stream a running blog post generation's draft previews",
			tags: ["blog-posts"],
		})
	)
	.input(blogGenerationStreamInputSchema)
	.output(eventIterator(blogGenerationEnvelopeSchema))
	.handler(({ context, input }) => streamBlogGeneration({ actor: context.blogActor, input }));

export const blogPosts = {
	cancel,
	create,
	delete: remove,
	generate,
	generateNew,
	generationStatus,
	get,
	list,
	publish,
	streamGeneration,
	translate,
	unpublish,
	update,
};
