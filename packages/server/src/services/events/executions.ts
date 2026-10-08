import { and, eq, inArray, sql, type AnyColumn } from "drizzle-orm";

import { db, eventExecutions, events, type EventExecutionState, type EventRecord } from "@starter/db";
import { log, serializeLogError } from "@starter/observability";

import { ContactError, triageContactMessage } from "../contacts";
import { sendNotificationEmails } from "../notifications/email";
import { projectNotificationEvent } from "../notifications/projector";
import { eventCatalog, isEventType, type EventType } from "./catalog";
import { isEventConsumerPaused, isLegacyContactTriage } from "./switches";

export type EventExecutionStep = { status: "done" } | { status: "run" } | { status: "wait"; until: number };

type ConsumerOutcome = { code: string; state: Extract<EventExecutionState, "skipped" | "succeeded"> };

type BuiltinConsumer = {
	events: ReadonlyArray<EventType>;
	run: (input: { event: EventRecord }) => Promise<ConsumerOutcome>;
};

const retryDelaysInSeconds = [30, 120, 600, 1800, 7200];

const pauseDelayInSeconds = 300;

const deadlineInSeconds = 900;

const runContactTriage = async ({ event }: { event: EventRecord }): Promise<ConsumerOutcome> => {
	if (await isLegacyContactTriage()) {
		return { code: "owned_elsewhere", state: "skipped" };
	}

	const data = eventCatalog["contact_message.created"].data.parse(event.data);

	try {
		const result = await triageContactMessage({
			input: { contactId: data.contactId, messageId: data.messageId },
			policy: "background",
			source: "workflow",
		});

		if (result.status !== "suggested") {
			throw new Error("Contact triage is unavailable");
		}

		return { code: "triaged", state: "succeeded" };
	} catch (error) {
		if (error instanceof ContactError && error.code === "NOT_FOUND") {
			return { code: "subject_deleted", state: "skipped" };
		}

		throw error;
	}
};

const builtinConsumers = {
	contact_triage: { events: ["contact_message.created"], run: runContactTriage },
	notification_email: {
		events: ["contact_message.created", "domain_registration.expiring", "domain_registration.failed"],
		run: sendNotificationEmails,
	},
	notifications: {
		events: [
			"contact.deleted",
			"contact_message.created",
			"contact_message.triaged",
			"domain_registration.completed",
			"domain_registration.expiring",
			"domain_registration.failed",
			"website_domain.connected",
		],
		run: projectNotificationEvent,
	},
} satisfies Record<string, BuiltinConsumer>;

const findBuiltinConsumer = (consumerKey: string): BuiltinConsumer | undefined =>
	Object.entries(builtinConsumers).find(([name]) => consumerKey === `builtin:${name}`)?.[1];

export const listBuiltinConsumerKeys = (type: EventType) =>
	Object.entries(builtinConsumers)
		.filter(([, consumer]) => consumer.events.some((eventType) => eventType === type))
		.map(([name]) => `builtin:${name}`);

const secondsFromNow = (seconds: number) => sql`now() + make_interval(secs => ${seconds})`;

const epochMilliseconds = (column: AnyColumn) => sql<number>`(extract(epoch from ${column}) * 1000)::float8`;

const settleExecution = ({
	code,
	executionId,
	runId,
	state,
}: {
	code: string;
	executionId: string;
	runId: string;
	state: Extract<EventExecutionState, "failed" | "skipped" | "succeeded">;
}) =>
	db
		.update(eventExecutions)
		.set({
			completedAt: sql`now()`,
			expectedBy: null,
			nextAttemptAt: null,
			outcomeCode: code,
			state,
			updatedAt: sql`now()`,
		})
		.where(and(eq(eventExecutions.id, executionId), eq(eventExecutions.workflowRunId, runId)));

const waitForRetry = async ({
	code,
	delayInSeconds,
	executionId,
	runId,
}: {
	code: string;
	delayInSeconds: number;
	executionId: string;
	runId: string;
}): Promise<EventExecutionStep> => {
	const [waiting] = await db
		.update(eventExecutions)
		.set({
			expectedBy: secondsFromNow(delayInSeconds + deadlineInSeconds),
			nextAttemptAt: secondsFromNow(delayInSeconds),
			outcomeCode: code,
			state: "retry_wait",
			updatedAt: sql`now()`,
		})
		.where(and(eq(eventExecutions.id, executionId), eq(eventExecutions.workflowRunId, runId)))
		.returning({ until: epochMilliseconds(eventExecutions.nextAttemptAt) });

	return waiting ? { status: "wait", until: waiting.until } : { status: "done" };
};

const recordAttempt = ({ executionId, runId }: { executionId: string; runId: string }) =>
	db
		.update(eventExecutions)
		.set({
			attemptCount: sql`${eventExecutions.attemptCount} + 1`,
			expectedBy: secondsFromNow(deadlineInSeconds),
			state: "running",
			updatedAt: sql`now()`,
		})
		.where(and(eq(eventExecutions.id, executionId), eq(eventExecutions.workflowRunId, runId)))
		.returning({ attemptCount: eventExecutions.attemptCount });

const retryOrSettle = async ({
	attemptCount,
	code,
	executionId,
	exhaustedCode,
	runId,
}: {
	attemptCount: number;
	code: string;
	executionId: string;
	exhaustedCode: string;
	runId: string;
}): Promise<EventExecutionStep> => {
	const delayInSeconds = retryDelaysInSeconds[attemptCount - 1];

	if (delayInSeconds === undefined) {
		await settleExecution({ code: exhaustedCode, executionId, runId, state: "failed" });

		return { status: "done" };
	}

	return waitForRetry({ code, delayInSeconds, executionId, runId });
};

export const claimEventExecution = async ({
	executionId,
	runId,
}: {
	executionId: string;
	runId: string;
}): Promise<EventExecutionStep> => {
	const [claimed] = await db
		.update(eventExecutions)
		.set({
			expectedBy: secondsFromNow(deadlineInSeconds),
			state: "running",
			updatedAt: sql`now()`,
			workflowRunId: runId,
		})
		.where(
			and(
				eq(eventExecutions.id, executionId),
				sql`((${eventExecutions.state} = 'queued' and ${eventExecutions.workflowRunId} is null) or (${eventExecutions.state} = 'running' and ${eventExecutions.workflowRunId} = ${runId}))`
			)
		)
		.returning({
			due: sql<boolean>`${eventExecutions.availableAt} <= now()`,
			until: epochMilliseconds(eventExecutions.availableAt),
		});

	if (!claimed) {
		return { status: "done" };
	}

	return claimed.due ? { status: "run" } : { status: "wait", until: claimed.until };
};

export const continueEventExecution = async ({
	executionId,
	runId,
}: {
	executionId: string;
	runId: string;
}): Promise<EventExecutionStep> => {
	const [row] = await db
		.select({ event: events, execution: eventExecutions })
		.from(eventExecutions)
		.innerJoin(events, eq(events.id, eventExecutions.eventId))
		.where(
			and(
				eq(eventExecutions.id, executionId),
				eq(eventExecutions.workflowRunId, runId),
				inArray(eventExecutions.state, ["running", "retry_wait"])
			)
		)
		.limit(1);

	if (!row) {
		return { status: "done" };
	}

	const consumer = findBuiltinConsumer(row.execution.consumerKey);

	if (!consumer || !isEventType(row.event.type)) {
		const [unknown] = await recordAttempt({ executionId, runId });

		if (!unknown) {
			return { status: "done" };
		}

		await log.warn({
			consumerKey: row.execution.consumerKey,
			eventType: row.event.type,
			executionId,
			message: "Event execution consumer or type is unknown to this deployment",
		});

		return retryOrSettle({
			attemptCount: unknown.attemptCount,
			code: "unknown_consumer",
			executionId,
			exhaustedCode: "unknown_consumer",
			runId,
		});
	}

	if (await isEventConsumerPaused({ consumerKey: row.execution.consumerKey })) {
		return waitForRetry({ code: "paused", delayInSeconds: pauseDelayInSeconds, executionId, runId });
	}

	const [attempt] = await recordAttempt({ executionId, runId });

	if (!attempt) {
		return { status: "done" };
	}

	try {
		const outcome = await consumer.run({ event: row.event });
		await settleExecution({ code: outcome.code, executionId, runId, state: outcome.state });

		return { status: "done" };
	} catch (error) {
		await log.error({
			attempt: attempt.attemptCount,
			consumerKey: row.execution.consumerKey,
			error: serializeLogError(error),
			executionId,
			message: "Event execution attempt failed",
		});

		return retryOrSettle({
			attemptCount: attempt.attemptCount,
			code: "attempt_failed",
			executionId,
			exhaustedCode: "retries_exhausted",
			runId,
		});
	}
};
