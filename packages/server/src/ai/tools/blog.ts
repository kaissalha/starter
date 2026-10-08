import { createTool } from "@mastra/core/tools";

import {
	blogPostCreateSchema,
	blogPostGenerateNewSchema,
	blogPostGenerateSchema,
	blogPostIdSchema,
	blogPostListInputSchema,
	blogPostRevisionSchema,
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
	translateBlogPost,
	unpublishBlogPost,
	updateBlogPost,
} from "../../services/blog-posts";
import { appContextSchema, toolInput } from "../types";

const revisionRule = "Use the exact revision from getBlogPost in this turn. Requires approval.";

export const blogTools = {
	cancelBlogPostGeneration: createTool({
		description: `Cancel the running generation of a blog post. ${revisionRule}`,
		execute: async (input, { requestContext }) => cancelBlogPostGeneration({ actor: requestContext.all, input }),
		id: "cancel-blog-post-generation",
		inputSchema: toolInput(blogPostRevisionSchema),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	createBlogPost: createTool({
		description: "Create a draft blog post. Creating never publishes. Requires approval.",
		execute: async (input, { requestContext }) => createBlogPost({ actor: requestContext.all, input }),
		id: "create-blog-post",
		inputSchema: toolInput(blogPostCreateSchema),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	deleteBlogPost: createTool({
		description: `Permanently delete a blog post. ${revisionRule}`,
		execute: async (input, { requestContext }) => deleteBlogPost({ actor: requestContext.all, input }),
		id: "delete-blog-post",
		inputSchema: toolInput(blogPostRevisionSchema),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	generateBlogPost: createTool({
		description: `Start article generation for a blog post; the result stays a draft. ${revisionRule}`,
		execute: async (input, { requestContext }) => generateBlogPost({ actor: requestContext.all, input }),
		id: "generate-blog-post",
		inputSchema: toolInput(blogPostGenerateSchema),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	generateNewBlogPost: createTool({
		description:
			"Create a new draft blog post and start writing it with AI from a topic and optional instructions. The result stays a draft. Requires approval.",
		execute: async (input, { requestContext }) => generateNewBlogPost({ actor: requestContext.all, input }),
		id: "generate-new-blog-post",
		inputSchema: toolInput(blogPostGenerateNewSchema),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	getBlogPost: createTool({
		description: "Read one blog post using its exact ID from listBlogPosts.",
		execute: async ({ postId }, { requestContext }) => getBlogPost({ actor: requestContext.all, postId }),
		id: "get-blog-post",
		inputSchema: toolInput(blogPostIdSchema),
		requestContextSchema: appContextSchema,
	}),
	getBlogPostGenerationStatus: createTool({
		description:
			"Read whether a blog post is idle, writing or failed, with any generation error and its current revision.",
		execute: async ({ postId }, { requestContext }) =>
			getBlogPostGenerationStatus({ actor: requestContext.all, postId }),
		id: "get-blog-post-generation-status",
		inputSchema: toolInput(blogPostIdSchema),
		requestContextSchema: appContextSchema,
	}),
	listBlogPosts: createTool({
		description: "List organization blog posts. Follow pagination and use exact returned IDs.",
		execute: async (input, { requestContext }) => listBlogPosts({ actor: requestContext.all, input }),
		id: "list-blog-posts",
		inputSchema: toolInput(blogPostListInputSchema),
		requestContextSchema: appContextSchema,
	}),
	publishBlogPost: createTool({
		description: `Publish a blog post that has English and Arabic titles and bodies. ${revisionRule}`,
		execute: async (input, { requestContext }) => publishBlogPost({ actor: requestContext.all, input }),
		id: "publish-blog-post",
		inputSchema: toolInput(blogPostRevisionSchema),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	translateBlogPost: createTool({
		description: `Fill the empty target language of a blog post. ${revisionRule}`,
		execute: async (input, { requestContext }) => translateBlogPost({ actor: requestContext.all, input }),
		id: "translate-blog-post",
		inputSchema: toolInput(blogPostTranslateSchema),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	unpublishBlogPost: createTool({
		description: `Unpublish a blog post. ${revisionRule}`,
		execute: async (input, { requestContext }) => unpublishBlogPost({ actor: requestContext.all, input }),
		id: "unpublish-blog-post",
		inputSchema: toolInput(blogPostRevisionSchema),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	updateBlogPost: createTool({
		description: `Update a blog post and preserve unrequested content. ${revisionRule}`,
		execute: async (input, { requestContext }) => updateBlogPost({ actor: requestContext.all, input }),
		id: "update-blog-post",
		inputSchema: toolInput(blogPostUpdateSchema),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
};
