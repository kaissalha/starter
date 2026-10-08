import type { EventType } from "../events/catalog";

export type NotificationAudience = "members" | "writers";

export type NotificationDefinition = {
	category: "leads" | "website";
	email: { audience: NotificationAudience; locked: boolean } | null;
	event: EventType;
	groupKey: string;
	inApp: { audience: NotificationAudience; locked: boolean };
	order: number;
	showInSettings: boolean;
};

export const notificationTypes = {
	contact_message_received: {
		category: "leads",
		email: { audience: "writers", locked: false },
		event: "contact_message.created",
		groupKey: "contactId",
		inApp: { audience: "members", locked: false },
		order: 1,
		showInSettings: true,
	},
	domain_connected: {
		category: "website",
		email: null,
		event: "website_domain.connected",
		groupKey: "domainId",
		inApp: { audience: "members", locked: false },
		order: 2,
		showInSettings: true,
	},
	domain_expiring: {
		category: "website",
		email: { audience: "writers", locked: false },
		event: "domain_registration.expiring",
		groupKey: "registrationId",
		inApp: { audience: "writers", locked: true },
		order: 4,
		showInSettings: true,
	},
	domain_registered: {
		category: "website",
		email: null,
		event: "domain_registration.completed",
		groupKey: "registrationId",
		inApp: { audience: "members", locked: false },
		order: 3,
		showInSettings: true,
	},
	domain_registration_failed: {
		category: "website",
		email: { audience: "writers", locked: true },
		event: "domain_registration.failed",
		groupKey: "registrationId",
		inApp: { audience: "writers", locked: true },
		order: 5,
		showInSettings: false,
	},
} satisfies Record<string, NotificationDefinition>;

export type NotificationType = keyof typeof notificationTypes;

export const isNotificationType = (type: string): type is NotificationType => type in notificationTypes;

export const notificationTypeKeys = Object.keys(notificationTypes).filter(isNotificationType);

export const audiencePermission = (audience: NotificationAudience) => (audience === "writers" ? "write" : "read");
