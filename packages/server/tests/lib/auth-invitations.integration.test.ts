import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { db, invitations, members, organizations } from "@starter/db";
import { InvitationEmail } from "@starter/email";

import { auth } from "../../src/lib/auth";
import { sendEmail } from "../../src/lib/resend";
import { authTestHelpers } from "../helpers/auth";

vi.mock("@starter/email", async () => (await import("../helpers/email")).emailPackageMock);

vi.mock("react-email", () => ({ render: vi.fn().mockResolvedValue("Invitation email") }));

vi.mock("../../src/lib/resend", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

describe("organization invitations", () => {
	const userIds: Array<string> = [];
	const organizationIds: Array<string> = [];

	const createUser = async () => {
		const user = authTestHelpers.createUser({
			email: `invite-${crypto.randomUUID()}@example.com`,
			emailVerified: true,
			name: "Invitation Test",
		});

		await authTestHelpers.saveUser(user);
		userIds.push(user.id);

		return { ...(await authTestHelpers.login({ userId: user.id })), user };
	};

	const createTeam = async () => {
		const owner = await createUser();
		const admin = await createUser();
		const member = await createUser();
		const organizationId = crypto.randomUUID();
		organizationIds.push(organizationId);
		await db.insert(organizations).values({ id: organizationId, name: "Invitation Team" });
		await db.insert(members).values(
			[
				{ actor: owner, role: "owner" },
				{ actor: admin, role: "admin" },
				{ actor: member, role: "member" },
			].map(({ actor, role }) => ({ id: crypto.randomUUID(), organizationId, role, userId: actor.user.id }))
		);

		return { admin, member, organizationId, owner };
	};

	afterEach(async () => {
		for (const id of organizationIds) {
			await db.delete(organizations).where(eq(organizations.id, id));
		}

		for (const id of userIds) {
			await authTestHelpers.deleteUser(id);
		}

		organizationIds.length = 0;
		userIds.length = 0;
	});

	it("lets admins invite and members read, with owner-only cancellation and no owner invitations", async () => {
		const { admin, member, organizationId, owner } = await createTeam();
		const recipient = await createUser();
		const body = { email: recipient.user.email, organizationId, role: "member" } as const;
		await expect(auth.api.createInvitation({ body, headers: member.headers })).rejects.toMatchObject({
			status: "FORBIDDEN",
		});

		for (const actor of [admin, owner]) {
			await expect(
				auth.api.createInvitation({ body: { ...body, role: "owner" }, headers: actor.headers })
			).rejects.toMatchObject({ status: "BAD_REQUEST" });
		}

		const invitation = await auth.api.createInvitation({ body, headers: admin.headers });
		await expect(auth.api.listInvitations({ headers: member.headers, query: { organizationId } })).resolves.toEqual(
			expect.arrayContaining([expect.objectContaining({ id: invitation.id, role: "member" })])
		);
		await expect(
			auth.api.cancelInvitation({ body: { invitationId: invitation.id }, headers: admin.headers })
		).rejects.toMatchObject({ status: "FORBIDDEN" });
		await auth.api.cancelInvitation({ body: { invitationId: invitation.id }, headers: owner.headers });
		await expect(
			auth.api.acceptInvitation({ body: { invitationId: invitation.id }, headers: recipient.headers })
		).rejects.toMatchObject({ status: "BAD_REQUEST" });
	});

	it("resends the stored role and blocks legacy owner invitations", async () => {
		const { admin, organizationId, owner } = await createTeam();
		const recipient = await createUser();
		const body = { email: recipient.user.email, organizationId, role: "member" } as const;
		const invitation = await auth.api.createInvitation({ body, headers: owner.headers });
		await expect(
			auth.api.createInvitation({ body: { ...body, resend: true }, headers: admin.headers })
		).resolves.toMatchObject({ id: invitation.id, role: "member" });
		await db.update(invitations).set({ role: "owner" }).where(eq(invitations.id, invitation.id));
		await expect(
			auth.api.createInvitation({ body: { ...body, resend: true }, headers: owner.headers })
		).rejects.toMatchObject({ status: "FORBIDDEN" });
		await expect(
			auth.api.acceptInvitation({ body: { invitationId: invitation.id }, headers: recipient.headers })
		).rejects.toMatchObject({ status: "FORBIDDEN" });
		await db
			.update(invitations)
			.set({ expiresAt: new Date(0).toISOString() })
			.where(eq(invitations.id, invitation.id));
		const renewed = await auth.api.createInvitation({ body: { ...body, resend: true }, headers: admin.headers });
		expect(renewed.id).not.toBe(invitation.id);
		expect(renewed.role).toBe("member");
	});

	it("locks every owner membership even when another owner exists", async () => {
		const { admin, member, organizationId, owner } = await createTeam();
		await db.update(members).set({ role: "owner" }).where(eq(members.userId, admin.user.id));
		const [secondOwner] = await db.select().from(members).where(eq(members.userId, admin.user.id));
		const [regularMember] = await db.select().from(members).where(eq(members.userId, member.user.id));

		if (!secondOwner || !regularMember) {
			throw new Error("Missing membership fixture");
		}

		await expect(
			auth.api.updateMemberRole({
				body: { memberId: secondOwner.id, organizationId, role: "admin" },
				headers: owner.headers,
			})
		).rejects.toMatchObject({ status: "FORBIDDEN" });
		await expect(
			auth.api.removeMember({ body: { memberIdOrEmail: secondOwner.id, organizationId }, headers: owner.headers })
		).rejects.toMatchObject({ status: "FORBIDDEN" });
		await expect(
			auth.api.leaveOrganization({ body: { organizationId }, headers: owner.headers })
		).rejects.toMatchObject({ status: "FORBIDDEN" });
		await expect(
			auth.api.updateMemberRole({
				body: { memberId: regularMember.id, organizationId, role: "owner" },
				headers: owner.headers,
			})
		).rejects.toMatchObject({ status: "FORBIDDEN" });
		await expect(
			auth.api.updateMemberRole({
				body: { memberId: regularMember.id, organizationId, role: "admin" },
				headers: owner.headers,
			})
		).resolves.toMatchObject({ role: "admin" });
		await auth.api.removeMember({
			body: { memberIdOrEmail: regularMember.id, organizationId },
			headers: owner.headers,
		});
	});

	it("still assigns ownership when creating an organization", async () => {
		const creator = await createUser();

		const organization = await auth.api.createOrganization({
			body: { name: "New team", slug: `team-${crypto.randomUUID()}` },
			headers: creator.headers,
		});

		if (!organization) {
			throw new Error("Organization was not created");
		}

		organizationIds.push(organization.id);
		const [membership] = await db.select().from(members).where(eq(members.organizationId, organization.id));
		expect(membership).toMatchObject({ role: "owner", userId: creator.user.id });
	});

	it("accepts only for the recipient and activates membership with the invited role", async () => {
		const { admin, organizationId, owner } = await createTeam();
		const recipient = await createUser();

		const invitation = await auth.api.createInvitation({
			body: { email: recipient.user.email, organizationId, role: "admin" },
			headers: admin.headers,
		});

		await expect(
			auth.api.getInvitation({ headers: owner.headers, query: { id: invitation.id } })
		).rejects.toMatchObject({ status: "FORBIDDEN" });
		await expect(
			auth.api.acceptInvitation({ body: { invitationId: invitation.id }, headers: owner.headers })
		).rejects.toMatchObject({ status: "FORBIDDEN" });
		await expect(
			auth.api.getInvitation({ headers: recipient.headers, query: { id: invitation.id } })
		).resolves.toMatchObject({ organizationName: "Invitation Team", role: "admin" });
		await expect(
			auth.api.acceptInvitation({ body: { invitationId: invitation.id }, headers: recipient.headers })
		).resolves.toMatchObject({ member: { organizationId, role: "admin", userId: recipient.user.id } });
		await auth.api.setActiveOrganization({ body: { organizationId }, headers: recipient.headers });

		const [membership] = await db
			.select()
			.from(members)
			.where(and(eq(members.organizationId, organizationId), eq(members.userId, recipient.user.id)));

		expect(membership?.role).toBe("admin");
		await expect(
			auth.api.acceptInvitation({ body: { invitationId: invitation.id }, headers: recipient.headers })
		).rejects.toMatchObject({ status: "BAD_REQUEST" });
	});

	it("rejects expired invitations and lets the recipient decline a pending one", async () => {
		const { organizationId, owner } = await createTeam();
		const recipient = await createUser();
		const body = { email: recipient.user.email, organizationId, role: "member" } as const;
		const expired = await auth.api.createInvitation({ body, headers: owner.headers });
		await db
			.update(invitations)
			.set({ expiresAt: new Date(0).toISOString() })
			.where(eq(invitations.id, expired.id));
		await expect(
			auth.api.getInvitation({ headers: recipient.headers, query: { id: expired.id } })
		).rejects.toMatchObject({ status: "BAD_REQUEST" });
		await expect(
			auth.api.acceptInvitation({ body: { invitationId: expired.id }, headers: recipient.headers })
		).rejects.toMatchObject({ status: "BAD_REQUEST" });
		const fresh = await auth.api.createInvitation({ body: { ...body, resend: true }, headers: owner.headers });
		await auth.api.rejectInvitation({ body: { invitationId: fresh.id }, headers: recipient.headers });
		await expect(
			auth.api.acceptInvitation({ body: { invitationId: fresh.id }, headers: recipient.headers })
		).rejects.toMatchObject({ status: "BAD_REQUEST" });
	});

	it("emails the invitation link in the locale of the requesting page", async () => {
		const { admin, organizationId } = await createTeam();
		const recipient = await createUser();

		const response = await auth.handler(
			new Request("http://localhost:3000/api/auth/organization/invite-member", {
				body: JSON.stringify({ email: recipient.user.email, organizationId, role: "member" }),
				headers: {
					"content-type": "application/json",
					cookie: admin.headers.get("cookie") ?? "",
					referer: "http://localhost:3000/ar/dashboard",
				},
				method: "POST",
			})
		);

		expect(response.status).toBe(200);
		await vi.waitFor(() =>
			expect(InvitationEmail).toHaveBeenCalledWith(
				expect.objectContaining({
					inviteLink: expect.stringContaining("/ar/accept-invitation/"),
					locale: "ar",
				})
			)
		);
		expect(sendEmail).toHaveBeenCalledWith(
			expect.objectContaining({ flow: "organization-invitation", to: recipient.user.email })
		);
	});
});
