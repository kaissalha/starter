import { randomUUID } from "node:crypto";

import { eventDispatches, events, type EventActor, type EventSource, type Transaction } from "@starter/db";
import { log, serializeLogError } from "@starter/observability";
import { getBaseURL } from "@starter/utils";

import { eventCatalog, type EventDataFor, type EventType } from "./catalog";

export type AppendEventInput = {
	[Type in EventType]: {
		actor: EventActor;
		data: EventDataFor<Type>;
		subject: { id: string; revision?: string | null };
		type: Type;
	};
}[EventType];

export const appendEvents = async ({
	correlationId = randomUUID(),
	events: inputs,
	organizationId,
	source,
	transaction,
}: {
	correlationId?: string;
	events: Array<AppendEventInput>;
	organizationId: string;
	source: EventSource;
	transaction: Transaction;
}) => {
	if (inputs.length === 0) {
		return [];
	}

	const rows = inputs.map((input) => {
		const id = randomUUID();
		const definition = eventCatalog[input.type];

		return {
			actor: input.actor,
			correlationId,
			data: definition.data.parse(input.data),
			id,
			organizationId,
			producerKey: `${input.type}:${input.subject.id}:${input.subject.revision ?? "-"}`,
			rootEventId: id,
			source,
			subjectId: input.subject.id,
			subjectRevision: input.subject.revision ?? null,
			subjectType: definition.subjectType,
			type: input.type,
		};
	});

	const inserted = await transaction
		.insert(events)
		.values(rows)
		.onConflictDoNothing({ target: [events.organizationId, events.producerKey] })
		.returning({ id: events.id });

	if (inserted.length > 0) {
		await transaction.insert(eventDispatches).values(inserted.map(({ id }) => ({ eventId: id, organizationId })));
	}

	return inserted.map(({ id }) => id);
};

export const wakeEventDispatcher = async ({ eventIds }: { eventIds: Array<string> }) => {
	if (eventIds.length === 0) {
		return;
	}

	const secret = process.env.CRON_SECRET;

	if (!secret) {
		await log.warn({ eventIds, message: "CRON_SECRET is not set; events wait for the dispatcher cron" });

		return;
	}

	try {
		const response = await fetch(new URL("/api/events/dispatch", process.env.WEBAPP_URL ?? getBaseURL()), {
			body: JSON.stringify({ eventIds }),
			headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
			method: "POST",
			signal: AbortSignal.timeout(10_000),
		});

		if (!response.ok) {
			await log.warn({ eventIds, message: "Event dispatcher wake-up failed", status: response.status });
		}
	} catch (error) {
		await log.warn({ error: serializeLogError(error), eventIds, message: "Event dispatcher wake-up failed" });
	}
};
