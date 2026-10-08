import { ipAddress, waitUntil } from "@vercel/functions";
import { and, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { checkRateLimit } from "@starter/cache";
import { contactMessages, contacts, db, websites, websiteVersions } from "@starter/db";
import { log, serializeLogError } from "@starter/observability";

import { appendEvents, wakeEventDispatcher, type AppendEventInput } from "../events/append";
import { isLegacyContactTriage } from "../events/switches";

const triageInBackground = async (input: { contactId: string; messageId: string }) => {
	try {
		const { triageContactMessage } = await import("../contacts");
		await triageContactMessage({ input, policy: "background", source: "system" });
	} catch (error) {
		await log.error({ ...input, error: serializeLogError(error), message: "Contact message triage failed" });
	}
};

export const websiteContactSubmissionSchema = z.strictObject({
	email: z.string().trim().toLowerCase().pipe(z.email().max(320)),
	message: z.string().trim().min(1).max(10_000),
	name: z.string().trim().min(1).max(500),
	phone: z.string().trim().max(100).default(""),
	sectionId: z.uuid(),
});

export const checkWebsiteContactRateLimit = async ({ headers, websiteId }: { headers: Headers; websiteId: string }) => {
	const ip = ipAddress(headers);

	const visitor = ip
		? await checkRateLimit({ key: `website-contact:${websiteId}:${ip}`, max: 5, windowSeconds: 600 })
		: null;

	if (visitor && !visitor.allowed) {
		return visitor;
	}

	return checkRateLimit({ key: `website-contact:${websiteId}`, max: 30, windowSeconds: 300 });
};

export const submitWebsiteContact = async ({
	input,
	websiteId,
}: {
	input: z.input<typeof websiteContactSubmissionSchema>;
	websiteId: string;
}) => {
	const parsed = websiteContactSubmissionSchema.parse(input);

	const saved = await db.transaction(async (transaction) => {
		const [website] = await transaction
			.select({
				hasContactForm: sql<boolean>`jsonb_path_exists(${websiteVersions.structure}, '$.structure.** ? (@.id == $sectionId && exists(@.contentId) && (@.source.pattern == "contact-form" || exists(@.root.** ? (@.type == "embed" && @.props.provider == "contact-form"))))', ${JSON.stringify({ sectionId: parsed.sectionId })}::jsonb)`,
				organizationId: websites.organizationId,
			})
			.from(websites)
			.innerJoin(
				websiteVersions,
				and(eq(websiteVersions.id, websites.publishedVersionId), eq(websiteVersions.websiteId, websites.id))
			)
			.where(
				and(isNull(websites.suspendedAt), eq(websites.id, websiteId), isNotNull(websiteVersions.publishedAt))
			)
			.for("share", { of: websites })
			.limit(1);

		if (!website?.hasContactForm) {
			return null;
		}

		const created = await transaction
			.insert(contacts)
			.values({
				email: parsed.email,
				name: parsed.name,
				organizationId: website.organizationId,
				phone: parsed.phone || null,
			})
			.onConflictDoNothing()
			.returning({ id: contacts.id });

		const [contact] = created.length
			? created
			: await transaction
					.select({ id: contacts.id })
					.from(contacts)
					.where(
						and(
							eq(contacts.organizationId, website.organizationId),
							eq(sql`lower(btrim(${contacts.email}))`, parsed.email)
						)
					)
					.for("share")
					.limit(1);

		if (!contact) {
			throw new Error("Unable to resolve the contact.");
		}

		const [duplicate] = await transaction
			.select({ id: contactMessages.id })
			.from(contactMessages)
			.where(
				and(
					eq(contactMessages.contactId, contact.id),
					eq(contactMessages.message, parsed.message),
					gt(contactMessages.createdAt, sql`now() - interval '10 minutes'`)
				)
			)
			.limit(1);

		if (duplicate) {
			return "duplicate" as const;
		}

		const [message] = await transaction
			.insert(contactMessages)
			.values({
				contactId: contact.id,
				message: parsed.message,
				sectionId: parsed.sectionId,
				senderName: parsed.name,
				senderPhone: parsed.phone || null,
				websiteId,
			})
			.returning({ id: contactMessages.id });

		if (!message) {
			throw new Error("Unable to save the message.");
		}

		const contactEvents: Array<AppendEventInput> = created.length
			? [
					{
						actor: { type: "visitor" },
						data: { contactId: contact.id },
						subject: { id: contact.id },
						type: "contact.created",
					},
				]
			: [];

		const eventIds = await appendEvents({
			events: [
				...contactEvents,
				{
					actor: { type: "visitor" },
					data: { contactId: contact.id, messageId: message.id, sectionId: parsed.sectionId, websiteId },
					subject: { id: message.id },
					type: "contact_message.created",
				},
			],
			organizationId: website.organizationId,
			source: "website",
			transaction,
		});

		return { contactId: contact.id, eventIds, messageId: message.id };
	});

	if (!saved) {
		return false;
	}

	if (saved === "duplicate") {
		return true;
	}

	waitUntil(wakeEventDispatcher({ eventIds: saved.eventIds }));

	if (await isLegacyContactTriage()) {
		waitUntil(triageInBackground({ contactId: saved.contactId, messageId: saved.messageId }));
	}

	return true;
};
