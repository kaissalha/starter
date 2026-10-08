import { openapi } from "@orpc/openapi";
import { z } from "zod";

import {
	archiveAllNotifications,
	archiveNotifications,
	countNotifications,
	listNotifications,
	markNotificationsRead,
	markNotificationsSeen,
	notificationCountsSchema,
	notificationIdsInputSchema,
	notificationListInputSchema,
	notificationListResultSchema,
	notificationSequenceInputSchema,
	notificationUpdateResultSchema,
} from "../../services/notifications/inbox";
import { authedWithOrganization } from "../base";

const procedure = authedWithOrganization.use(({ context, next }) =>
	next({
		context: { notificationActor: { organizationId: context.organizationId, userId: context.session.user.id } },
	})
);

const list = procedure
	.meta(
		openapi({
			method: "GET",
			operationId: "listNotifications",
			path: "/notifications",
			summary: "List the signed-in member's notifications",
			tags: ["notifications"],
		})
	)
	.input(z.compile(notificationListInputSchema))
	.output(z.compile(notificationListResultSchema))
	.handler(({ context, input }) => listNotifications({ actor: context.notificationActor, input }));

const counts = procedure
	.meta(
		openapi({
			method: "GET",
			operationId: "countNotifications",
			path: "/notifications/counts",
			summary: "Count the signed-in member's unseen notifications",
			tags: ["notifications"],
		})
	)
	.output(z.compile(notificationCountsSchema))
	.handler(({ context }) => countNotifications({ actor: context.notificationActor }));

const markSeen = procedure
	.meta(
		openapi({
			method: "POST",
			operationId: "markNotificationsSeen",
			path: "/notifications/seen",
			summary: "Mark notifications seen through a sequence",
			tags: ["notifications"],
		})
	)
	.input(z.compile(notificationSequenceInputSchema))
	.output(z.compile(notificationCountsSchema))
	.handler(({ context, input }) => markNotificationsSeen({ actor: context.notificationActor, input }));

const markRead = procedure
	.meta(
		openapi({
			method: "POST",
			operationId: "markNotificationsRead",
			path: "/notifications/read",
			summary: "Mark notifications read",
			tags: ["notifications"],
		})
	)
	.input(z.compile(notificationIdsInputSchema))
	.output(z.compile(notificationUpdateResultSchema))
	.handler(({ context, input }) => markNotificationsRead({ actor: context.notificationActor, input }));

const archive = procedure
	.meta(
		openapi({
			method: "POST",
			operationId: "archiveNotifications",
			path: "/notifications/archive",
			summary: "Archive notifications",
			tags: ["notifications"],
		})
	)
	.input(z.compile(notificationIdsInputSchema))
	.output(z.compile(notificationUpdateResultSchema))
	.handler(({ context, input }) => archiveNotifications({ actor: context.notificationActor, input }));

const archiveAll = procedure
	.meta(
		openapi({
			method: "POST",
			operationId: "archiveAllNotifications",
			path: "/notifications/archive-all",
			summary: "Archive every notification through a sequence",
			tags: ["notifications"],
		})
	)
	.input(z.compile(notificationSequenceInputSchema))
	.output(z.compile(notificationUpdateResultSchema))
	.handler(({ context, input }) => archiveAllNotifications({ actor: context.notificationActor, input }));

export const notifications = { archive, archiveAll, counts, list, markRead, markSeen };
