import { ORPCError } from "@orpc/client";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db, members, notificationChannels, notificationPreferences } from "@starter/db";

import { hasOrganizationPermission } from "../../utils/permissions";
import type { NotificationActor } from "./inbox";
import {
	audiencePermission,
	getNotificationDefinition,
	notificationCategories,
	notificationTypeKeys,
} from "./registry";

export const notificationSettingSchema = z
	.strictObject({
		category: z.enum(notificationCategories),
		channels: z.array(
			z.strictObject({ channel: z.enum(notificationChannels), enabled: z.boolean(), locked: z.boolean() })
		),
		order: z.int(),
		type: z.enum(notificationTypeKeys),
	})
	.meta({ id: "NotificationSetting" });

export const notificationSettingsSchema = z.array(notificationSettingSchema).meta({ id: "NotificationSettings" });

export const notificationSettingUpdateSchema = z
	.strictObject({ channel: z.enum(notificationChannels), enabled: z.boolean(), type: z.enum(notificationTypeKeys) })
	.meta({ id: "UpdateNotificationSetting" });

export const getNotificationSettings = async ({ actor }: { actor: NotificationActor }) => {
	const saved = await db
		.select({
			channel: notificationPreferences.channel,
			enabled: notificationPreferences.enabled,
			type: notificationPreferences.type,
		})
		.from(notificationPreferences)
		.where(
			and(
				eq(notificationPreferences.organizationId, actor.organizationId),
				eq(notificationPreferences.userId, actor.userId)
			)
		);

	const [membership] = await db
		.select({ role: members.role })
		.from(members)
		.where(and(eq(members.organizationId, actor.organizationId), eq(members.userId, actor.userId)))
		.limit(1);

	return notificationTypeKeys
		.filter((type) => getNotificationDefinition(type).showInSettings)
		.map((type) => {
			const definition = getNotificationDefinition(type);

			return {
				category: definition.category,
				channels: [
					{
						channel: "in_app" as const,
						enabled:
							definition.inApp.locked ||
							(saved.find((row) => row.type === type && row.channel === "in_app")?.enabled ?? true),
						locked: definition.inApp.locked,
					},
					...(definition.email &&
					hasOrganizationPermission({
						permission: audiencePermission(definition.email.audience),
						role: membership?.role,
					})
						? [
								{
									channel: "email" as const,
									enabled:
										definition.email.locked ||
										(saved.find((row) => row.type === type && row.channel === "email")?.enabled ??
											true),
									locked: definition.email.locked,
								},
							]
						: []),
				],
				order: definition.order,
				type,
			};
		})
		.toSorted((first, second) => first.order - second.order);
};

export const updateNotificationSetting = async ({
	actor,
	input,
}: {
	actor: NotificationActor;
	input: z.input<typeof notificationSettingUpdateSchema>;
}) => {
	const { channel, enabled, type } = notificationSettingUpdateSchema.parse(input);

	const definition =
		channel === "email" ? getNotificationDefinition(type).email : getNotificationDefinition(type).inApp;

	if (!definition) {
		throw new ORPCError("BAD_REQUEST", { message: "This notification is not available on that channel." });
	}

	if (definition.locked) {
		throw new ORPCError("BAD_REQUEST", { message: "This notification cannot be turned off." });
	}

	await db
		.insert(notificationPreferences)
		.values({ channel, enabled, organizationId: actor.organizationId, type, userId: actor.userId })
		.onConflictDoUpdate({
			set: { enabled, updatedAt: sql`now()` },
			target: [
				notificationPreferences.organizationId,
				notificationPreferences.userId,
				notificationPreferences.type,
				notificationPreferences.channel,
			],
		});
	const settings = await getNotificationSettings({ actor });
	const setting = settings.find((candidate) => candidate.type === type);

	if (!setting) {
		throw new ORPCError("NOT_FOUND", { message: "Notification type not found." });
	}

	return setting;
};
