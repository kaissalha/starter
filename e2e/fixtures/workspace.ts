import { eq } from "drizzle-orm";

import { db, files, members, users } from "@starter/db";

export const workspaceEmail = "playwright@example.com";

export const getWorkspaceOrganizationId = async () => {
	const [member] = await db
		.select({ organizationId: members.organizationId })
		.from(users)
		.innerJoin(members, eq(users.id, members.userId))
		.where(eq(users.email, workspaceEmail));

	if (!member) {
		throw new Error("The Playwright user has no workspace");
	}

	return member.organizationId;
};

export const resetWorkspaceLibrary = async () => {
	const organizationId = await getWorkspaceOrganizationId();
	await db.delete(files).where(eq(files.organizationId, organizationId));

	return db
		.insert(files)
		.values([
			{
				content: "# Price list\n\nSauna session: 120 CAD",
				contentType: "text/markdown",
				kind: "text",
				name: "price-list.md",
				organizationId,
				sourceType: "text",
				title: "Price list",
			},
			{
				contentType: "application/pdf",
				kind: "document",
				name: "booking-guide.pdf",
				organizationId,
				sizeBytes: 1024,
				title: "Booking guide",
				url: "https://e2e.invalid/booking-guide.pdf",
			},
			{
				contentType: "image/png",
				kind: "image",
				metadata: { height: 512, width: 512 },
				name: "studio-logo.png",
				organizationId,
				title: "Studio logo",
				url: "/logo.png",
			},
		])
		.returning({ id: files.id, title: files.title });
};
