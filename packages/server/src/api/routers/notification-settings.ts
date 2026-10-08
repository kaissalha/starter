import { openapi } from "@orpc/openapi";
import { z } from "zod";

import {
	getNotificationSettings,
	notificationSettingSchema,
	notificationSettingsSchema,
	notificationSettingUpdateSchema,
	updateNotificationSetting,
} from "../../services/notifications/preferences";
import { authedWithOrganization, publicApi } from "../base";

const procedure = authedWithOrganization.meta(publicApi(true));

const getAll = procedure
	.meta(
		openapi({
			method: "GET",
			operationId: "listNotificationSettings",
			path: "/notification-settings",
			summary: "List the signed-in member's notification settings",
			tags: ["notifications"],
		})
	)
	.output(z.compile(notificationSettingsSchema))
	.handler(({ context }) =>
		getNotificationSettings({ actor: { organizationId: context.organizationId, userId: context.session.user.id } })
	);

const update = procedure
	.meta(
		openapi({
			method: "PUT",
			operationId: "updateNotificationSetting",
			path: "/notification-settings",
			summary: "Turn a notification channel on or off",
			tags: ["notifications"],
		})
	)
	.input(z.compile(notificationSettingUpdateSchema))
	.output(z.compile(notificationSettingSchema))
	.handler(({ context, input }) =>
		updateNotificationSetting({
			actor: { organizationId: context.organizationId, userId: context.session.user.id },
			input,
		})
	);

export const notificationSettings = { getAll, update };
