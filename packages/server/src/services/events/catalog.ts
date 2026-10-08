import { z } from "zod";

import { contactMessageTriageCategories, contactMessageTriageUrgencies } from "@starter/db";

export const contactEventFieldSchema = z.enum(["email", "name", "phone"]);

export const eventCatalog = {
	"contact_message.created": {
		data: z.strictObject({
			contactId: z.uuid(),
			messageId: z.uuid(),
			sectionId: z.uuid(),
			websiteId: z.uuid(),
		}),
		subjectType: "contact_message",
	},
	"contact_message.triaged": {
		data: z.strictObject({
			category: z.enum(contactMessageTriageCategories),
			contactId: z.uuid(),
			messageId: z.uuid(),
			spam: z.boolean(),
			urgency: z.enum(contactMessageTriageUrgencies),
		}),
		subjectType: "contact_message",
	},
	"contact.created": {
		data: z.strictObject({ contactId: z.uuid() }),
		subjectType: "contact",
	},
	"contact.deleted": {
		data: z.strictObject({ contactId: z.uuid() }),
		subjectType: "contact",
	},
	"contact.updated": {
		data: z.strictObject({ contactId: z.uuid(), fields: z.array(contactEventFieldSchema).min(1) }),
		subjectType: "contact",
	},
	"domain_registration.completed": {
		data: z.strictObject({ domain: z.string(), registrationId: z.uuid() }),
		subjectType: "domain_registration",
	},
	"domain_registration.expiring": {
		data: z.strictObject({ days: z.int(), domain: z.string(), expiresAt: z.string(), registrationId: z.uuid() }),
		subjectType: "domain_registration",
	},
	"domain_registration.failed": {
		data: z.strictObject({ domain: z.string(), registrationId: z.uuid() }),
		subjectType: "domain_registration",
	},
	"website_domain.connected": {
		data: z.strictObject({ domainId: z.uuid(), hostname: z.string(), websiteId: z.uuid() }),
		subjectType: "website_domain",
	},
} as const;

export type EventType = keyof typeof eventCatalog;

export type EventDataFor<Type extends EventType> = z.infer<(typeof eventCatalog)[Type]["data"]>;

export const isEventType = (type: string): type is EventType => type in eventCatalog;
