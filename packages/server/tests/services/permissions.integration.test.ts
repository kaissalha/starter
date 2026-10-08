import { eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { db, members, organizations, users } from "@starter/db";
import { defaultLinkPageSectionAppearance } from "@starter/infinite-links/contracts";
import { createDefaultLinkPageDocument } from "@starter/infinite-links/document";

import { createContact, deleteContact, getContact, updateContact } from "../../src/services/contacts";
import { getLinkPage, saveLinkPage } from "../../src/services/link-pages";
import { requireOrganizationPermission } from "../../src/services/permissions";

const ids: Array<string> = [];

const createActor = async () => {
	const id = crypto.randomUUID();
	ids.push(id);
	await db.insert(organizations).values({ id, name: "Permission test", slug: id });
	await db.insert(users).values({ email: `${id}@example.com`, id, name: "Teammate" });
	await db.insert(members).values({ id, organizationId: id, role: "owner", userId: id });

	return { organizationId: id, userId: id };
};

afterEach(async () => {
	if (ids.length) {
		await db.delete(organizations).where(inArray(organizations.id, ids));
		await db.delete(users).where(inArray(users.id, ids));
		ids.length = 0;
	}
});

describe("live organization authorization", () => {
	it("applies role changes immediately to existing actors and rejects removed members", async () => {
		const actor = await createActor();
		const contact = await createContact({ actor, input: { email: null, name: "Ada", phone: null } });
		await db.update(members).set({ role: "admin" }).where(eq(members.userId, actor.userId));
		await expect(
			updateContact({ actor, input: { contactId: contact.id, email: null, name: "Grace", phone: null } })
		).resolves.toMatchObject({ name: "Grace" });
		await expect(deleteContact({ actor, contactId: contact.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
		await db.update(members).set({ role: "member" }).where(eq(members.userId, actor.userId));
		await expect(getContact({ actor, contactId: contact.id })).resolves.toMatchObject({ name: "Grace" });
		await expect(createContact({ actor, input: { email: null, name: "New", phone: null } })).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		await expect(
			updateContact({ actor, input: { contactId: contact.id, email: null, name: "Changed", phone: null } })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await db.delete(members).where(eq(members.userId, actor.userId));
		await expect(getContact({ actor, contactId: contact.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("uses the role in the requested organization instead of a role from another organization", async () => {
		const owner = await createActor();
		const other = await createActor();
		await db.insert(members).values({
			id: crypto.randomUUID(),
			organizationId: other.organizationId,
			role: "member",
			userId: owner.userId,
		});
		await expect(requireOrganizationPermission({ ...owner, permission: "delete" })).resolves.toBe("owner");
		await expect(
			requireOrganizationPermission({
				organizationId: other.organizationId,
				permission: "write",
				userId: owner.userId,
			})
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("allows admin Links edits and rejects deletion embedded in a complete document save", async () => {
		const actor = await createActor();
		const document = createDefaultLinkPageDocument({ name: "Links" });
		document.blocks = [
			{
				appearance: defaultLinkPageSectionAppearance,
				enabled: true,
				id: crypto.randomUUID(),
				items: [{ id: crypto.randomUUID(), platform: "instagram", url: "https://instagram.com/example" }],
				kind: "socials",
			},
		];
		const original = await saveLinkPage({ ...actor, document, updatedAt: null });
		await db.update(members).set({ role: "admin" }).where(eq(members.userId, actor.userId));
		await expect(
			saveLinkPage({ ...actor, document: { ...document, blocks: [] }, updatedAt: original.updatedAt })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		const block = document.blocks[0];

		if (!block || block.kind !== "socials") {
			throw new Error("Missing socials fixture");
		}

		await expect(
			saveLinkPage({
				...actor,
				document: { ...document, blocks: [{ ...block, items: [] }] },
				updatedAt: original.updatedAt,
			})
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(getLinkPage(actor)).resolves.toMatchObject({ document });

		const updated = await saveLinkPage({
			...actor,
			document: { ...document, blocks: [{ ...block, enabled: false }] },
			updatedAt: original.updatedAt,
		});

		await db.update(members).set({ role: "owner" }).where(eq(members.userId, actor.userId));
		await expect(
			saveLinkPage({ ...actor, document: { ...document, blocks: [] }, updatedAt: updated.updatedAt })
		).resolves.toMatchObject({ document: { blocks: [] } });
	});
});
