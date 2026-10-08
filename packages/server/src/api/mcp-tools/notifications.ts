import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
	getNotificationSettings,
	notificationSettingUpdateSchema,
	updateNotificationSetting,
} from "../../services/notifications/preferences";

export const registerNotificationMcpTools = ({
	organizationId,
	server,
	userId,
}: {
	organizationId: string;
	server: McpServer;
	userId: string;
}) => {
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
					text: JSON.stringify(await updateNotificationSetting({ actor: { organizationId, userId }, input })),
					type: "text",
				},
			],
		})
	);
};
