import { and, asc, eq, inArray, isNull, lt, lte, notExists, or, sql } from "drizzle-orm";
import { getRun, start } from "workflow/api";

import { db, eventDispatches, eventExecutions, events } from "@starter/db";
import { log, serializeLogError } from "@starter/observability";

import { runEventExecutionWorkflow } from "../../workflows/run-event-execution";
import { deleteInBatches } from "../data-retention";
import { isEventType } from "./catalog";
import { listBuiltinConsumerKeys } from "./executions";

const batchSize = 100;

const retentionBatchSize = 1000;

const maxExpansionAttempts = 24;

const deferExpansion = async ({ code, eventId }: { code: string; eventId: string }) => {
	try {
		const [deferred] = await db
			.update(eventDispatches)
			.set({
				attempts: sql`${eventDispatches.attempts} + 1`,
				availableAt: sql`now() + least(interval '30 seconds' * power(2, least(${eventDispatches.attempts}, 10)), interval '1 hour')`,
				lastErrorCode: code,
			})
			.where(and(eq(eventDispatches.eventId, eventId), isNull(eventDispatches.expandedAt)))
			.returning({ attempts: eventDispatches.attempts });

		if (deferred && deferred.attempts >= maxExpansionAttempts) {
			await log.warn({ code, eventId, message: "Event expansion gave up after repeated failures" });
		}
	} catch (error) {
		await log.error({ error: serializeLogError(error), eventId, message: "Event expansion deferral failed" });
	}
};

const expandEvent = async ({ eventId }: { eventId: string }) => {
	try {
		const expanded = await db.transaction(async (transaction) => {
			const [dispatch] = await transaction
				.select({ organizationId: eventDispatches.organizationId })
				.from(eventDispatches)
				.where(and(eq(eventDispatches.eventId, eventId), isNull(eventDispatches.expandedAt)))
				.for("update", { skipLocked: true })
				.limit(1);

			if (!dispatch) {
				return null;
			}

			const [event] = await transaction
				.select({ type: events.type })
				.from(events)
				.where(eq(events.id, eventId))
				.limit(1);

			if (!event || !isEventType(event.type)) {
				return "unknown_event_type" as const;
			}

			const consumerKeys = listBuiltinConsumerKeys(event.type);

			const created =
				consumerKeys.length === 0
					? []
					: await transaction
							.insert(eventExecutions)
							.values(
								consumerKeys.map((consumerKey) => ({
									consumerKey,
									consumerKind: "builtin" as const,
									eventId,
									organizationId: dispatch.organizationId,
								}))
							)
							.onConflictDoNothing()
							.returning({ id: eventExecutions.id });

			await transaction
				.update(eventDispatches)
				.set({ expandedAt: sql`now()` })
				.where(eq(eventDispatches.eventId, eventId));

			return created.map(({ id }) => id);
		});

		if (expanded === "unknown_event_type") {
			await log.warn({ eventId, message: "Event type is unknown to this deployment; expansion deferred" });
			await deferExpansion({ code: "unknown_event_type", eventId });

			return null;
		}

		return expanded;
	} catch (error) {
		await log.error({ error: serializeLogError(error), eventId, message: "Event expansion failed" });
		await deferExpansion({ code: "expansion_failed", eventId });

		return null;
	}
};

const startExecution = async ({ executionId }: { executionId: string }) => {
	const [requested] = await db
		.update(eventExecutions)
		.set({ startRequestedAt: sql`now()`, updatedAt: sql`now()` })
		.where(
			and(
				eq(eventExecutions.id, executionId),
				eq(eventExecutions.state, "queued"),
				isNull(eventExecutions.workflowRunId),
				or(
					isNull(eventExecutions.startRequestedAt),
					lt(eventExecutions.startRequestedAt, sql`now() - interval '2 minutes'`)
				)
			)
		)
		.returning({ id: eventExecutions.id });

	if (!requested) {
		return false;
	}

	try {
		await start(runEventExecutionWorkflow, [executionId]);

		return true;
	} catch (error) {
		await log.error({ error: serializeLogError(error), executionId, message: "Event execution start failed" });

		return false;
	}
};

const cancelStrandedRun = async ({ runId }: { runId: string }) => {
	try {
		const run = getRun(runId);

		if (!(await run.exists)) {
			return;
		}

		const status = await run.status;

		if (status === "pending" || status === "running") {
			await run.cancel({ cancelReason: "Event execution passed its deadline" });
		}
	} catch (error) {
		await log.warn({
			error: serializeLogError(error),
			message: "Stranded event execution run could not be cancelled",
			runId,
		});
	}
};

const recoverExecution = async ({ executionId, runId }: { executionId: string; runId: string | null }) => {
	if (runId) {
		await cancelStrandedRun({ runId });
	}

	const [reset] = await db
		.update(eventExecutions)
		.set({ expectedBy: null, startRequestedAt: null, state: "queued", updatedAt: sql`now()`, workflowRunId: null })
		.where(
			and(
				eq(eventExecutions.id, executionId),
				runId ? eq(eventExecutions.workflowRunId, runId) : isNull(eventExecutions.workflowRunId),
				inArray(eventExecutions.state, ["running", "retry_wait"]),
				lt(eventExecutions.expectedBy, sql`now()`)
			)
		)
		.returning({ id: eventExecutions.id });

	return reset ? startExecution({ executionId }) : false;
};

const inSequence = async <Item, Result>(items: Array<Item>, task: (item: Item) => Promise<Result>) =>
	items.reduce<Promise<Array<Result>>>(
		async (previous, item) => [...(await previous), await task(item)],
		Promise.resolve([])
	);

const expandAndStart = async (eventIds: Array<string>) => {
	const expansions = (await inSequence(eventIds, (eventId) => expandEvent({ eventId }))).filter(
		(executionIds) => executionIds !== null
	);

	const started = await inSequence(expansions.flat(), (executionId) => startExecution({ executionId }));

	return { expanded: expansions.length, started: started.filter(Boolean).length };
};

export const dispatchEvents = async ({ eventIds }: { eventIds?: Array<string> } = {}) => {
	if (eventIds) {
		return { ...(await expandAndStart(eventIds.slice(0, batchSize))), recovered: 0 };
	}

	const due = await db
		.select({ eventId: eventDispatches.eventId })
		.from(eventDispatches)
		.where(
			and(
				isNull(eventDispatches.expandedAt),
				lte(eventDispatches.availableAt, sql`now()`),
				lt(eventDispatches.attempts, maxExpansionAttempts)
			)
		)
		.orderBy(asc(eventDispatches.availableAt))
		.limit(batchSize);

	const dispatched = await expandAndStart(due.map(({ eventId }) => eventId));

	const queued = await db
		.select({ id: eventExecutions.id })
		.from(eventExecutions)
		.where(
			and(
				eq(eventExecutions.state, "queued"),
				isNull(eventExecutions.workflowRunId),
				lte(eventExecutions.availableAt, sql`now()`),
				or(
					isNull(eventExecutions.startRequestedAt),
					lt(eventExecutions.startRequestedAt, sql`now() - interval '2 minutes'`)
				)
			)
		)
		.orderBy(asc(eventExecutions.availableAt))
		.limit(batchSize);

	const restarted = await inSequence(queued, ({ id }) => startExecution({ executionId: id }));

	const stranded = await db
		.select({ id: eventExecutions.id, runId: eventExecutions.workflowRunId })
		.from(eventExecutions)
		.where(
			and(inArray(eventExecutions.state, ["running", "retry_wait"]), lt(eventExecutions.expectedBy, sql`now()`))
		)
		.orderBy(asc(eventExecutions.expectedBy))
		.limit(batchSize);

	const recovered = await inSequence(stranded, ({ id, runId }) => recoverExecution({ executionId: id, runId }));

	return {
		expanded: dispatched.expanded,
		recovered: recovered.filter(Boolean).length,
		started: dispatched.started + restarted.filter(Boolean).length,
	};
};

export const runEventRetention = () =>
	deleteInBatches({
		batchSize: retentionBatchSize,
		deleteBatch: async () => {
			const expired = db
				.select({ id: events.id })
				.from(events)
				.where(
					and(
						lt(events.recordedAt, sql`now() - interval '1 day'`),
						notExists(
							db
								.select({ id: eventExecutions.id })
								.from(eventExecutions)
								.where(
									and(
										eq(eventExecutions.eventId, events.id),
										inArray(eventExecutions.state, ["queued", "running", "retry_wait"])
									)
								)
						),
						notExists(
							db
								.select({ eventId: eventDispatches.eventId })
								.from(eventDispatches)
								.where(
									and(
										eq(eventDispatches.eventId, events.id),
										isNull(eventDispatches.expandedAt),
										lt(eventDispatches.attempts, maxExpansionAttempts)
									)
								)
						)
					)
				)
				.limit(retentionBatchSize);

			const deleted = await db.delete(events).where(inArray(events.id, expired)).returning({ id: events.id });

			return deleted.length;
		},
	});
