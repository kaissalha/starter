import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { v4 as uuidv4 } from "uuid";

import { db, eventExecutions, members, organizations, users } from "@starter/db";

export const cleanupOrganization = async (organizationId: string) => {
	await db.delete(organizations).where(eq(organizations.id, organizationId));
};

export const createTestOrganization = async ({ name }: { name?: string } = {}) => {
	const id = `org-${uuidv4()}`;

	const [organization] = await db
		.insert(organizations)
		.values({
			id,
			name: name ?? "Test Organization",
		})
		.returning();

	return organization;
};

export const cleanupTestActors = async (ids: Array<string>) => {
	if (ids.length === 0) {
		return;
	}

	await db.delete(organizations).where(inArray(organizations.id, ids));
	await db.delete(users).where(inArray(users.id, ids));
	ids.length = 0;
};

export const createTestTeam = async ({ cleanupIds, name }: { cleanupIds: Array<string>; name: string }) => {
	const organizationId = randomUUID();
	await db.insert(organizations).values({ id: organizationId, name, slug: organizationId });
	cleanupIds.push(organizationId);

	const addMember = async (role: string) => {
		const userId = randomUUID();
		await db.insert(users).values({ email: `${userId}@example.com`, id: userId, name: "Teammate" });
		cleanupIds.push(userId);
		await db.insert(members).values({ id: randomUUID(), organizationId, role, userId });

		return { organizationId, userId };
	};

	return {
		admin: await addMember("admin"),
		member: await addMember("member"),
		organizationId,
		owner: await addMember("owner"),
	};
};

export const findEventExecutionId = async ({
	consumerKey,
	organizationId,
}: {
	consumerKey: string;
	organizationId: string;
}) => {
	const [execution] = await db
		.select({ id: eventExecutions.id })
		.from(eventExecutions)
		.where(and(eq(eventExecutions.organizationId, organizationId), eq(eventExecutions.consumerKey, consumerKey)));

	return execution?.id ?? "";
};
