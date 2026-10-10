import type { EventType } from "../events/catalog";

type NotificationAudience = "members" | "writers";

export const notificationCategories = [] as const;

type NotificationDefinition = {
	category: (typeof notificationCategories)[number];
	email: { audience: NotificationAudience; locked: boolean } | null;
	event: EventType;
	groupKey: string;
	inApp: { audience: NotificationAudience; locked: boolean };
	order: number;
	showInSettings: boolean;
};

export const notificationTypes = {} satisfies Record<string, NotificationDefinition>;

export type NotificationType = keyof typeof notificationTypes;

export const getNotificationDefinition = (type: NotificationType): NotificationDefinition => notificationTypes[type];

export const isNotificationType = (type: string): type is NotificationType => type in notificationTypes;

export const notificationTypeKeys = Object.keys(notificationTypes).filter(isNotificationType);

export const audiencePermission = (audience: NotificationAudience) => (audience === "writers" ? "write" : "read");

export const notificationEventTypes = ({ email = false }: { email?: boolean } = {}) =>
	notificationTypeKeys.flatMap((type) => {
		const definition = getNotificationDefinition(type);

		return !email || definition.email ? [definition.event] : [];
	});
