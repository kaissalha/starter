import { requireMcpAuth } from "@better-auth/mcp";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
	auth,
	getApiKeyFromHeaders,
	MCP_RESOURCE,
	ORGANIZATION_ID_CLAIM,
	resolveOrganizationSession,
	resolveSession,
} from "../lib/auth";
import {
	getNotificationSettings,
	notificationSettingUpdateSchema,
	updateNotificationSetting,
} from "../services/notifications/preferences";
import { requireOrganizationPermission } from "../services/permissions";

const createOrganizationMcpHandler = async ({ organizationId, userId }: { organizationId: string; userId: string }) => {
	await requireOrganizationPermission({ organizationId, permission: "read", userId });

	return createMcpHandler(() => {
		const server = new McpServer({ name: "starter", version: "1.0.0" });
		server.registerTool(
			"list_notification_settings",
			{
				annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: true },
				description:
					"List the signed-in member's notification settings in the active organization, including each channel's state and whether it is locked on.",
				inputSchema: z.compile(z.object({})),
				title: "listNotificationSettings",
			},
			async () => ({
				content: [
					{
						text: JSON.stringify(await getNotificationSettings({ actor: { organizationId, userId } })),
						type: "text",
					},
				],
			})
		);
		server.registerTool(
			"update_notification_setting",
			{
				annotations: {
					destructiveHint: false,
					idempotentHint: true,
					openWorldHint: false,
					readOnlyHint: false,
				},
				description:
					"Turn one notification channel on or off for the signed-in member, using an exact type and channel from list_notification_settings. Locked channels cannot be turned off.",
				inputSchema: notificationSettingUpdateSchema,
				title: "updateNotificationSetting",
			},
			async (input) => ({
				content: [
					{
						text: JSON.stringify(
							await updateNotificationSetting({ actor: { organizationId, userId }, input })
						),
						type: "text",
					},
				],
			})
		);

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
			!(await resolveOrganizationSession({
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
