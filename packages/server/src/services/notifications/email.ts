import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { db, notificationEmailDeliveries, type EventRecord } from "@starter/db";
import { log, serializeLogError } from "@starter/observability";
import { getBaseURL } from "@starter/utils";

import { sendEmail } from "../../lib/resend";
import { findNotificationRecipients, type ProjectionOutcome } from "./projector";
import { getNotificationDefinition, notificationTypeKeys, type NotificationType } from "./registry";

type EmailContent = { html: string; replyTo?: string; subject: string };

const dashboardUrl = ({ locale, path }: { locale: string; path: string }) =>
	new URL(`${locale === "en" ? "" : `/${locale}`}${path}`, getBaseURL()).toString();

const emailContentBuilders: Partial<
	Record<
		string,
		(input: {
			event: EventRecord;
			locale: string;
			settingsLink: string;
		}) => Promise<EmailContent | ProjectionOutcome>
	>
> = {};

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
		(candidate) =>
			getNotificationDefinition(candidate).event === event.type && getNotificationDefinition(candidate).email
	);

	if (!type) {
		return { code: "not_applicable", state: "skipped" };
	}

	if (process.env.VERCEL_ENV !== "production" && process.env.EVENTS_EXTERNAL_DELIVERY !== "1") {
		return { code: "delivery_disabled", state: "skipped" };
	}

	const recipients = await findNotificationRecipients({ channel: "email", event, type });

	if (recipients.length === 0) {
		return { code: "no_recipients", state: "skipped" };
	}

	const build = emailContentBuilders[type];

	if (!build) {
		return { code: "not_applicable", state: "skipped" };
	}

	const locale = "en";

	const content = await build({
		event,
		locale,
		settingsLink: dashboardUrl({ locale, path: "/dashboard?settings=notifications" }),
	});

	if (!("html" in content)) {
		return content;
	}

	return deliverEmails({ content, event, recipients, type });
};
