import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contactMessages, db, eventDispatches, eventExecutions, events } from "@starter/db";

import { cleanupTestActors, createTestTeam, findEventExecutionId } from "../helpers/db";

const { evaluateDecision } = vi.hoisted(() => ({ evaluateDecision: vi.fn() }));

vi.mock("../../src/ai/decisions", () => ({ evaluateDecision }));

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

import { createContact, deleteContact, updateContact } from "../../src/services/contacts";
import { appendEvents } from "../../src/services/events/append";
import { dispatchEvents } from "../../src/services/events/dispatch";
import { claimEventExecution, continueEventExecution } from "../../src/services/events/executions";

const cleanupIds: Array<string> = [];

const createActor = async () => (await createTestTeam({ cleanupIds, name: "Events test" })).owner;

const listEvents = (organizationId: string) =>
	db.select().from(events).where(eq(events.organizationId, organizationId)).orderBy(events.recordedAt);

const appendMessageEvent = ({
	contactId = randomUUID(),
	messageId = randomUUID(),
	organizationId,
}: {
	contactId?: string;
	messageId?: string;
	organizationId: string;
}) =>
	db.transaction((transaction) =>
		appendEvents({
			events: [
				{
					actor: { type: "visitor" },
					data: { contactId, messageId, sectionId: randomUUID(), websiteId: randomUUID() },
					subject: { id: messageId },
					type: "contact_message.created",
				},
			],
			organizationId,
			source: "website",
			transaction,
		})
	);

const dispatchMessageEvent = async () => {
	const actor = await createActor();
	await dispatchEvents({ eventIds: await appendMessageEvent({ organizationId: actor.organizationId }) });

	return findEventExecutionId({ consumerKey: "builtin:notifications", organizationId: actor.organizationId });
};

afterEach(async () => {
	evaluateDecision.mockReset();
	workflow.start.mockClear();
	workflow.cancel.mockClear();
	workflow.status = "running";
	await cleanupTestActors(cleanupIds);
});

describe("event recording", () => {
	it("commits contact events with the change and never for a rejected write", async () => {
		const actor = await createActor();
		const contact = await createContact({ actor, input: { email: "ada@example.com", name: "Ada", phone: null } });
		await expect(
			createContact({ actor, input: { email: "ada@example.com", name: "Duplicate", phone: null } })
		).rejects.toMatchObject({ code: "CONFLICT" });

		const recorded = await listEvents(actor.organizationId);
		expect(recorded).toHaveLength(1);
		expect(recorded[0]).toMatchObject({
			actor: { type: "user", userId: actor.userId },
			data: { contactId: contact.id },
			source: "dashboard",
			subjectId: contact.id,
			subjectType: "contact",
			type: "contact.created",
		});

		const [dispatch] = await db
			.select()
			.from(eventDispatches)
			.where(eq(eventDispatches.eventId, recorded[0]?.id ?? ""));

		expect(dispatch).toMatchObject({ expandedAt: null, organizationId: actor.organizationId });
	});

	it("records updates only when a field changes, with the new revision", async () => {
		const actor = await createActor();
		const contact = await createContact({ actor, input: { email: null, name: "Ada", phone: null } });
		await updateContact({ actor, input: { contactId: contact.id, email: null, name: "Ada", phone: null } });
		expect((await listEvents(actor.organizationId)).map(({ type }) => type)).toEqual(["contact.created"]);

		await updateContact({
			actor,
			input: { contactId: contact.id, email: null, name: "Ada Lovelace", phone: null },
		});
		const updated = (await listEvents(actor.organizationId)).find(({ type }) => type === "contact.updated");
		expect(updated).toMatchObject({ data: { contactId: contact.id, fields: ["name"] } });
		expect(updated?.subjectRevision).toBeTruthy();

		await deleteContact({ actor, contactId: contact.id });
		expect((await listEvents(actor.organizationId)).map(({ type }) => type)).toEqual([
			"contact.created",
			"contact.updated",
			"contact.deleted",
		]);
	});
});

const findExecution = async (executionId: string) => {
	const [execution] = await db.select().from(eventExecutions).where(eq(eventExecutions.id, executionId));

	return execution;
};

const appendUnexpandedEvent = async (patch?: Partial<typeof eventDispatches.$inferInsert>) => {
	const actor = await createActor();
	const eventIds = await appendMessageEvent({ organizationId: actor.organizationId });
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

describe("event dispatch", () => {
	it("expands each event once under concurrent dispatchers and starts one run per execution", async () => {
		const actor = await createActor();
		const eventIds = await appendMessageEvent({ organizationId: actor.organizationId });
		const results = await Promise.all([dispatchEvents({ eventIds }), dispatchEvents({ eventIds })]);

		expect(results.map(({ expanded }) => expanded).toSorted()).toEqual([0, 1]);

		const executions = await db
			.select({ consumerKey: eventExecutions.consumerKey, id: eventExecutions.id })
			.from(eventExecutions)
			.where(eq(eventExecutions.organizationId, actor.organizationId));

		expect(executions.map(({ consumerKey }) => consumerKey).toSorted()).toEqual([
			"builtin:contact_triage",
			"builtin:notification_email",
			"builtin:notifications",
		]);
		expect(workflow.start).toHaveBeenCalledTimes(3);

		const [dispatch] = await db
			.select()
			.from(eventDispatches)
			.where(eq(eventDispatches.eventId, eventIds[0] ?? ""));

		expect(dispatch?.expandedAt).toBeTruthy();
	});

	it("fences each execution to the run that claimed it", async () => {
		const executionId = await dispatchMessageEvent();

		expect(await claimEventExecution({ executionId, runId: "first-run" })).toEqual({ status: "run" });
		expect(await claimEventExecution({ executionId, runId: "second-run" })).toEqual({ status: "done" });
		expect(await continueEventExecution({ executionId, runId: "second-run" })).toEqual({ status: "done" });
		expect(await continueEventExecution({ executionId, runId: "first-run" })).toEqual({ status: "done" });

		const [settled] = await db.select().from(eventExecutions).where(eq(eventExecutions.id, executionId));
		expect(settled).toMatchObject({ attemptCount: 1, outcomeCode: "subject_deleted", state: "skipped" });
	});

	it("recovers executions whose run passed its deadline", async () => {
		const executionId = await dispatchMessageEvent();
		await claimEventExecution({ executionId, runId: "lost-run" });
		await db
			.update(eventExecutions)
			.set({ expectedBy: new Date(Date.now() - 60_000).toISOString() })
			.where(eq(eventExecutions.id, executionId));
		workflow.start.mockClear();

		const result = await dispatchEvents();

		expect(result.recovered).toBeGreaterThanOrEqual(1);
		expect(workflow.cancel).toHaveBeenCalled();
		expect(workflow.start).toHaveBeenCalledWith(expect.anything(), [executionId]);
		const [recovered] = await db.select().from(eventExecutions).where(eq(eventExecutions.id, executionId));
		expect(recovered).toMatchObject({ state: "queued", workflowRunId: null });
		expect(recovered?.startRequestedAt).toBeTruthy();
	});

	it.each([
		[
			"retries a failed consumer with backoff and records the attempt",
			() => evaluateDecision.mockRejectedValueOnce(new Error("Gateway down")),
		],
		[
			"retries contact triage when the model returns no decision",
			() => evaluateDecision.mockResolvedValueOnce(null),
		],
	])("%s", async (_name, arrange) => {
		const actor = await createActor();
		const contact = await createContact({ actor, input: { email: null, name: "Ada", phone: null } });

		const [inserted] = await db
			.insert(contactMessages)
			.values({ contactId: contact.id, message: "Hello", sectionId: randomUUID(), senderName: "Ada" })
			.returning({ id: contactMessages.id });

		const messageId = inserted?.id ?? "";
		await dispatchEvents({
			eventIds: await appendMessageEvent({
				contactId: contact.id,
				messageId,
				organizationId: actor.organizationId,
			}),
		});

		const executionId = await findEventExecutionId({
			consumerKey: "builtin:contact_triage",
			organizationId: actor.organizationId,
		});

		arrange();

		await claimEventExecution({ executionId, runId: "triage-run" });
		const step = await continueEventExecution({ executionId, runId: "triage-run" });

		expect(step).toMatchObject({ status: "wait" });
		const waiting = await findExecution(executionId);
		expect(waiting).toMatchObject({ attemptCount: 1, outcomeCode: "attempt_failed", state: "retry_wait" });
		expect(waiting?.nextAttemptAt).toBeTruthy();
		const [message] = await db.select().from(contactMessages).where(eq(contactMessages.id, messageId));
		expect(message?.triagedAt).toBeNull();
	});

	it("keeps events of an unknown type unexpanded with backoff", async () => {
		const { actor, eventId, eventIds } = await appendUnexpandedEvent();
		await db.update(events).set({ type: "future.unknown" }).where(eq(events.id, eventId));

		const first = await dispatchEvents({ eventIds });

		expect(first.expanded).toBe(0);
		const deferred = await findDispatch(eventId);
		expect(deferred).toMatchObject({ attempts: 1, expandedAt: null, lastErrorCode: "unknown_event_type" });
		expect(Date.parse(deferred?.availableAt ?? "")).toBeGreaterThan(Date.now());

		const none = await db
			.select()
			.from(eventExecutions)
			.where(eq(eventExecutions.organizationId, actor.organizationId));

		expect(none).toHaveLength(0);

		await db.update(events).set({ type: "contact_message.created" }).where(eq(events.id, eventId));
		await db
			.update(eventDispatches)
			.set({ availableAt: sql`now() - interval '1 minute'` })
			.where(eq(eventDispatches.eventId, eventId));
		const second = await dispatchEvents({ eventIds });

		expect(second.expanded).toBe(1);

		const recovered = await db
			.select()
			.from(eventExecutions)
			.where(eq(eventExecutions.organizationId, actor.organizationId));

		expect(recovered).toHaveLength(3);
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
		const executionId = await dispatchMessageEvent();
		await db
			.update(eventExecutions)
			.set({ consumerKey: "builtin:future" })
			.where(eq(eventExecutions.id, executionId));

		await claimEventExecution({ executionId, runId: "future-run" });
		const step = await continueEventExecution({ executionId, runId: "future-run" });

		expect(step).toMatchObject({ status: "wait" });
		const waiting = await findExecution(executionId);
		expect(waiting).toMatchObject({ attemptCount: 1, outcomeCode: "unknown_consumer", state: "retry_wait" });

		const last = await Array.from({ length: 4 }).reduce<ReturnType<typeof continueEventExecution>>(
			async (previous) => {
				await previous;

				return continueEventExecution({ executionId, runId: "future-run" });
			},
			continueEventExecution({ executionId, runId: "future-run" })
		);

		expect(last).toEqual({ status: "done" });
		const failed = await findExecution(executionId);
		expect(failed).toMatchObject({ outcomeCode: "unknown_consumer", state: "failed" });
	});
});
