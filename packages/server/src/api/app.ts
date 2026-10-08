import { OpenAPIGenerator } from "@orpc/openapi";
import type { RouterClient } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod";

import { isPublicApiProcedure } from "./base";
import { analytics } from "./routers/analytics";
import { blogPosts } from "./routers/blog-posts";
import { brands } from "./routers/brands";
import { chats } from "./routers/chats";
import { contacts } from "./routers/contacts";
import { documents } from "./routers/documents";
import { domains } from "./routers/domains";
import { library } from "./routers/library";
import { linkPages } from "./routers/link-pages";
import { linkPreviews } from "./routers/link-previews";
import { media } from "./routers/media";
import { notificationSettings } from "./routers/notification-settings";
import { notifications } from "./routers/notifications";
import { seo } from "./routers/seo";
import { websites } from "./routers/websites";

export const apiRouter = {
	analytics,
	blogPosts,
	brands,
	chats,
	contacts,
	documents,
	domains,
	library,
	linkPages,
	linkPreviews,
	media,
	notifications,
	notificationSettings,
	seo,
	websites,
};

export type ApiRouter = typeof apiRouter;

export type ApiRouterClient = RouterClient<ApiRouter>;

export type { SeoOverview } from "../services/seo/overview";

export type { SeoPromptResult } from "../services/seo/prompt-explorer";

export { isPublicApiProcedure, publicApi } from "./base";

export { handleDataRetention, handleDomainCron, handleOrganizationPurgeCron } from "./cron";

export { handleEventDispatch, handleEventRetention } from "./events";

export { handleGetLibraryDocumentPdf } from "./library";

export { handleGetMedia, handleMediaUpload } from "./media";

export const openApiSpecPath = "/openapi.json";

const generator = new OpenAPIGenerator({
	converters: [new ZodToJsonSchemaConverter()],
});

export const generateOpenApiSpec = ({ origin }: { origin: string }) =>
	generator.generate(apiRouter, {
		base: {
			components: {
				securitySchemes: {
					apiKeyAuth: {
						description: "API key issued by Better Auth (`starter_…`).",
						in: "header",
						name: "x-api-key",
						type: "apiKey",
					},
					betterAuthSecureSession: {
						description: "Secure Better Auth session cookie issued by HTTPS deployments.",
						in: "cookie",
						name: "__Secure-better-auth.session_token",
						type: "apiKey",
					},
					betterAuthSession: {
						description: "Better Auth session cookie issued by the web application.",
						in: "cookie",
						name: "better-auth.session_token",
						type: "apiKey",
					},
				},
			},
			info: {
				description:
					"REST API for starter SDK, OpenAPI, and MCP integrations. Authenticate with an API key in the `x-api-key` header. Authentication endpoints are served by Better Auth under /api/auth and are not part of this document.",
				title: "starter API",
				version: "1.0.0",
			},
			servers: [
				{
					description: "Current deployment",
					url: `${origin}/api/v1`,
				},
			],
			tags: [
				{
					description: "Read the active organization's Website, Links and Blog traffic and performance.",
					name: "analytics",
				},
				{
					description: "Create, edit, generate, and publish the active organization’s blog posts.",
					name: "blog-posts",
				},
				{
					description: "Read, customize, and publish the active organization's Brand foundation.",
					name: "brands",
				},
				{
					description:
						"Manage the active organization's contacts and website inquiries, including inquiry summaries and triage suggestions.",
					name: "contacts",
				},
				{
					description:
						"Connect, verify, buy and manage the active organization's website domains, DNS records and free website address.",
					name: "domains",
				},
				{
					description: "Read, customize, and publish the active organization's Links page.",
					name: "link-pages",
				},
				{
					description:
						"Read and change the signed-in member's notification settings for the active organization.",
					name: "notifications",
				},
				{
					description:
						"Read the active organization's website search readiness, Google Search Console performance, and AI answer visibility (GEO).",
					name: "seo",
				},
			],
		},
		filter: (contract) => isPublicApiProcedure(contract),
		version: "3.1.0",
	});
