import { OpenAPIGenerator } from "@orpc/openapi";
import type { RouterClient } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod";

import { isPublicApiProcedure } from "./base";
import { chats } from "./routers/chats";
import { documents } from "./routers/documents";
import { library } from "./routers/library";
import { linkPreviews } from "./routers/link-previews";
import { media } from "./routers/media";
import { notificationSettings } from "./routers/notification-settings";
import { notifications } from "./routers/notifications";

export const apiRouter = {
	chats,
	documents,
	library,
	linkPreviews,
	media,
	notifications,
	notificationSettings,
};

export type ApiRouter = typeof apiRouter;

export type ApiRouterClient = RouterClient<ApiRouter>;

export { isPublicApiProcedure, publicApi } from "./base";

export { handleDataRetention, handleEventDispatch, handleEventRetention, handleOrganizationPurgeCron } from "./cron";

export { type FilesUploadData, handleFilesRequest } from "./files";

export { handleGetLibraryDocumentPdf } from "./library";

export { handleGetMedia } from "./media";

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
					description:
						"Read and change the signed-in member's notification settings for the active organization.",
					name: "notifications",
				},
			],
		},
		filter: (contract) => isPublicApiProcedure(contract),
		version: "3.1.0",
	});
