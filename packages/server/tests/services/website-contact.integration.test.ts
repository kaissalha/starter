import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	contactMessages,
	contacts,
	db,
	events,
	members,
	organizations,
	users,
	websites,
	websiteVersions,
} from "@starter/db";
import {
	contactFormContent,
	createWebsiteGenerationShell,
	instantiateSection,
	selectWebsiteGenerationProfile,
	websiteGenerationSectionDefinitions,
} from "@starter/infinite-website/generation";

const { evaluateDecision } = vi.hoisted(() => ({ evaluateDecision: vi.fn() }));

vi.mock("../../src/ai/decisions", () => ({ evaluateDecision }));

vi.mock("workflow/api", () => ({ getRun: vi.fn(), start: vi.fn(async () => ({ runId: "run" })) }));

import { createContact, deleteContact, listContactMessages } from "../../src/services/contacts";
import { dispatchEvents } from "../../src/services/events/dispatch";
import { claimEventExecution, continueEventExecution } from "../../src/services/events/executions";
import { submitWebsiteContact } from "../../src/services/websites/contact-submission";
import { splitPersistedWebsiteSite } from "../../src/services/websites/persistence";
import { findEventExecutionId } from "../helpers/db";

const cleanupIds: Array<string> = [];

const createWebsite = async () => {
	const id = randomUUID();
	cleanupIds.push(id);
	await db.insert(organizations).values({ id, name: "Contact form test", slug: id });
	await db.insert(users).values({ email: `${id}@example.com`, id, name: "Owner" });
	await db.insert(members).values({ id, organizationId: id, role: "owner", userId: id });
	const websiteId = randomUUID();
	const profile = selectWebsiteGenerationProfile({ businessType: "Design" });
	const brief = { location: "Toronto", name: "Test", schemaVersion: 1 as const, type: "Design" };

	const plan = {
		kind: "plan" as const,
		pages: (["home", "about", "services", "faq", "contact"] as const).map((pageKey) => ({
			description: pageKey,
			pageKey,
			title: pageKey,
		})),
		siteDescription: "Test contact form",
	};

	const snapshot = createWebsiteGenerationShell({
		brief,
		localizations: { byLocale: { ar: plan, en: plan }, defaultLocale: "en" },
		profile,
		websiteId,
	});

	const { document } = snapshot;
	const definition = websiteGenerationSectionDefinitions.find(({ pattern }) => pattern === "contact-form");

	if (!definition) {
		throw new Error("Contact form is missing from the catalog");
	}

	const form = instantiateSection({
		anchor: "contact-form",
		content: { ar: { copy: contactFormContent.ar }, en: { copy: contactFormContent.en } },
		createId: () => randomUUID(),
		defaultLocale: "en",
		definition,
		path: "/form",
	});

	document.structure.pages[0]?.sections.push(form.section);

	for (const locale of ["en", "ar"] as const) {
		const localized = document.content[locale];

		if (localized) {
			localized.sections[form.section.contentId] = { copy: contactFormContent[locale] };
		}
	}

	await db.insert(websites).values({
		brief: { location: "Toronto", name: "Test", schemaVersion: 1, type: "Design" },
		id: websiteId,
		locale: "en",
		organizationId: id,
	});

	const [version] = await db
		.insert(websiteVersions)
		.values({
			...splitPersistedWebsiteSite({
				site: {
					assetBindings: {},
					brand: snapshot.brand,
					document,
					schemaVersion: 1,
					templateId: profile.templateId,
				},
			}),
			publishedAt: new Date().toISOString(),
			version: 1,
			websiteId,
		})
		.returning({ id: websiteVersions.id });

	if (!version) {
		throw new Error("Missing version");
	}

	await db.update(websites).set({ publishedVersionId: version.id }).where(eq(websites.id, websiteId));

	return { actor: { organizationId: id, userId: id }, sectionId: form.section.id, websiteId };
};

afterEach(async () => {
	if (!cleanupIds.length) {
		return;
	}

	await db.delete(organizations).where(inArray(organizations.id, cleanupIds));
	await db.delete(users).where(inArray(users.id, cleanupIds));
	cleanupIds.length = 0;
});

const input = { email: " ADA@example.com ", message: "Please get in touch.", name: "Ada", phone: "" };

describe("website contact persistence", () => {
	it("reuses one contact under concurrent first submissions and preserves every message", async () => {
		const { actor, sectionId, websiteId } = await createWebsite();
		await expect(
			Promise.all(
				["First message", "Second message"].map((message) =>
					submitWebsiteContact({ input: { ...input, message, sectionId }, websiteId })
				)
			)
		).resolves.toEqual([true, true]);
		const saved = await db.select().from(contacts).where(eq(contacts.organizationId, actor.organizationId));
		expect(saved).toHaveLength(1);
		const contact = saved[0];

		if (!contact) {
			throw new Error("Missing contact");
		}

		expect(contact.email).toBe("ada@example.com");
		const messages = await listContactMessages({ actor, input: { contactId: contact.id, cursor: null } });
		expect(messages.data.map(({ message }) => message).toSorted()).toEqual(["First message", "Second message"]);
		await deleteContact({ actor, contactId: contact.id });
		expect(await db.select().from(contactMessages).where(eq(contactMessages.contactId, contact.id))).toEqual([]);
	});
	it("preserves curated contact details and paginates messages behind organization membership", async () => {
		const { actor, sectionId, websiteId } = await createWebsite();
		const other = await createWebsite();

		const contact = await createContact({
			actor,
			input: { email: "ada@example.com", name: "Curated name", phone: "+12025550123" },
		});

		await submitWebsiteContact({ input: { ...input, sectionId }, websiteId });
		const [saved] = await db.select().from(contacts).where(eq(contacts.id, contact.id));
		expect(saved).toMatchObject({ name: "Curated name", phone: "+12025550123" });
		await db.insert(contactMessages).values(
			Array.from({ length: 20 }, () => ({
				contactId: contact.id,
				message: "Follow up",
				sectionId,
				senderName: "Ada",
				websiteId,
			}))
		);
		const first = await listContactMessages({ actor, input: { contactId: contact.id, cursor: null } });
		expect(first.data).toHaveLength(20);

		const second = await listContactMessages({
			actor,
			input: { contactId: contact.id, cursor: first.meta.cursor },
		});

		expect(second.data).toHaveLength(1);
		expect(new Set([...first.data, ...second.data].map(({ id }) => id)).size).toBe(21);
		await expect(
			listContactMessages({ actor: other.actor, input: { contactId: contact.id, cursor: null } })
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		await db.delete(members).where(eq(members.id, actor.userId));
		await expect(
			listContactMessages({ actor, input: { contactId: contact.id, cursor: null } })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
	it("records submissions as events and triages them through the built-in reaction", async () => {
		const { actor, sectionId, websiteId } = await createWebsite();
		evaluateDecision.mockReset();
		evaluateDecision.mockResolvedValueOnce({
			answers: { category: { choice: "sales" }, spam: { probability: 0.9 }, urgency: { choice: "routine" } },
		});
		expect(await submitWebsiteContact({ input: { ...input, sectionId }, websiteId })).toBe(true);
		const recorded = await db.select().from(events).where(eq(events.organizationId, actor.organizationId));
		expect(recorded.map(({ type }) => type).toSorted()).toEqual(["contact.created", "contact_message.created"]);
		expect(new Set(recorded.map(({ correlationId }) => correlationId)).size).toBe(1);
		expect(
			recorded.every(({ actor: eventActor, source }) => eventActor.type === "visitor" && source === "website")
		).toBe(true);

		await dispatchEvents({ eventIds: recorded.map(({ id }) => id) });

		const executionId = await findEventExecutionId({
			consumerKey: "builtin:contact_triage",
			organizationId: actor.organizationId,
		});

		expect(await claimEventExecution({ executionId, runId: "triage-run" })).toEqual({ status: "run" });
		expect(await continueEventExecution({ executionId, runId: "triage-run" })).toEqual({ status: "done" });

		const [contact] = await db
			.select({ id: contacts.id })
			.from(contacts)
			.where(eq(contacts.organizationId, actor.organizationId));

		const [message] = await db
			.select()
			.from(contactMessages)
			.where(eq(contactMessages.contactId, contact?.id ?? ""));

		expect(message).toMatchObject({ spamFlag: true, triageCategory: "sales", triageUrgency: "routine" });
		expect(evaluateDecision).toHaveBeenCalledWith(
			expect.objectContaining({
				policy: "background",
				state: { message: "Please get in touch.", received: "today" },
			})
		);

		const triaged = await db
			.select({ actor: events.actor, data: events.data })
			.from(events)
			.where(and(eq(events.organizationId, actor.organizationId), eq(events.type, "contact_message.triaged")));

		expect(triaged).toEqual([
			{
				actor: { type: "system" },
				data: {
					category: "sales",
					contactId: contact?.id,
					messageId: message?.id,
					spam: true,
					urgency: "routine",
				},
			},
		]);

		expect(await submitWebsiteContact({ input: { ...input, message: "Second", sectionId }, websiteId })).toBe(true);

		const types = await db
			.select({ type: events.type })
			.from(events)
			.where(eq(events.organizationId, actor.organizationId));

		expect(types.filter(({ type }) => type === "contact.created")).toHaveLength(1);
		expect(types.filter(({ type }) => type === "contact_message.created")).toHaveLength(2);
	});
	it("acknowledges a repeated message without storing or announcing it again", async () => {
		const { actor, sectionId, websiteId } = await createWebsite();

		for (const message of [input.message, input.message, "A different question"]) {
			expect(await submitWebsiteContact({ input: { ...input, message, sectionId }, websiteId })).toBe(true);
		}

		const [contact] = await db
			.select({ id: contacts.id })
			.from(contacts)
			.where(eq(contacts.organizationId, actor.organizationId));

		const messages = await db
			.select({ message: contactMessages.message })
			.from(contactMessages)
			.where(eq(contactMessages.contactId, contact?.id ?? ""));

		expect(messages.map(({ message }) => message).toSorted()).toEqual([
			"A different question",
			"Please get in touch.",
		]);

		const recorded = await db
			.select({ type: events.type })
			.from(events)
			.where(eq(events.organizationId, actor.organizationId));

		expect(recorded.filter(({ type }) => type === "contact_message.created")).toHaveLength(2);
	});
	it("rejects foreign or unknown sections and unpublished websites without creating a contact", async () => {
		const first = await createWebsite();
		const second = await createWebsite();
		expect(
			await submitWebsiteContact({ input: { ...input, sectionId: second.sectionId }, websiteId: first.websiteId })
		).toBe(false);
		expect(
			await submitWebsiteContact({ input: { ...input, sectionId: randomUUID() }, websiteId: first.websiteId })
		).toBe(false);
		await db.update(websites).set({ publishedVersionId: null }).where(eq(websites.id, first.websiteId));
		expect(
			await submitWebsiteContact({ input: { ...input, sectionId: first.sectionId }, websiteId: first.websiteId })
		).toBe(false);
		expect(await db.select().from(contacts).where(eq(contacts.organizationId, first.actor.organizationId))).toEqual(
			[]
		);
	});
	it("rejects submissions to a suspended website until it is restored", async () => {
		const site = await createWebsite();
		await db.update(websites).set({ suspendedAt: new Date().toISOString() }).where(eq(websites.id, site.websiteId));
		expect(
			await submitWebsiteContact({ input: { ...input, sectionId: site.sectionId }, websiteId: site.websiteId })
		).toBe(false);
		expect(await db.select().from(contacts).where(eq(contacts.organizationId, site.actor.organizationId))).toEqual(
			[]
		);
		await db.update(websites).set({ suspendedAt: null }).where(eq(websites.id, site.websiteId));
		expect(
			await submitWebsiteContact({ input: { ...input, sectionId: site.sectionId }, websiteId: site.websiteId })
		).toBe(true);
	});
});
