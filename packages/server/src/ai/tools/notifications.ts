import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import {
	getNotificationSettings,
	notificationSettingUpdateSchema,
	updateNotificationSetting,
} from "../../services/notifications/preferences";
import { appContextSchema, toolInput } from "../types";

export const notificationsTools = {
	getNotificationSettings: createTool({
		description:
			"Read the current member's notification settings, including each type's channels, whether each is on, and whether it is locked on.",
		execute: async (_input, { requestContext }) => getNotificationSettings({ actor: requestContext.all }),
		id: "get-notification-settings",
		inputSchema: z.compile(z.object({})),
		requestContextSchema: appContextSchema,
	}),
	updateNotificationSetting: createTool({
		description:
			"Turn one notification channel on or off for the current member, using an exact type and channel from getNotificationSettings. Locked channels cannot be turned off.",
		execute: async (input, { requestContext }) => updateNotificationSetting({ actor: requestContext.all, input }),
		id: "update-notification-setting",
		inputSchema: toolInput(notificationSettingUpdateSchema),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
};
