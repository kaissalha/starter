import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { db, eventDispatches, eventExecutions, events } from "@starter/db";

import { cleanupTestActors, createTestTeam } from "../helpers/db";

vi.mock("../../src/services/events/catalog", async () => {
	const { z } = await import("zod");
	const eventCatalog = { "test.created": { data: z.looseObject({}), subjectType: "test" } };

	return { eventCatalog, isEventType: (type: string) => type in eventCatalog };
});

const { projectNotificationEvent } = vi.hoisted(() => ({
	projectNotificationEvent: vi.fn(async () => ({ code: "not_applicable", state: "skipped" as const })),
}));

vi.mock("../../src/services/notifications/projector", () => ({ projectNotificationEvent }));

const workflow = vi.hoisted(() => ({
	cancel: vi.fn(async () => undefined),
	start: vi.fn(async () => ({ runId: "started-run" })),
	status: "running",
}));

vi.mock("workflow/api", () => ({
	getRun: () => ({
		cancel: workflow.cancel,
		exists: Promise.resolve(true),
		status: Promise.resolve(workflow.status),
	}),
	start: workflow.start,
}));

import { appendEvents } from "../../src/services/events/append";
import { dispatchEvents } from "../../src/services/events/dispatch";
import { claimEventExecution, continueEventExecution } from "../../src/services/events/executions";

const cleanupIds: Array<string> = [];

const createActor = async () => (await createTestTeam({ cleanupIds, name: "Events test" })).owner;

const appendTestEvent = ({ organizationId }: { organizationId: string }) =>
	db.transaction((transaction) =>
		appendEvents({
			events: [{ actor: { type: "system" }, data: {}, subject: { id: randomUUID() }, type: "test.created" }],
			organizationId,
			source: "system",
			transaction,
		})
	);

const createExecution = async (consumerKey = "builtin:notifications") => {
	const actor = await createActor();
	const [eventId = ""] = await appendTestEvent({ organizationId: actor.organizationId });

	const [execution] = await db
		.insert(eventExecutions)
		.values({ consumerKey, consumerKind: "builtin", eventId, organizationId: actor.organizationId })
		.returning({ id: eventExecutions.id });

	return execution?.id ?? "";
};

const findExecution = async (executionId: string) => {
	const [execution] = await db.select().from(eventExecutions).where(eq(eventExecutions.id, executionId));

	return execution;
};

const appendUnexpandedEvent = async (patch?: Partial<typeof eventDispatches.$inferInsert>) => {
	const actor = await createActor();
	const eventIds = await appendTestEvent({ organizationId: actor.organizationId });
	const eventId = eventIds[0] ?? "";

	if (patch) {
		await db.update(eventDispatches).set(patch).where(eq(eventDispatches.eventId, eventId));
	}

	return { actor, eventId, eventIds };
};

const findDispatch = async (eventId: string) => {
	const [dispatch] = await db.select().from(eventDispatches).where(eq(eventDispatches.eventId, eventId));

	return dispatch;
};

afterEach(async () => {
	projectNotificationEvent.mockClear();
	workflow.start.mockClear();
	workflow.cancel.mockClear();
	workflow.status = "running";
	await cleanupTestActors(cleanupIds);
});

describe("event recording", () => {
	it("records the event with its subject and a pending dispatch", async () => {
		const actor = await createActor();
		const [eventId] = await appendTestEvent({ organizationId: actor.organizationId });

		const recorded = await db.select().from(events).where(eq(events.organizationId, actor.organizationId));
		expect(recorded).toHaveLength(1);
		expect(recorded[0]).toMatchObject({ id: eventId, source: "system", subjectType: "test", type: "test.created" });
		expect(await findDispatch(eventId ?? "")).toMatchObject({
			expandedAt: null,
			organizationId: actor.organizationId,
		});
	});
});

describe("event dispatch", () => {
	it("expands each event once under concurrent dispatchers", async () => {
		const { eventId, eventIds } = await appendUnexpandedEvent();
		const results = await Promise.all([dispatchEvents({ eventIds }), dispatchEvents({ eventIds })]);

		expect(results.map(({ expanded }) => expanded).toSorted()).toEqual([0, 1]);
		expect((await findDispatch(eventId))?.expandedAt).toBeTruthy();
	});

	it("fences each execution to the run that claimed it", async () => {
		const executionId = await createExecution();

		expect(await claimEventExecution({ executionId, runId: "first-run" })).toEqual({ status: "run" });
		expect(await claimEventExecution({ executionId, runId: "second-run" })).toEqual({ status: "done" });
		expect(await continueEventExecution({ executionId, runId: "second-run" })).toEqual({ status: "done" });
		expect(await continueEventExecution({ executionId, runId: "first-run" })).toEqual({ status: "done" });

		expect(await findExecution(executionId)).toMatchObject({
			attemptCount: 1,
			outcomeCode: "not_applicable",
			state: "skipped",
		});
		expect(projectNotificationEvent).toHaveBeenCalledOnce();
	});

	it("recovers executions whose run passed its deadline", async () => {
		const executionId = await createExecution();
		await claimEventExecution({ executionId, runId: "lost-run" });
		await db
			.update(eventExecutions)
			.set({ expectedBy: new Date(Date.now() - 60_000).toISOString() })
			.where(eq(eventExecutions.id, executionId));

		const result = await dispatchEvents();

		expect(result.recovered).toBeGreaterThanOrEqual(1);
		expect(workflow.cancel).toHaveBeenCalled();
		expect(workflow.start).toHaveBeenCalledWith(expect.anything(), [executionId]);
		const recovered = await findExecution(executionId);
		expect(recovered).toMatchObject({ state: "queued", workflowRunId: null });
		expect(recovered?.startRequestedAt).toBeTruthy();
	});

	it("retries a failed consumer with backoff and records the attempt", async () => {
		const executionId = await createExecution();
		projectNotificationEvent.mockRejectedValueOnce(new Error("Projection failed"));

		await claimEventExecution({ executionId, runId: "retry-run" });
		const step = await continueEventExecution({ executionId, runId: "retry-run" });

		expect(step).toMatchObject({ status: "wait" });
		const waiting = await findExecution(executionId);
		expect(waiting).toMatchObject({ attemptCount: 1, outcomeCode: "attempt_failed", state: "retry_wait" });
		expect(waiting?.nextAttemptAt).toBeTruthy();
	});

	it("keeps events of an unknown type unexpanded with backoff", async () => {
		const { actor, eventId, eventIds } = await appendUnexpandedEvent();
		await db.update(events).set({ type: "future.unknown" }).where(eq(events.id, eventId));

		const first = await dispatchEvents({ eventIds });

		expect(first.expanded).toBe(0);
		const deferred = await findDispatch(eventId);
		expect(deferred).toMatchObject({ attempts: 1, expandedAt: null, lastErrorCode: "unknown_event_type" });
		expect(Date.parse(deferred?.availableAt ?? "")).toBeGreaterThan(Date.now());

		await db.update(events).set({ type: "test.created" }).where(eq(events.id, eventId));
		await db
			.update(eventDispatches)
			.set({ availableAt: sql`now() - interval '1 minute'` })
			.where(eq(eventDispatches.eventId, eventId));
		const second = await dispatchEvents({ eventIds });

		expect(second.expanded).toBe(1);
		expect(
			await db.select().from(eventExecutions).where(eq(eventExecutions.organizationId, actor.organizationId))
		).toHaveLength(0);
	});

	it("leaves dead-lettered events out of the sweep", async () => {
		const { eventId } = await appendUnexpandedEvent({
			attempts: 24,
			availableAt: new Date(Date.now() - 60_000).toISOString(),
		});

		await dispatchEvents();

		expect(await findDispatch(eventId)).toMatchObject({ attempts: 24, expandedAt: null });
	});

	it("retries an execution whose consumer is unknown to this deployment", async () => {
		const executionId = await createExecution("builtin:future");

		await claimEventExecution({ executionId, runId: "future-run" });
		const step = await continueEventExecution({ executionId, runId: "future-run" });

		expect(step).toMatchObject({ status: "wait" });
		expect(await findExecution(executionId)).toMatchObject({
			attemptCount: 1,
			outcomeCode: "unknown_consumer",
			state: "retry_wait",
		});

		const last = await Array.from({ length: 4 }).reduce<ReturnType<typeof continueEventExecution>>(
			async (previous) => {
				await previous;

				return continueEventExecution({ executionId, runId: "future-run" });
			},
			continueEventExecution({ executionId, runId: "future-run" })
		);

		expect(last).toEqual({ status: "done" });
		expect(await findExecution(executionId)).toMatchObject({ outcomeCode: "unknown_consumer", state: "failed" });
	});
});
