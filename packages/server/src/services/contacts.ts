import { waitUntil } from "@vercel/functions";
import { and, count, desc, eq, exists, gte, inArray, isNotNull, isNull, lte, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import {
	addFullTextSearch,
	addDataTableFilters,
	contactMessages,
	contactMessageTriageCategories,
	contactMessageTriageUrgencies,
	contacts,
	db,
	isUniqueViolation,
	members,
	queryWithPagination,
	type EventSource,
	type Transaction,
	withOrderBy,
} from "@starter/db";

import { evaluateDecision, type DecisionPolicy } from "../ai/decisions";
import {
	contactSpamInstructions,
	contactTriageCategories,
	contactTriageInstructions,
	contactTriageUrgencies,
} from "../ai/prompts";
import { contactFieldFiltersSchema } from "../contracts";
import { hasOrganizationPermission, type OrganizationPermission } from "../utils/permissions";
import { appendEvents, wakeEventDispatcher } from "./events/append";
import { contactEventFieldSchema } from "./events/catalog";

export const contactSchema = z
	.strictObject({
		createdAt: z.string(),
		email: z.string().nullable(),
		id: z.uuid(),
		name: z.string().nullable(),
		phone: z.string().nullable(),
	})
	.meta({ id: "Contact" });

export type Contact = z.infer<typeof contactSchema>;

export type ContactActor = { organizationId: string; userId: string };

const latestMessagePreviewLength = 240;

const contactFieldsSchema = z
	.strictObject({
		email: z.string().trim().toLowerCase().pipe(z.email().max(320)).nullable(),
		name: z.string().trim().max(500).nullable(),
		phone: z.string().trim().max(100).nullable(),
	})
	.refine((input) => Boolean(input.name || input.email || input.phone), { message: "Enter a name, email or phone." });

export const contactCreateSchema = contactFieldsSchema.meta({ id: "CreateContact" });

export const contactUpdateSchema = contactFieldsSchema
	.safeExtend({ contactId: z.uuid() })
	.meta({ id: "UpdateContact" });

export const contactListInputSchema = z
	.strictObject({
		cursor: z.string().max(16).nullable().default(null),
		filters: contactFieldFiltersSchema
			.extend({
				onlySpam: z.boolean().optional(),
				triageCategory: z.array(z.enum(contactMessageTriageCategories)).max(6).optional(),
			})
			.default({}),
		order: z.enum(["asc", "desc"]).default("desc"),
		pageSize: z.int().min(1).max(100).default(50),
		search: z.string().trim().max(200).default(""),
		sort: z.enum(["createdAt", "email", "name", "phone"]).default("createdAt"),
	})
	.meta({ id: "ListContactsInput" });

export const contactListResultSchema = z
	.strictObject({
		data: z.array(
			contactSchema.extend({
				latestMessage: z
					.strictObject({ id: z.uuid(), message: z.string().max(latestMessagePreviewLength * 2) })
					.nullable(),
			})
		),
		meta: z.strictObject({ cursor: z.string().nullable(), totalData: z.number(), totalPages: z.number() }),
	})
	.meta({ id: "ListContactsResult" });

export const contactMessagesInputSchema = contactListInputSchema
	.pick({ cursor: true })
	.extend({ contactId: z.uuid() })
	.meta({ id: "ListContactMessagesInput" });

export const contactMessageSchema = z
	.strictObject({
		createdAt: z.string(),
		id: z.uuid(),
		message: z.string(),
		senderName: z.string(),
		senderPhone: z.string().nullable(),
		spamFlag: z.boolean(),
		triageCategory: z.enum(contactMessageTriageCategories).nullable(),
		triagedAt: z.string().nullable(),
		triageUrgency: z.enum(contactMessageTriageUrgencies).nullable(),
	})
	.meta({ id: "ContactMessage" });

export const contactMessagesResultSchema = contactListResultSchema
	.extend({ data: z.array(contactMessageSchema) })
	.meta({ id: "ListContactMessagesResult" });

export const contactMessageTriageInputSchema = z
	.strictObject({ contactId: z.uuid(), messageId: z.uuid() })
	.meta({ id: "ContactMessageTriageInput" });

export const contactMessageTriageSchema = z
	.strictObject({
		category: z.enum(contactMessageTriageCategories),
		status: z.enum(["suggested", "unavailable"]),
		urgency: z.enum(contactMessageTriageUrgencies),
	})
	.meta({ id: "ContactMessageTriage" });

export const contactInquirySummaryInputSchema = z
	.strictObject({ days: z.int().min(1).max(365).default(30) })
	.meta({ id: "ContactInquirySummaryInput" });

const selection = {
	createdAt: contacts.createdAt,
	email: contacts.email,
	id: contacts.id,
	name: contacts.name,
	phone: contacts.phone,
};

const messageSelection = {
	createdAt: contactMessages.createdAt,
	id: contactMessages.id,
	message: contactMessages.message,
	senderName: contactMessages.senderName,
	senderPhone: contactMessages.senderPhone,
	spamFlag: contactMessages.spamFlag,
	triageCategory: contactMessages.triageCategory,
	triagedAt: contactMessages.triagedAt,
	triageUrgency: contactMessages.triageUrgency,
};

export class ContactError extends Error {
	constructor(
		public readonly code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT",
		message: string
	) {
		super(message);
		this.name = "ContactError";
	}
}

const requireMember = async ({
	actor,
	permission = "read",
	transaction = db,
}: {
	actor: ContactActor;
	permission?: OrganizationPermission;
	transaction?: Transaction | typeof db;
}) => {
	const [member] = await transaction
		.select({ role: members.role })
		.from(members)
		.where(and(eq(members.userId, actor.userId), eq(members.organizationId, actor.organizationId)))
		.for("share")
		.limit(1);

	if (!member || !hasOrganizationPermission({ permission, role: member.role })) {
		throw new ContactError("FORBIDDEN", "You do not have permission to perform this action.");
	}
};

const appendContactEvent = ({
	actor,
	contactId,
	source,
	transaction,
	type,
}: {
	actor: ContactActor;
	contactId: string;
	source: EventSource;
	transaction: Transaction;
	type: "contact.created" | "contact.deleted";
}) =>
	appendEvents({
		events: [
			{ actor: { type: "user", userId: actor.userId }, data: { contactId }, subject: { id: contactId }, type },
		],
		organizationId: actor.organizationId,
		source,
		transaction,
	});

export const listContacts = async ({
	actor,
	input,
}: {
	actor: ContactActor;
	input: z.input<typeof contactListInputSchema>;
}) => {
	await requireMember({ actor });
	const { cursor, filters, order, pageSize, search, sort } = contactListInputSchema.parse(input);
	const whereConditions: Array<SQL> = [eq(contacts.organizationId, actor.organizationId)];
	addFullTextSearch({
		model: contacts,
		searchTerm: search,
		shortTermDocument: sql`COALESCE(${contacts.name}, '') || ' ' || COALESCE(translate(${contacts.email}, '@.', '  '), '') || ' ' || COALESCE(translate(${contacts.phone}, '+-().', '     '), '')`,
		whereConditions,
	});
	addDataTableFilters({
		conditions: {
			contactMethod: {
				email: isNotNull(contacts.email),
				phone: isNotNull(contacts.phone),
			},
			missing: {
				email: isNull(contacts.email),
				name: isNull(contacts.name),
				phone: isNull(contacts.phone),
			},
		},
		filters: {
			contactMethod: filters.contactMethod ?? [],
			missing: filters.missing ?? [],
		},
		whereConditions,
	});

	const hasMessageMatching = (condition: SQL) =>
		exists(
			db
				.select({ id: contactMessages.id })
				.from(contactMessages)
				.where(and(eq(contactMessages.contactId, contacts.id), condition))
		);

	if (filters.triageCategory?.length) {
		whereConditions.push(hasMessageMatching(inArray(contactMessages.triageCategory, filters.triageCategory)));
	}

	if (filters.onlySpam) {
		whereConditions.push(hasMessageMatching(eq(contactMessages.spamFlag, true)));
	}

	const whereCondition = and(...whereConditions);

	const query = db
		.select({
			...selection,
			latestMessage: sql<{ id: string; message: string } | null>`(
				select json_build_object('id', ${contactMessages.id}, 'message', left(${contactMessages.message}, ${latestMessagePreviewLength}))
				from ${contactMessages}
				where ${contactMessages.contactId} = ${contacts.id}
				order by ${contactMessages.createdAt} desc, ${contactMessages.id} desc
				limit 1
			)`,
		})
		.from(contacts)
		.where(whereCondition)
		.$dynamic();

	withOrderBy({ model: contacts, order, orderBy: sort, query, tieBreakers: [desc(contacts.id)] });

	return queryWithPagination({ cursor, model: contacts, pageSize, query, whereCondition });
};

export const getContact = async ({ actor, contactId }: { actor: ContactActor; contactId: string }) => {
	await requireMember({ actor });

	const [contact] = await db
		.select(selection)
		.from(contacts)
		.where(and(eq(contacts.organizationId, actor.organizationId), eq(contacts.id, contactId)))
		.limit(1);

	if (!contact) {
		throw new ContactError("NOT_FOUND", "Contact not found.");
	}

	return contact;
};

export const listContactMessages = async ({
	actor,
	input,
}: {
	actor: ContactActor;
	input: z.infer<typeof contactMessagesInputSchema>;
}) => {
	await getContact({ actor, contactId: input.contactId });
	const whereCondition = eq(contactMessages.contactId, input.contactId);

	const query = db
		.select(messageSelection)
		.from(contactMessages)
		.where(whereCondition)
		.orderBy(desc(contactMessages.createdAt), desc(contactMessages.id))
		.$dynamic();

	return queryWithPagination({ cursor: input.cursor, model: contactMessages, pageSize: 20, query, whereCondition });
};

export const getContactMessage = async ({
	actor,
	contactId,
	messageId,
}: {
	actor: ContactActor;
	contactId: string;
	messageId: string;
}) => {
	await getContact({ actor, contactId });

	const [message] = await db
		.select(messageSelection)
		.from(contactMessages)
		.where(and(eq(contactMessages.contactId, contactId), eq(contactMessages.id, messageId)))
		.limit(1);

	if (!message) {
		throw new ContactError("NOT_FOUND", "Contact message not found.");
	}

	return message;
};

export const getContactInquirySummary = async ({
	actor,
	input,
}: {
	actor: ContactActor;
	input: z.input<typeof contactInquirySummaryInputSchema>;
}) => {
	await requireMember({ actor });
	const { days } = contactInquirySummaryInputSchema.parse(input);
	const to = new Date().toISOString();
	const from = new Date(Date.parse(to) - days * 86_400_000).toISOString();

	const where = and(
		eq(contacts.organizationId, actor.organizationId),
		eq(contactMessages.spamFlag, false),
		gte(contactMessages.createdAt, from),
		lte(contactMessages.createdAt, to)
	);

	const category = sql<
		(typeof contactMessageTriageCategories)[number]
	>`coalesce(${contactMessages.triageCategory}, 'unknown')`;

	const urgency = sql<
		(typeof contactMessageTriageUrgencies)[number]
	>`coalesce(${contactMessages.triageUrgency}, 'unknown')`;

	const [counts, samples] = await Promise.all([
		db
			.select({ category, count: count(), urgency })
			.from(contactMessages)
			.innerJoin(contacts, eq(contactMessages.contactId, contacts.id))
			.where(where)
			.groupBy(category, urgency)
			.orderBy(category, urgency),
		db
			.select({
				category,
				contactId: contacts.id,
				createdAt: contactMessages.createdAt,
				id: contactMessages.id,
				message: contactMessages.message,
				senderName: contactMessages.senderName,
				urgency,
			})
			.from(contactMessages)
			.innerJoin(contacts, eq(contactMessages.contactId, contacts.id))
			.where(where)
			.orderBy(desc(contactMessages.createdAt), desc(contactMessages.id))
			.limit(10),
	]);

	return {
		counts,
		from,
		samples: samples.map(({ message, ...sample }) => ({ ...sample, message: message.slice(0, 500) })),
		to,
		total: counts.reduce((total, group) => total + group.count, 0),
	};
};

const describeContactMessageAge = (createdAt: string) => {
	const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86_400_000;

	if (ageDays < 1) {
		return "today";
	}

	return ageDays < 7 ? "thisWeek" : "olderThanAWeek";
};

const contactTriageQuestions = {
	category: { criteria: contactTriageCategories, instructions: contactTriageInstructions, type: "choice" },
	spam: { instructions: contactSpamInstructions, type: "boolean" },
	urgency: {
		criteria: contactTriageUrgencies,
		instructions: `${contactTriageInstructions} Choose timeSensitive only when the message itself states an explicit near-term deadline, appointment time, or an active service interruption. Do not compute dates; received describes how long ago the message arrived, and deadlines in a message received more than a week ago are likely past.`,
		type: "choice",
	},
} as const;

export const triageContactMessage = async ({
	abortSignal,
	actor,
	input,
	policy = "interactive",
	source = "dashboard",
}: {
	abortSignal?: AbortSignal;
	actor?: ContactActor;
	input: z.infer<typeof contactMessageTriageInputSchema>;
	policy?: DecisionPolicy;
	source?: EventSource;
}) => {
	if (actor) {
		await requireMember({ actor, permission: "write" });
		await getContact({ actor, contactId: input.contactId });
	}

	const [message] = await db
		.select({
			createdAt: contactMessages.createdAt,
			organizationId: contacts.organizationId,
			text: contactMessages.message,
		})
		.from(contactMessages)
		.innerJoin(contacts, eq(contacts.id, contactMessages.contactId))
		.where(and(eq(contactMessages.contactId, input.contactId), eq(contactMessages.id, input.messageId)))
		.limit(1);

	if (!message) {
		throw new ContactError("NOT_FOUND", "Contact message not found.");
	}

	const result = await evaluateDecision({
		abortSignal,
		functionId: "contact-message-triage",
		memoize: true,
		policy,
		questions: contactTriageQuestions,
		state: { message: message.text, received: describeContactMessageAge(message.createdAt) },
	});

	if (result) {
		const category = result.answers.category.choice;
		const spam = result.answers.spam.probability >= 0.8;
		const urgency = result.answers.urgency.choice;

		const eventIds = await db.transaction(async (transaction) => {
			const [saved] = await transaction
				.update(contactMessages)
				.set({ spamFlag: spam, triageCategory: category, triagedAt: sql`now()`, triageUrgency: urgency })
				.where(eq(contactMessages.id, input.messageId))
				.returning({ triagedAt: contactMessages.triagedAt });

			if (!saved?.triagedAt) {
				return [];
			}

			return appendEvents({
				events: [
					{
						actor: actor ? { type: "user", userId: actor.userId } : { type: "system" },
						data: { category, contactId: input.contactId, messageId: input.messageId, spam, urgency },
						subject: { id: input.messageId, revision: saved.triagedAt },
						type: "contact_message.triaged",
					},
				],
				organizationId: message.organizationId,
				source,
				transaction,
			});
		});

		waitUntil(wakeEventDispatcher({ eventIds }));
	}

	return contactMessageTriageSchema.parse({
		category: result?.answers.category.choice ?? "unknown",
		status: result ? "suggested" : "unavailable",
		urgency: result?.answers.urgency.choice ?? "unknown",
	});
};

export const createContact = async ({
	actor,
	input,
	source = "dashboard",
}: {
	actor: ContactActor;
	input: z.input<typeof contactCreateSchema>;
	source?: EventSource;
}) => {
	const parsed = contactCreateSchema.parse(input);
	const values = { ...parsed, name: parsed.name || null, phone: parsed.phone || null };

	const { created, eventIds } = await db.transaction(async (transaction) => {
		await requireMember({ actor, permission: "write", transaction });

		const [row] = await transaction
			.insert(contacts)
			.values({ ...values, organizationId: actor.organizationId })
			.onConflictDoNothing()
			.returning(selection);

		if (!row) {
			throw new ContactError("CONFLICT", "A contact with this email already exists.");
		}

		const ids = await appendContactEvent({
			actor,
			contactId: row.id,
			source,
			transaction,
			type: "contact.created",
		});

		return { created: row, eventIds: ids };
	});

	waitUntil(wakeEventDispatcher({ eventIds }));

	return created;
};

export const updateContact = async ({
	actor,
	input,
	source = "dashboard",
}: {
	actor: ContactActor;
	input: z.input<typeof contactUpdateSchema>;
	source?: EventSource;
}) => {
	const { contactId, ...parsed } = contactUpdateSchema.parse(input);
	const values = { ...parsed, name: parsed.name || null, phone: parsed.phone || null };

	try {
		const { eventIds, updated } = await db.transaction(async (transaction) => {
			await requireMember({ actor, permission: "write", transaction });
			const scope = and(eq(contacts.id, contactId), eq(contacts.organizationId, actor.organizationId));
			const [current] = await transaction.select(selection).from(contacts).where(scope).for("update").limit(1);

			if (!current) {
				throw new ContactError("NOT_FOUND", "Contact not found.");
			}

			const fields = contactEventFieldSchema.options.filter((field) => current[field] !== values[field]);

			if (fields.length === 0) {
				return { eventIds: [], updated: current };
			}

			const [row] = await transaction
				.update(contacts)
				.set({ ...values, updatedAt: sql`now()` })
				.where(scope)
				.returning({ ...selection, updatedAt: contacts.updatedAt });

			if (!row) {
				throw new ContactError("NOT_FOUND", "Contact not found.");
			}

			const { updatedAt, ...contact } = row;

			const ids = await appendEvents({
				events: [
					{
						actor: { type: "user", userId: actor.userId },
						data: { contactId, fields },
						subject: { id: contactId, revision: updatedAt },
						type: "contact.updated",
					},
				],
				organizationId: actor.organizationId,
				source,
				transaction,
			});

			return { eventIds: ids, updated: contact };
		});

		waitUntil(wakeEventDispatcher({ eventIds }));

		return updated;
	} catch (error) {
		if (error instanceof Error && isUniqueViolation({ error })) {
			throw new ContactError("CONFLICT", "A contact with this email already exists.");
		}

		throw error;
	}
};

export const deleteContact = async ({
	actor,
	contactId,
	source = "dashboard",
}: {
	actor: ContactActor;
	contactId: string;
	source?: EventSource;
}) => {
	const { deleted, eventIds } = await db.transaction(async (transaction) => {
		await requireMember({ actor, permission: "delete", transaction });

		const [row] = await transaction
			.delete(contacts)
			.where(and(eq(contacts.id, contactId), eq(contacts.organizationId, actor.organizationId)))
			.returning({ id: contacts.id });

		if (!row) {
			throw new ContactError("NOT_FOUND", "Contact not found.");
		}

		const ids = await appendContactEvent({
			actor,
			contactId: row.id,
			source,
			transaction,
			type: "contact.deleted",
		});

		return { deleted: row, eventIds: ids };
	});

	waitUntil(wakeEventDispatcher({ eventIds }));

	return deleted;
};
