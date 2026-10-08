import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

import { contactMessages, contacts, db, members, organizations, users } from "@starter/db";

import { cleanupTestActors } from "../helpers/db";

const { evaluateDecision } = vi.hoisted(() => ({ evaluateDecision: vi.fn() }));

vi.mock("../../src/ai/decisions", () => ({ evaluateDecision }));

import {
	contactCreateSchema,
	contactUpdateSchema,
	updateContact,
	deleteContact,
	contactListInputSchema,
	createContact,
	getContact,
	getContactMessage,
	getContactInquirySummary,
	listContacts,
	listContactMessages,
	triageContactMessage,
	type ContactActor,
} from "../../src/services/contacts";

const cleanupIds: Array<string> = [];

const createActor = async (): Promise<ContactActor> => {
	const id = randomUUID();
	await db.insert(organizations).values({ id, name: "Contacts test", slug: id });
	await db.insert(users).values({ email: `${id}@example.com`, id, name: "Contact teammate" });
	await db.insert(members).values({ id, organizationId: id, role: "owner", userId: id });
	cleanupIds.push(id);

	return { organizationId: id, userId: id };
};

const addContact = (actor: ContactActor, name = "Ada", email: string | null = null) =>
	createContact({ actor, input: { email, name, phone: null } });

const addMessage = async (contactId: string, message: string) => {
	const id = randomUUID();
	await db.insert(contactMessages).values({ contactId, id, message, sectionId: randomUUID(), senderName: "Ada" });

	return id;
};

afterEach(async () => {
	await cleanupTestActors(cleanupIds);
});

describe("Contacts", () => {
	it("shows each contact's latest message and scopes message details to its owner", async () => {
		const actor = await createActor();
		const other = await createActor();
		const contact = await addContact(actor);
		const otherContact = await addContact(other);
		const firstId = await addMessage(contact.id, "First message");
		const latestId = await addMessage(contact.id, "Latest message");
		await db
			.update(contactMessages)
			.set({ createdAt: "2026-01-01T00:00:00Z" })
			.where(eq(contactMessages.id, firstId));
		const otherId = await addMessage(otherContact.id, "Private message");
		const [listed] = (await listContacts({ actor, input: {} })).data;
		expect(listed?.latestMessage).toEqual({ id: latestId, message: "Latest message" });
		expect(await getContactMessage({ actor, contactId: contact.id, messageId: latestId })).toMatchObject({
			id: latestId,
			message: "Latest message",
		});
		await expect(getContactMessage({ actor, contactId: contact.id, messageId: otherId })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		await expect(
			getContactMessage({ actor: other, contactId: contact.id, messageId: latestId })
		).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
	});
	it("truncates the latest message preview in lists but not in the message read", async () => {
		const actor = await createActor();
		const contact = await addContact(actor);
		const messageId = await addMessage(contact.id, "x".repeat(1000));
		const [listed] = (await listContacts({ actor, input: {} })).data;
		expect(listed?.latestMessage?.message).toHaveLength(240);
		expect((await getContactMessage({ actor, contactId: contact.id, messageId })).message).toHaveLength(1000);
	});
	it("summarizes bounded non-spam inquiries within the current organization", async () => {
		const actor = await createActor();
		const other = await createActor();
		const contact = await addContact(actor);
		const otherContact = await addContact(other);
		const recent = new Date(Date.now() - 86_400_000).toISOString();
		const old = new Date(Date.now() - 40 * 86_400_000).toISOString();
		const unknownId = randomUUID();
		await db.insert(contactMessages).values([
			{
				contactId: contact.id,
				createdAt: recent,
				id: unknownId,
				message: "a".repeat(700),
				sectionId: randomUUID(),
				senderName: "Ada",
			},
			{
				contactId: contact.id,
				createdAt: recent,
				message: "The service is down",
				sectionId: randomUUID(),
				senderName: "Ada",
				triageCategory: "support",
				triageUrgency: "timeSensitive",
			},
			{
				contactId: contact.id,
				message: "Buy now",
				sectionId: randomUUID(),
				senderName: "Ada",
				spamFlag: true,
				triageCategory: "sales",
			},
			{
				contactId: contact.id,
				createdAt: old,
				message: "Old feedback",
				sectionId: randomUUID(),
				senderName: "Ada",
				triageCategory: "feedback",
			},
			{
				contactId: otherContact.id,
				message: "Another organization",
				sectionId: randomUUID(),
				senderName: "Other",
				triageCategory: "support",
			},
		]);
		const summary = await getContactInquirySummary({ actor, input: {} });
		expect(summary.total).toBe(2);
		expect(summary.counts).toEqual(
			expect.arrayContaining([
				{ category: "support", count: 1, urgency: "timeSensitive" },
				{ category: "unknown", count: 1, urgency: "unknown" },
			])
		);
		expect(summary.samples.map(({ message }) => message)).toEqual(
			expect.arrayContaining(["a".repeat(500), "The service is down"])
		);
		expect(summary.samples.find(({ id }) => id === unknownId)?.message).toHaveLength(500);
		expect((await getContactInquirySummary({ actor, input: { days: 60 } })).total).toBe(3);
		expect((await getContactInquirySummary({ actor: other, input: {} })).total).toBe(1);
		await db.delete(members).where(eq(members.id, actor.userId));
		await expect(getContactInquirySummary({ actor, input: {} })).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("triages only a current writer's contact message without changing its content", async () => {
		const actor = await createActor();
		const other = await createActor();
		const contact = await addContact(actor);
		const retained = await addContact(actor, "Grace");
		const messageId = randomUUID();
		await db.insert(contactMessages).values({
			contactId: contact.id,
			id: messageId,
			message: "أريد حجز موعد غداً",
			sectionId: randomUUID(),
			senderName: "Ada",
		});
		evaluateDecision.mockReset();
		evaluateDecision.mockResolvedValue({
			answers: {
				category: { choice: "booking" },
				spam: { probability: 0.1 },
				urgency: { choice: "timeSensitive" },
			},
		});
		const input = { contactId: contact.id, messageId };
		await expect(triageContactMessage({ actor: other, input })).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(
			triageContactMessage({ actor, input: { ...input, contactId: retained.id } })
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect(evaluateDecision).not.toHaveBeenCalled();
		await db.update(members).set({ role: "member" }).where(eq(members.id, actor.userId));
		await expect(triageContactMessage({ actor, input })).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(evaluateDecision).not.toHaveBeenCalled();
		await db.update(members).set({ role: "admin" }).where(eq(members.id, actor.userId));
		await expect(triageContactMessage({ actor, input })).resolves.toEqual({
			category: "booking",
			status: "suggested",
			urgency: "timeSensitive",
		});
		expect(evaluateDecision).toHaveBeenCalledWith(
			expect.objectContaining({
				memoize: true,
				state: { message: "أريد حجز موعد غداً", received: "today" },
			})
		);
		evaluateDecision.mockResolvedValue(null);
		await expect(triageContactMessage({ actor, input })).resolves.toEqual({
			category: "unknown",
			status: "unavailable",
			urgency: "unknown",
		});
		const [persisted] = await db.select().from(contactMessages).where(eq(contactMessages.id, messageId));
		expect(persisted).toMatchObject({
			message: "أريد حجز موعد غداً",
			spamFlag: false,
			triageCategory: "booking",
			triageUrgency: "timeSensitive",
		});
		expect(persisted?.triagedAt).not.toBeNull();
		await db.delete(members).where(eq(members.id, actor.userId));
		await expect(triageContactMessage({ actor, input })).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(evaluateDecision).toHaveBeenCalledTimes(2);
	});
	it("requires an identity and rejects removed CRM fields", () => {
		expect(contactCreateSchema.safeParse({ email: null, name: " ", phone: null }).success).toBe(false);
		expect(contactCreateSchema.safeParse({ email: null, name: "Ada", phone: null, status: "lead" }).success).toBe(
			false
		);
		expect(contactListInputSchema.safeParse({ filters: { contactMethod: ["sms"] } }).success).toBe(false);
		expect(contactListInputSchema.safeParse({ filters: { onlySpam: "yes" } }).success).toBe(false);
		expect(contactListInputSchema.safeParse({ filters: { triageCategory: ["junk"] } }).success).toBe(false);
	});

	it("persists background triage, flags spam only at high confidence and filters contacts by message triage", async () => {
		const actor = await createActor();
		const booking = await addContact(actor, "Booking");
		const junk = await addContact(actor, "Junk");
		const quiet = await addContact(actor, "Quiet");
		const bookingMessage = await addMessage(booking.id, "Can I book Friday?");
		const junkMessage = await addMessage(junk.id, "BUY NOW");
		const quietMessage = await addMessage(quiet.id, "Hello");
		evaluateDecision.mockReset();
		evaluateDecision.mockResolvedValueOnce({
			answers: { category: { choice: "booking" }, spam: { probability: 0.79 }, urgency: { choice: "routine" } },
		});
		await triageContactMessage({
			input: { contactId: booking.id, messageId: bookingMessage },
			policy: "background",
		});
		evaluateDecision.mockResolvedValueOnce({
			answers: { category: { choice: "other" }, spam: { probability: 0.8 }, urgency: { choice: "routine" } },
		});
		await triageContactMessage({ input: { contactId: junk.id, messageId: junkMessage }, policy: "background" });
		evaluateDecision.mockResolvedValueOnce(null);
		await triageContactMessage({ input: { contactId: quiet.id, messageId: quietMessage }, policy: "background" });
		await expect(
			triageContactMessage({ input: { contactId: quiet.id, messageId: bookingMessage }, policy: "background" })
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect(evaluateDecision).toHaveBeenCalledTimes(3);
		expect(evaluateDecision).toHaveBeenCalledWith(
			expect.objectContaining({
				memoize: true,
				policy: "background",
				questions: expect.objectContaining({ spam: expect.objectContaining({ type: "boolean" }) }),
				state: { message: "BUY NOW", received: "today" },
			})
		);

		const messagesOf = async (contactId: string) =>
			(await listContactMessages({ actor, input: { contactId, cursor: null } })).data;

		expect(await messagesOf(booking.id)).toEqual([
			expect.objectContaining({
				spamFlag: false,
				triageCategory: "booking",
				triagedAt: expect.any(String),
				triageUrgency: "routine",
			}),
		]);
		expect(await messagesOf(junk.id)).toEqual([
			expect.objectContaining({ spamFlag: true, triageCategory: "other" }),
		]);
		expect(await messagesOf(quiet.id)).toEqual([
			expect.objectContaining({ spamFlag: false, triageCategory: null, triagedAt: null, triageUrgency: null }),
		]);

		const listNames = async (filters: z.input<typeof contactListInputSchema>["filters"]) =>
			(await listContacts({ actor, input: { filters } })).data.map((contact) => contact.name).toSorted();

		expect(await listNames({})).toEqual(["Booking", "Junk", "Quiet"]);
		expect(await listNames({ triageCategory: ["booking"] })).toEqual(["Booking"]);
		expect(await listNames({ triageCategory: ["booking", "other"] })).toEqual(["Booking", "Junk"]);
		expect(await listNames({ onlySpam: true })).toEqual(["Junk"]);
		expect(await listNames({ onlySpam: true, triageCategory: ["booking"] })).toEqual([]);
	});

	it("filters contact methods and missing details with stable group semantics", async () => {
		const actor = await createActor();
		await createContact({
			actor,
			input: { email: "ada@example.com", name: "Ada", phone: null },
		});
		await createContact({
			actor,
			input: { email: null, name: null, phone: "+12025550123" },
		});
		await createContact({
			actor,
			input: { email: null, name: "Grace", phone: null },
		});

		const listNames = async (filters: {
			contactMethod?: Array<"email" | "phone">;
			missing?: Array<"email" | "name" | "phone">;
		}) =>
			(await listContacts({ actor, input: { filters } })).data
				.map((contact) => contact.name)
				.toSorted((left, right) => (left ?? "").localeCompare(right ?? ""));

		expect(await listNames({ contactMethod: ["email"] })).toEqual(["Ada"]);
		expect(await listNames({ contactMethod: ["email", "phone"] })).toEqual([null, "Ada"]);
		expect(await listNames({ contactMethod: ["email"], missing: ["phone"] })).toEqual(["Ada"]);
		expect(await listNames({ missing: ["email", "phone"] })).toEqual([null, "Ada", "Grace"]);
	});

	it("creates normalized contacts with database-owned IDs", async () => {
		const actor = await createActor();
		const input = { email: " ADA@example.com ", name: " Ada ", phone: null };
		const first = await createContact({ actor, input });
		expect(first).toMatchObject({ email: "ada@example.com", name: "Ada" });
		expect(contactCreateSchema.safeParse({ ...input, id: first.id }).success).toBe(false);
		expect(Object.keys(first).toSorted()).toEqual(["createdAt", "email", "id", "name", "phone"]);
		await expect(createContact({ actor, input })).rejects.toMatchObject({ code: "CONFLICT" });
		const second = await addContact(actor, "Grace");
		expect(first.id).not.toBe(second.id);
		expect((await listContacts({ actor, input: {} })).data).toHaveLength(2);
	});

	it("enforces tenant email identity under concurrent creation and permits phone-only contacts", async () => {
		const actor = await createActor();
		const other = await createActor();

		const results = await Promise.allSettled([
			addContact(actor, "Ada", "ADA@example.com"),
			addContact(actor, "Duplicate", "ada@example.com"),
		]);

		expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
		await expect(addContact(other, "Ada", "ada@example.com")).resolves.toMatchObject({ email: "ada@example.com" });
		await expect(
			createContact({ actor, input: { email: null, name: null, phone: "+12025550123" } })
		).resolves.toMatchObject({ name: null, phone: "+12025550123" });
	});

	it("isolates contacts and rechecks revoked membership", async () => {
		const actor = await createActor();
		const other = await createActor();
		const contact = await addContact(actor);
		await expect(getContact({ actor: other, contactId: contact.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect((await listContacts({ actor: other, input: {} })).data).toEqual([]);
		await db.delete(members).where(eq(members.id, actor.userId));
		await expect(listContacts({ actor, input: {} })).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(addContact(actor)).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("updates normalized fields, clears optional values and preserves creation date", async () => {
		const actor = await createActor();
		const contact = await addContact(actor, "Ada", "ada@example.com");

		const updated = await updateContact({
			actor,
			input: { contactId: contact.id, email: " GRACE@example.com ", name: " Grace ", phone: " +12025550123 " },
		});

		expect(updated).toEqual({ ...contact, email: "grace@example.com", name: "Grace", phone: "+12025550123" });

		const cleared = await updateContact({
			actor,
			input: { contactId: contact.id, email: null, name: "  ", phone: "+12025550123" },
		});

		expect(cleared).toMatchObject({ email: null, name: null });
		expect(
			contactUpdateSchema.safeParse({ contactId: contact.id, email: null, name: " ", phone: null }).success
		).toBe(false);
		expect((await listContacts({ actor, input: { search: "grace" } })).data).toEqual([]);
	});

	it("rejects conflicting email updates without changing the contact", async () => {
		const actor = await createActor();
		const contact = await addContact(actor, "Ada", "ada@example.com");
		await addContact(actor, "Grace", "grace@example.com");
		await expect(
			updateContact({
				actor,
				input: { contactId: contact.id, email: " GRACE@example.com ", name: "Changed", phone: null },
			})
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(await getContact({ actor, contactId: contact.id })).toEqual(contact);
	});

	it("scopes updates and deletes to the organization and requires current membership", async () => {
		const actor = await createActor();
		const other = await createActor();
		const contact = await addContact(actor);
		const input = { contactId: contact.id, email: null, name: "Changed", phone: null };
		await expect(updateContact({ actor: other, input })).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(deleteContact({ actor: other, contactId: contact.id })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		await db.delete(members).where(eq(members.id, actor.userId));
		await expect(updateContact({ actor, input })).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(deleteContact({ actor, contactId: contact.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("deletes the selected contact and leaves other contacts intact", async () => {
		const actor = await createActor();
		const contact = await addContact(actor);
		const retained = await addContact(actor, "Grace");
		expect(await deleteContact({ actor, contactId: contact.id })).toEqual({ id: contact.id });
		expect((await listContacts({ actor, input: {} })).data).toEqual([{ ...retained, latestMessage: null }]);
		await expect(getContact({ actor, contactId: contact.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(deleteContact({ actor, contactId: contact.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("paginates tied timestamps without duplicates, sorts by column and searches by prefix", async () => {
		const actor = await createActor();
		await db.insert(contacts).values(
			Array.from({ length: 55 }, (_, index) => ({
				createdAt: "2026-09-01T12:00:00Z",
				name: `Contact ${index}`,
				organizationId: actor.organizationId,
			}))
		);
		const first = await listContacts({ actor, input: {} });
		expect(first.data).toHaveLength(50);
		expect(first.meta).toEqual({ cursor: "50", totalData: 55, totalPages: 2 });
		const next = await listContacts({ actor, input: { cursor: first.meta.cursor } });
		expect(next.data).toHaveLength(5);
		expect(next.meta.cursor).toBeNull();
		expect(new Set([...first.data, ...next.data].map((item) => item.id)).size).toBe(55);
		await addContact(actor, "Ada Lovelace", "ada.lovelace@example.com");
		await addContact(actor, "Zed", null);
		const byName = await listContacts({ actor, input: { order: "asc", pageSize: 1, sort: "name" } });
		expect(byName.data.map((item) => item.name)).toEqual(["Ada Lovelace"]);
		expect(byName.meta.totalData).toBe(57);

		const search = async (term: string) =>
			(await listContacts({ actor, input: { search: term } })).data.map((item) => item.name);

		expect(await search("a")).toEqual(["Ada Lovelace"]);
		expect(await search("ad")).toEqual(["Ada Lovelace"]);
		expect(await search("lovel")).toEqual(["Ada Lovelace"]);
		expect(await search("ada.lovelace@example.com")).toEqual(["Ada Lovelace"]);
		expect(await search("example")).toEqual(["Ada Lovelace"]);
		expect(await search("%_")).toHaveLength(50);
		expect(await search("nobody")).toEqual([]);
	});
});
