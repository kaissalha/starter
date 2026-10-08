import { eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { db, members, organizations, users } from "@starter/db";

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

		const check = (permission: "delete" | "read" | "write") =>
			requireOrganizationPermission({ ...actor, permission });

		await db.update(members).set({ role: "admin" }).where(eq(members.userId, actor.userId));
		await expect(check("write")).resolves.toBe("admin");
		await expect(check("delete")).rejects.toMatchObject({ code: "FORBIDDEN" });
		await db.update(members).set({ role: "member" }).where(eq(members.userId, actor.userId));
		await expect(check("read")).resolves.toBe("member");
		await expect(check("write")).rejects.toMatchObject({ code: "FORBIDDEN" });
		await db.delete(members).where(eq(members.userId, actor.userId));
		await expect(check("read")).rejects.toMatchObject({ code: "FORBIDDEN" });
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
});
