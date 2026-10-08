import { requireMcpAuth } from "@better-auth/mcp";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
	auth,
	getApiKeyFromHeaders,
	MCP_RESOURCE,
	ORGANIZATION_ID_CLAIM,
	resolveOAuthSession,
	resolveSession,
} from "../lib/auth";
import { requireOrganizationPermission } from "../services/permissions";
import { registerNotificationMcpTools } from "./mcp-tools/notifications";

const createOrganizationMcpHandler = async ({ organizationId, userId }: { organizationId: string; userId: string }) => {
	await requireOrganizationPermission({ organizationId, permission: "read", userId });

	return createMcpHandler(() => {
		const server = new McpServer({ name: "starter", version: "1.0.0" });
		const context = { organizationId, server, userId };
		registerNotificationMcpTools(context);

		return server;
	});
};

const oauthClaimsSchema = z.compile(
	z.object({
		[ORGANIZATION_ID_CLAIM]: z.string(),
		sub: z.string(),
	})
);

const oauthHandler = requireMcpAuth(
	auth,
	async (request, jwt) => {
		const claims = oauthClaimsSchema.safeParse(jwt);

		if (!claims.success) {
			return new Response("Unauthorized", { status: 401 });
		}

		if (
			!(await resolveOAuthSession({
				organizationId: claims.data[ORGANIZATION_ID_CLAIM],
				userId: claims.data.sub,
			}))
		) {
			return new Response("Unauthorized", { status: 401 });
		}

		return (
			await createOrganizationMcpHandler({
				organizationId: claims.data[ORGANIZATION_ID_CLAIM],
				userId: claims.data.sub,
			})
		).fetch(request);
	},
	{
		requiredScopes: ["mcp"],
		resource: MCP_RESOURCE,
	}
);

export const getMcpAuthentication = (headers: Headers) => (getApiKeyFromHeaders(headers) ? "api-key" : "oauth");

export const handleMcpRequest = async (request: Request) => {
	const apiKey = getApiKeyFromHeaders(request.headers);
	const session = apiKey ? await resolveSession(request.headers) : null;
	const organizationId = session?.session.activeOrganizationId;

	if (!apiKey || !organizationId) {
		return oauthHandler(request);
	}

	return (await createOrganizationMcpHandler({ organizationId, userId: session.user.id })).fetch(request);
};
