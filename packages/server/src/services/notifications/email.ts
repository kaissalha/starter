import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { render } from "react-email";
import { z } from "zod";

import {
	contactMessages,
	contacts,
	db,
	members,
	notificationEmailDeliveries,
	notificationPreferences,
	users,
	websites,
	type EventRecord,
} from "@starter/db";
import { ContactMessageEmail, DomainAlertEmail, getI18n, isSupportedLocale } from "@starter/email";
import { log, serializeLogError } from "@starter/observability";
import { getBaseURL } from "@starter/utils";

import { sendEmail } from "../../lib/resend";
import { hasOrganizationPermission } from "../../utils/permissions";
import { eventCatalog } from "../events/catalog";
import type { ProjectionOutcome } from "./projector";
import { audiencePermission, notificationTypeKeys, notificationTypes, type NotificationType } from "./registry";

type EmailContent = { html: string; replyTo?: string; subject: string };

const singleLine = ({ length, value }: { length: number; value: string }) =>
	[...value.replaceAll(/\s+/gu, " ").trim()].slice(0, length).join("");

const dashboardUrl = ({ locale, path }: { locale: string; path: string }) =>
	new URL(`${locale === "en" ? "" : `/${locale}`}${path}`, getBaseURL()).toString();

const findRecipients = async ({ event, type }: { event: EventRecord; type: NotificationType }) => {
	const definition = notificationTypes[type].email;

	const candidates = await db
		.select({
			email: users.email,
			enabled: notificationPreferences.enabled,
			role: members.role,
			userId: members.userId,
		})
		.from(members)
		.innerJoin(users, eq(users.id, members.userId))
		.leftJoin(
			notificationPreferences,
			and(
				eq(notificationPreferences.organizationId, members.organizationId),
				eq(notificationPreferences.userId, members.userId),
				eq(notificationPreferences.type, type),
				eq(notificationPreferences.channel, "email")
			)
		)
		.where(eq(members.organizationId, event.organizationId))
		.orderBy(asc(members.userId));

	const actor = "userId" in event.actor ? event.actor.userId : null;

	return candidates.filter(
		({ enabled, role, userId }) =>
			definition !== null &&
			userId !== actor &&
			(definition.locked || enabled !== false) &&
			hasOrganizationPermission({ permission: audiencePermission(definition.audience), role })
	);
};

const buildContactContent = async ({
	event,
	locale,
	settingsLink,
}: {
	event: EventRecord;
	locale: string;
	settingsLink: string;
}): Promise<EmailContent | ProjectionOutcome> => {
	const data = eventCatalog["contact_message.created"].data.parse(event.data);

	const [row] = await db
		.select({
			email: contacts.email,
			message: contactMessages.message,
			senderName: contactMessages.senderName,
			senderPhone: contactMessages.senderPhone,
			spamFlag: contactMessages.spamFlag,
		})
		.from(contactMessages)
		.innerJoin(contacts, eq(contacts.id, contactMessages.contactId))
		.where(and(eq(contactMessages.id, data.messageId), eq(contacts.organizationId, event.organizationId)))
		.limit(1);

	if (!row) {
		return { code: "subject_deleted", state: "skipped" };
	}

	if (row.spamFlag) {
		return { code: "spam", state: "skipped" };
	}

	const name = singleLine({ length: 80, value: row.senderName });
	const characters = [...row.message.trim()];

	const html = await render(
		ContactMessageEmail({
			contactLink: dashboardUrl({
				locale,
				path: `/dashboard/contacts?contact=${data.contactId}&contactTab=messages&messageId=${data.messageId}`,
			}),
			locale,
			message: characters.length > 500 ? `${characters.slice(0, 500).join("")}…` : characters.join(""),
			senderEmail: row.email ?? undefined,
			senderName: name,
			senderPhone: row.senderPhone,
			settingsLink,
		})
	);

	return {
		html,
		replyTo: row.email && z.email().safeParse(row.email).success ? row.email : undefined,
		subject: getI18n({ locale }).t("contactMessage.subject", { name }),
	};
};

const buildDomainContent = async ({
	event,
	locale,
	settingsLink,
}: {
	event: EventRecord;
	locale: string;
	settingsLink: string;
}): Promise<EmailContent | ProjectionOutcome> => {
	const { t } = getI18n({ locale });
	const manageLink = dashboardUrl({ locale, path: "/dashboard/website?websiteSettings=domains" });

	if (event.type === "domain_registration.expiring") {
		const data = eventCatalog["domain_registration.expiring"].data.parse(event.data);
		const domain = singleLine({ length: 253, value: data.domain });

		return {
			html: await render(
				DomainAlertEmail({ days: data.days, domain, kind: "expiring", locale, manageLink, settingsLink })
			),
			subject: t("domainAlert.expiring.subject", { domain }),
		};
	}

	if (event.type === "domain_registration.failed") {
		const data = eventCatalog["domain_registration.failed"].data.parse(event.data);
		const domain = singleLine({ length: 253, value: data.domain });

		return {
			html: await render(DomainAlertEmail({ domain, kind: "failed", locale, manageLink, settingsLink })),
			subject: t("domainAlert.failed.subject", { domain }),
		};
	}

	return { code: "not_applicable", state: "skipped" };
};

const deliverEmails = async ({
	content,
	event,
	recipients,
	type,
}: {
	content: EmailContent;
	event: EventRecord;
	recipients: ReadonlyArray<{ email: string; userId: string }>;
	type: NotificationType;
}): Promise<ProjectionOutcome> => {
	await db
		.insert(notificationEmailDeliveries)
		.values(
			recipients.map(({ userId }) => ({
				eventId: event.id,
				organizationId: event.organizationId,
				recipientUserId: userId,
				type,
			}))
		)
		.onConflictDoNothing();

	const pending = await db
		.select({ id: notificationEmailDeliveries.id, recipientUserId: notificationEmailDeliveries.recipientUserId })
		.from(notificationEmailDeliveries)
		.where(
			and(
				eq(notificationEmailDeliveries.eventId, event.id),
				eq(notificationEmailDeliveries.type, type),
				isNull(notificationEmailDeliveries.acceptedAt),
				inArray(
					notificationEmailDeliveries.recipientUserId,
					recipients.map(({ userId }) => userId)
				)
			)
		);

	if (pending.length === 0) {
		return { code: "already_sent", state: "skipped" };
	}

	const results = await Promise.allSettled(
		recipients
			.flatMap(({ email, userId }) =>
				pending.filter((row) => row.recipientUserId === userId).map(({ id }) => ({ email, id }))
			)
			.map(async ({ email, id }) => {
				const providerMessageId = await sendEmail({
					flow: "notification",
					html: content.html,
					idempotencyKey: id,
					replyTo: content.replyTo,
					subject: content.subject,
					to: email,
				});

				await db
					.update(notificationEmailDeliveries)
					.set({ acceptedAt: sql`now()`, providerMessageId })
					.where(eq(notificationEmailDeliveries.id, id));
			})
	);

	const failed = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
	await Promise.all(
		failed.map((result) =>
			log.error({
				error: serializeLogError(result.reason),
				eventId: event.id,
				message: "Notification email failed",
				type,
			})
		)
	);

	if (failed.length > 0) {
		throw new Error(`${failed.length} notification emails failed`);
	}

	return { code: "email_accepted", state: "succeeded" };
};

export const sendNotificationEmails = async ({ event }: { event: EventRecord }): Promise<ProjectionOutcome> => {
	const type = notificationTypeKeys.find(
		(candidate) => notificationTypes[candidate].event === event.type && notificationTypes[candidate].email
	);

	if (!type) {
		return { code: "not_applicable", state: "skipped" };
	}

	if (process.env.VERCEL_ENV !== "production" && process.env.EVENTS_EXTERNAL_DELIVERY !== "1") {
		return { code: "delivery_disabled", state: "skipped" };
	}

	const recipients = await findRecipients({ event, type });

	if (recipients.length === 0) {
		return { code: "no_recipients", state: "skipped" };
	}

	const [website] = await db
		.select({ locale: websites.locale })
		.from(websites)
		.where(eq(websites.organizationId, event.organizationId))
		.limit(1);

	const locale = isSupportedLocale(website?.locale) ? website.locale : "en";
	const settingsLink = dashboardUrl({ locale, path: "/dashboard?settings=notifications" });

	const content =
		event.type === "contact_message.created"
			? await buildContactContent({ event, locale, settingsLink })
			: await buildDomainContent({ event, locale, settingsLink });

	if (!("html" in content)) {
		return content;
	}

	return deliverEmails({ content, event, recipients, type });
};
