import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { apikeys, db, members, organizationPurges, organizations } from "@starter/db";
import { OTPEmail } from "@starter/email";

import { auth, resolveOrganizationSession, resolveSession } from "../../src/lib/auth";
import { sendEmail } from "../../src/lib/resend";
import { requireOrganizationPermission } from "../../src/services/permissions";
import { authTestHelpers, testAuth } from "../helpers/auth";

const mocks = vi.hoisted(() => ({
	deleteKnowledgeOrganization: vi.fn(async (_input: { organizationId: string }) => undefined),
}));

vi.mock("../../src/ai/knowledge", () => ({ deleteKnowledgeOrganization: mocks.deleteKnowledgeOrganization }));

vi.mock("../../src/ai/memory", async () => (await import("../helpers/ai")).emptyMastraMemoryMock);

vi.mock("@starter/email", async () => (await import("../helpers/email")).emailPackageMock);

vi.mock("react-email", () => ({
	render: vi.fn(),
}));

vi.mock("../../src/lib/resend", () => ({
	sendEmail: vi.fn(),
}));

describe("Better Auth test helpers", () => {
	const userIds: Array<string> = [];

	afterEach(async () => {
		for (const userId of userIds) {
			await db.delete(apikeys).where(eq(apikeys.referenceId, userId));
			await authTestHelpers.deleteUser(userId);
		}

		userIds.length = 0;
	});

	const createMember = async ({ email = `auth-${crypto.randomUUID()}@example.com` }: { email?: string } = {}) => {
		const user = authTestHelpers.createUser({ email, name: "Auth Test" });
		await authTestHelpers.saveUser(user);
		userIds.push(user.id);

		const organizationId = `org-${crypto.randomUUID()}`;
		await db.insert(organizations).values({ id: organizationId, name: "Auth Organization" });

		await db.insert(members).values({
			id: crypto.randomUUID(),
			organizationId,
			role: "owner",
			userId: user.id,
		});

		return { organizationId, user };
	};

	it("advertises dynamic registration and MCP client metadata support", async () => {
		const response = await auth.handler(
			new Request("http://localhost:3000/.well-known/oauth-authorization-server/api/auth")
		);

		const metadata = z
			.object({
				client_id_metadata_document_supported: z.literal(true),
				code_challenge_methods_supported: z.array(z.string()),
				registration_endpoint: z.string().url(),
			})
			.parse(await response.json());

		expect(response.status).toBe(200);
		expect(metadata.registration_endpoint).toBe("http://localhost:3000/api/auth/oauth2/register");
		expect(metadata.code_challenge_methods_supported).toContain("S256");
	});

	it("creates authenticated sessions for persisted test users", async () => {
		const user = authTestHelpers.createUser({
			email: "auth-test@example.com",
			name: "Auth Test",
		});

		await authTestHelpers.saveUser(user);
		userIds.push(user.id);

		const { headers, token } = await authTestHelpers.login({ userId: user.id });
		const session = await testAuth.api.getSession({ headers });

		expect(token).toBeTruthy();

		expect(session?.user).toMatchObject({
			email: user.email,
			id: user.id,
		});
	});

	it("hydrates current organization roles and refreshes them even with a cached session cookie", async () => {
		const { organizationId, user } = await createMember();
		const { headers } = await authTestHelpers.login({ userId: user.id });
		await auth.api.setActiveOrganization({ body: { organizationId }, headers });
		const initial = await auth.api.getSession({ headers, returnHeaders: true });
		expect(initial.response).toMatchObject({
			organizationRole: "owner",
			session: { activeOrganizationId: organizationId },
		});
		const cachedHeaders = new Headers(headers);
		cachedHeaders.set(
			"cookie",
			[headers.get("cookie"), ...initial.headers.getSetCookie().map((cookie) => cookie.split(";")[0])]
				.filter(Boolean)
				.join("; ")
		);
		await db.update(members).set({ role: "member" }).where(eq(members.userId, user.id));
		expect(await auth.api.getSession({ headers: cachedHeaders })).toMatchObject({
			organizationRole: "member",
			session: { activeOrganizationId: organizationId },
		});
		await db.delete(members).where(eq(members.userId, user.id));
		expect(await auth.api.getSession({ headers: cachedHeaders })).toMatchObject({
			organizationRole: null,
			session: { activeOrganizationId: null },
			user: { id: user.id },
		});
	});

	it("resolves OAuth claims only while the user belongs to the requested organization", async () => {
		const { organizationId, user } = await createMember();

		await expect(resolveOrganizationSession({ organizationId, userId: user.id })).resolves.toMatchObject({
			session: { activeOrganizationId: organizationId },
			user: { email: user.email, id: user.id },
		});

		await expect(
			resolveOrganizationSession({ organizationId: `org-${crypto.randomUUID()}`, userId: user.id })
		).resolves.toBeNull();

		await db.delete(members).where(eq(members.userId, user.id));
		await expect(resolveOrganizationSession({ organizationId, userId: user.id })).resolves.toBeNull();
	});

	it("resolves a real API key and revokes it with organization membership", async () => {
		const { organizationId, user } = await createMember();
		const { headers } = await authTestHelpers.login({ userId: user.id });

		const created = await auth.api.createApiKey({
			body: { metadata: { organizationId }, name: "Integration key" },
			headers,
		});

		const [storedKey] = await db.select().from(apikeys).where(eq(apikeys.id, created.id)).limit(1);

		expect(storedKey).toMatchObject({
			rateLimitEnabled: true,
			rateLimitMax: 1000,
			rateLimitTimeWindow: 60 * 60 * 1000,
		});

		await db
			.update(apikeys)
			.set({ rateLimitEnabled: false, rateLimitMax: null, rateLimitTimeWindow: null })
			.where(eq(apikeys.id, created.id));

		await expect(resolveSession(new Headers({ "x-api-key": created.key }))).resolves.toMatchObject({
			session: { activeOrganizationId: organizationId },
			user: { id: user.id },
		});

		const [migratedKey] = await db.select().from(apikeys).where(eq(apikeys.id, created.id)).limit(1);

		expect(migratedKey).toMatchObject({
			rateLimitEnabled: true,
			rateLimitMax: 1000,
			rateLimitTimeWindow: 60 * 60 * 1000,
		});

		await expect(resolveSession(new Headers({ authorization: `Bearer ${created.key}` }))).resolves.toMatchObject({
			session: { activeOrganizationId: organizationId },
		});

		await expect(resolveSession(new Headers({ "x-api-key": created.key }), false)).resolves.toBeNull();

		await db.delete(members).where(eq(members.userId, user.id));
		await expect(resolveSession(new Headers({ "x-api-key": created.key }))).resolves.toBeNull();
	});

	it("rejects a throttled API key with TOO_MANY_REQUESTS and forbids updates to keys with malformed metadata", async () => {
		const { organizationId, user } = await createMember();
		const { headers } = await authTestHelpers.login({ userId: user.id });

		const created = await auth.api.createApiKey({
			body: { metadata: { organizationId }, name: "Throttled key" },
			headers,
		});

		await db
			.update(apikeys)
			.set({ lastRequest: new Date().toISOString(), requestCount: 1000 })
			.where(eq(apikeys.id, created.id));
		await expect(resolveSession(new Headers({ "x-api-key": created.key }))).rejects.toMatchObject({
			code: "TOO_MANY_REQUESTS",
		});

		await db.update(apikeys).set({ metadata: "{" }).where(eq(apikeys.id, created.id));
		await expect(
			auth.api.updateApiKey({ body: { keyId: created.id, name: "Renamed" }, headers })
		).rejects.toMatchObject({ status: "FORBIDDEN" });
	});

	it("uses custom roles for Better Auth organization actions and prevents admin ownership escalation", async () => {
		const { organizationId, user } = await createMember();
		const { headers } = await authTestHelpers.login({ userId: user.id });
		await db.update(members).set({ role: "admin" }).where(eq(members.userId, user.id));
		await expect(
			auth.api.updateOrganization({ body: { data: { name: "Updated" }, organizationId }, headers })
		).resolves.toMatchObject({ name: "Updated" });
		await expect(auth.api.deleteOrganization({ body: { organizationId }, headers })).rejects.toMatchObject({
			status: "FORBIDDEN",
		});
		const [member] = await db.select().from(members).where(eq(members.userId, user.id));

		if (!member) {
			throw new Error("Missing membership fixture");
		}

		await expect(
			auth.api.updateMemberRole({ body: { memberId: member.id, organizationId, role: "owner" }, headers })
		).rejects.toMatchObject({ status: "FORBIDDEN" });
		await db.update(members).set({ role: "member" }).where(eq(members.userId, user.id));
		await expect(
			auth.api.updateOrganization({ body: { data: { name: "Forbidden" }, organizationId }, headers })
		).rejects.toMatchObject({ status: "FORBIDDEN" });
	});

	it("lets an owner delete the organization and completes its purge", async () => {
		const { organizationId, user } = await createMember();
		const { headers } = await authTestHelpers.login({ userId: user.id });

		try {
			await auth.api.deleteOrganization({ body: { organizationId }, headers });

			expect(await db.select().from(organizations).where(eq(organizations.id, organizationId))).toEqual([]);

			const [purge] = await db
				.select()
				.from(organizationPurges)
				.where(eq(organizationPurges.organizationId, organizationId));

			expect(purge?.completedAt).not.toBeNull();
			expect(mocks.deleteKnowledgeOrganization).toHaveBeenCalledExactlyOnceWith({ organizationId });
		} finally {
			await db.delete(organizationPurges).where(eq(organizationPurges.organizationId, organizationId));
		}
	});

	it("expires API keys by default, keeps expiry changes owner-only and lets holders revoke their own keys", async () => {
		const { organizationId, user } = await createMember();
		const { headers } = await authTestHelpers.login({ userId: user.id });
		await db.update(members).set({ role: "admin" }).where(eq(members.userId, user.id));
		const key = await auth.api.createApiKey({ body: { metadata: { organizationId }, name: "Admin key" }, headers });
		expect(new Date(key.expiresAt ?? 0).getTime() - Date.now()).toBeGreaterThan(90 * 86_400_000 - 60_000);
		expect(new Date(key.expiresAt ?? 0).getTime() - Date.now()).toBeLessThan(90 * 86_400_000 + 60_000);
		await expect(
			auth.api.updateApiKey({ body: { keyId: key.id, metadata: { organizationId: "another-org" } }, headers })
		).rejects.toMatchObject({ status: "FORBIDDEN" });
		await expect(
			auth.api.updateApiKey({ body: { expiresIn: 86_400, keyId: key.id }, headers })
		).rejects.toMatchObject({ status: "FORBIDDEN" });
		await expect(auth.api.updateApiKey({ body: { enabled: false, keyId: key.id }, headers })).resolves.toBeTruthy();
		await expect(resolveSession(new Headers({ "x-api-key": key.key }))).resolves.toBeNull();
		await expect(auth.api.deleteApiKey({ body: { keyId: key.id }, headers })).resolves.toMatchObject({
			success: true,
		});

		const other = await createMember();
		const { headers: otherHeaders } = await authTestHelpers.login({ userId: other.user.id });

		const otherKey = await auth.api.createApiKey({
			body: { metadata: { organizationId: other.organizationId }, name: "Other key" },
			headers: otherHeaders,
		});

		await expect(auth.api.deleteApiKey({ body: { keyId: otherKey.id }, headers })).rejects.toMatchObject({
			status: "FORBIDDEN",
		});
		await expect(
			auth.api.updateApiKey({ body: { enabled: false, keyId: otherKey.id }, headers })
		).rejects.toMatchObject({ status: "FORBIDDEN" });
	});

	it("preserves live roles for existing API keys and lets demoted holders revoke them", async () => {
		const { organizationId, user } = await createMember();
		const { headers } = await authTestHelpers.login({ userId: user.id });
		await db.update(members).set({ role: "admin" }).where(eq(members.userId, user.id));
		const key = await auth.api.createApiKey({ body: { metadata: { organizationId }, name: "Admin key" }, headers });
		await db.update(members).set({ role: "member" }).where(eq(members.userId, user.id));
		await expect(
			auth.api.createApiKey({ body: { metadata: { organizationId }, name: "Member key" }, headers })
		).rejects.toMatchObject({ status: "FORBIDDEN" });
		const session = await resolveSession(new Headers({ "x-api-key": key.key }));
		expect(session?.session.activeOrganizationId).toBe(organizationId);
		await expect(
			requireOrganizationPermission({ organizationId, permission: "write", userId: user.id })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(auth.api.deleteApiKey({ body: { keyId: key.id }, headers })).resolves.toMatchObject({
			success: true,
		});
	});

	it("revokes a removed member's API keys for that organization only", async () => {
		const { organizationId, user: owner } = await createMember();
		const { headers: ownerHeaders } = await authTestHelpers.login({ userId: owner.id });
		const { organizationId: otherOrganizationId, user } = await createMember();
		const { headers } = await authTestHelpers.login({ userId: user.id });
		await db.insert(members).values({ id: crypto.randomUUID(), organizationId, role: "admin", userId: user.id });

		const removedKey = await auth.api.createApiKey({
			body: { metadata: { organizationId }, name: "Removed" },
			headers,
		});

		const keptKey = await auth.api.createApiKey({
			body: { metadata: { organizationId: otherOrganizationId }, name: "Kept" },
			headers,
		});

		await auth.api.removeMember({ body: { memberIdOrEmail: user.email, organizationId }, headers: ownerHeaders });

		const remaining = await db.select({ id: apikeys.id }).from(apikeys).where(eq(apikeys.referenceId, user.id));
		expect(remaining.map(({ id }) => id)).toEqual([keptKey.id]);
		expect(remaining.map(({ id }) => id)).not.toContain(removedKey.id);
	});

	it("sends the sign-in code in the locale of the requesting page", async () => {
		const email = `otp-${crypto.randomUUID()}@example.com`;
		await auth.api.sendVerificationOTP({
			body: { email, type: "sign-in" },
			headers: new Headers({ referer: "http://localhost:3000/ar/login" }),
		});
		await vi.waitFor(() =>
			expect(sendEmail).toHaveBeenCalledWith(
				expect.objectContaining({ flow: "email-otp", subject: "ar:otp.title:", to: email })
			)
		);
		expect(OTPEmail).toHaveBeenCalledWith(expect.objectContaining({ expiresInMinutes: 5, locale: "ar" }));
	});
});
