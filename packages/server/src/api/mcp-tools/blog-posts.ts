import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
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
	translateBlogPost,
	unpublishBlogPost,
	updateBlogPost,
} from "../../services/blog-posts";

export const registerBlogMcpTools = ({
	organizationId,
	server,
	userId,
}: {
	organizationId: string;
	server: McpServer;
	userId: string;
}) => {
	server.registerTool(
		"list_blog_posts",
		{
			annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: true },
			description:
				"List the active organization's blog posts with search, status filter and page-based pagination. Use exact returned IDs.",
			inputSchema: blogPostListInputSchema,
			outputSchema: blogPostListResultSchema,
			title: "listBlogPosts",
		},
		async (input) => {
			const output = await listBlogPosts({ actor: { organizationId, userId }, input });

			return { content: [{ text: JSON.stringify(output), type: "text" }], structuredContent: output };
		}
	);
	server.registerTool(
		"get_blog_post",
		{
			annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: true },
			description:
				"Get one blog post by exact ID from list_blog_posts, including its bilingual draft, published version, generation status and revision.",
			inputSchema: blogPostIdSchema,
			outputSchema: blogPostSchema,
			title: "getBlogPost",
		},
		async (input) => {
			const output = await getBlogPost({ actor: { organizationId, userId }, postId: input.postId });

			return { content: [{ text: JSON.stringify(output), type: "text" }], structuredContent: output };
		}
	);
	server.registerTool(
		"create_blog_post",
		{
			annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: false },
			description:
				"Create a draft blog post manually, optionally with a document and slug. Creating never publishes.",
			inputSchema: blogPostCreateSchema,
			outputSchema: blogPostSchema,
			title: "createBlogPost",
		},
		async (input) => {
			const output = await createBlogPost({ actor: { organizationId, userId }, input });

			return { content: [{ text: JSON.stringify(output), type: "text" }], structuredContent: output };
		}
	);
	server.registerTool(
		"update_blog_post",
		{
			annotations: { destructiveHint: true, openWorldHint: false, readOnlyHint: false },
			description:
				"Edit a blog post draft with a complete document and slug. Read get_blog_post first, use its exact revision, and preserve unrequested content. Does not publish.",
			inputSchema: blogPostUpdateSchema,
			outputSchema: blogPostSchema,
			title: "updateBlogPost",
		},
		async (input) => {
			const output = await updateBlogPost({ actor: { organizationId, userId }, input });

			return { content: [{ text: JSON.stringify(output), type: "text" }], structuredContent: output };
		}
	);
	server.registerTool(
		"publish_blog_post",
		{
			annotations: { destructiveHint: true, openWorldHint: false, readOnlyHint: false },
			description:
				"Publish a blog post that has English and Arabic titles and bodies, using the exact revision from get_blog_post. The slug locks after first publication.",
			inputSchema: blogPostRevisionSchema,
			outputSchema: blogPostSchema,
			title: "publishBlogPost",
		},
		async (input) => {
			const output = await publishBlogPost({ actor: { organizationId, userId }, input });

			return { content: [{ text: JSON.stringify(output), type: "text" }], structuredContent: output };
		}
	);
	server.registerTool(
		"unpublish_blog_post",
		{
			annotations: { destructiveHint: true, openWorldHint: false, readOnlyHint: false },
			description:
				"Remove a published blog post from the website, using the exact revision from get_blog_post. The draft is kept.",
			inputSchema: blogPostRevisionSchema,
			outputSchema: blogPostSchema,
			title: "unpublishBlogPost",
		},
		async (input) => {
			const output = await unpublishBlogPost({ actor: { organizationId, userId }, input });

			return { content: [{ text: JSON.stringify(output), type: "text" }], structuredContent: output };
		}
	);
	server.registerTool(
		"delete_blog_post",
		{
			annotations: { destructiveHint: true, openWorldHint: false, readOnlyHint: false },
			description: "Permanently delete a blog post, using the exact revision from get_blog_post.",
			inputSchema: blogPostRevisionSchema,
			outputSchema: z.strictObject({ id: z.uuid() }),
			title: "deleteBlogPost",
		},
		async (input) => {
			const output = await deleteBlogPost({ actor: { organizationId, userId }, input });

			return { content: [{ text: JSON.stringify(output), type: "text" }], structuredContent: output };
		}
	);
	server.registerTool(
		"generate_blog_post",
		{
			annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: false },
			description:
				"Rewrite an existing blog post with AI from a topic and optional instructions, using the exact revision from get_blog_post. Runs in the background and never publishes; poll get_blog_post_generation_status.",
			inputSchema: blogPostGenerateSchema,
			outputSchema: blogPostSchema,
			title: "generateBlogPost",
		},
		async (input) => {
			const output = await generateBlogPost({ actor: { organizationId, userId }, input });

			return { content: [{ text: JSON.stringify(output), type: "text" }], structuredContent: output };
		}
	);
	server.registerTool(
		"translate_blog_post",
		{
			annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: false },
			description:
				"Fill a blog post's empty target language with AI, using the exact revision from get_blog_post. Runs in the background; poll get_blog_post_generation_status.",
			inputSchema: blogPostTranslateSchema,
			outputSchema: blogPostSchema,
			title: "translateBlogPost",
		},
		async (input) => {
			const output = await translateBlogPost({ actor: { organizationId, userId }, input });

			return { content: [{ text: JSON.stringify(output), type: "text" }], structuredContent: output };
		}
	);
	server.registerTool(
		"cancel_blog_post_generation",
		{
			annotations: { destructiveHint: true, openWorldHint: false, readOnlyHint: false },
			description:
				"Cancel a running blog post generation, using the exact revision from get_blog_post_generation_status or get_blog_post.",
			inputSchema: blogPostRevisionSchema,
			outputSchema: blogPostSchema,
			title: "cancelBlogPostGeneration",
		},
		async (input) => {
			const output = await cancelBlogPostGeneration({ actor: { organizationId, userId }, input });

			return { content: [{ text: JSON.stringify(output), type: "text" }], structuredContent: output };
		}
	);
	server.registerTool(
		"generate_new_blog_post",
		{
			annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: true, readOnlyHint: false },
			description:
				"Create a new draft blog post and write it with AI from a topic and optional instructions. Runs in the background and never publishes; poll get_blog_post_generation_status.",
			inputSchema: blogPostGenerateNewSchema,
			outputSchema: blogPostSchema,
			title: "generateNewBlogPost",
		},
		async (input) => {
			const output = await generateNewBlogPost({ actor: { organizationId, userId }, input });

			return { content: [{ text: JSON.stringify(output), type: "text" }], structuredContent: output };
		}
	);
	server.registerTool(
		"get_blog_post_generation_status",
		{
			annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: true },
			description:
				"Get whether a blog post is idle, writing or failed, with any generation error and its current revision. Poll while writing.",
			inputSchema: blogPostIdSchema,
			outputSchema: blogPostGenerationStatusSchema,
			title: "getBlogPostGenerationStatus",
		},
		async ({ postId }) => {
			const output = await getBlogPostGenerationStatus({ actor: { organizationId, userId }, postId });

			return { content: [{ text: JSON.stringify(output), type: "text" }], structuredContent: output };
		}
	);
};
