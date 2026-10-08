import { ORPCError } from "@orpc/client";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";

import { apikeys, db, invitations, members } from "@starter/db";

import { hasOrganizationPermission, type OrganizationPermission } from "../utils/permissions";

export const getOrganizationRole = async ({ organizationId, userId }: { organizationId: string; userId: string }) => {
	const [member] = await db
		.select({ role: members.role })
		.from(members)
		.where(and(eq(members.organizationId, organizationId), eq(members.userId, userId)))
		.limit(1);

	return member?.role ?? null;
};

export const requireOrganizationPermission = async ({
	organizationId,
	permission,
	userId,
}: {
	organizationId: string;
	permission: OrganizationPermission;
	userId: string;
}) => {
	const role = await getOrganizationRole({ organizationId, userId });

	if (!role || !hasOrganizationPermission({ permission, role })) {
		throw new ORPCError("FORBIDDEN", { message: "You do not have permission to perform this action." });
	}

	return role;
};

const apiKeyOrganizationSchema = z.object({ organizationId: z.string().min(1) });

export const readApiKeyOrganizationId = (metadata: { organizationId?: string } | null | string) => {
	if (metadata === null) {
		return undefined;
	}

	if (metadata instanceof Object) {
		return metadata.organizationId;
	}

	try {
		return apiKeyOrganizationSchema.safeParse(JSON.parse(metadata)).data?.organizationId;
	} catch {
		return undefined;
	}
};

const apiKeyAccessSchema = z.object({
	enabled: z.boolean().optional(),
	expiresIn: z.number().nullable().optional(),
	keyId: z.string().optional(),
	metadata: apiKeyOrganizationSchema.optional(),
});

const invitationAccessSchema = z.object({
	email: z.email(),
	organizationId: z.string().optional(),
	resend: z.boolean().optional(),
	role: z.enum(["admin", "member"]),
});

const isApiKeySelfRevocation = ({ input, path }: { input: z.infer<typeof apiKeyAccessSchema>; path: string }) =>
	path === "/api-key/delete" ||
	(path === "/api-key/update" && input.enabled === false && input.expiresIn === undefined);

export const validateTeamRole = (role: string) => {
	if (role !== "admin" && role !== "member") {
		throw new APIError("FORBIDDEN", { message: "Choose Admin or Member. Owner access cannot be changed." });
	}
};

const validateInvitationResend = async (input: z.infer<typeof invitationAccessSchema>) => {
	if (input.resend && input.organizationId) {
		const pending = await db
			.select({ role: invitations.role })
			.from(invitations)
			.where(
				and(
					eq(invitations.organizationId, input.organizationId),
					eq(invitations.email, input.email.toLowerCase()),
					eq(invitations.status, "pending"),
					gt(invitations.expiresAt, new Date().toISOString())
				)
			);

		if (pending.some(({ role }) => role !== input.role)) {
			throw new APIError("FORBIDDEN", { message: "Resend the invitation with its existing role." });
		}
	}
};

export const authPermissionHook = createAuthMiddleware(async (context) => {
	if (!context.request && !context.headers) {
		return;
	}

	if (
		![
			"/api-key/create",
			"/api-key/update",
			"/api-key/delete",
			"/organization/leave",
			"/organization/invite-member",
		].includes(context.path)
	) {
		return;
	}

	const session = await getSessionFromCtx(context, { disableCookieCache: true });

	if (!session) {
		throw new APIError("UNAUTHORIZED", { message: "Authentication is required." });
	}

	if (context.path === "/organization/invite-member") {
		const parsed = invitationAccessSchema.safeParse(context.body);

		if (!parsed.success) {
			throw new APIError("BAD_REQUEST", { message: "Choose a valid email and Admin or Member." });
		}

		await validateInvitationResend({
			...parsed.data,
			organizationId: parsed.data.organizationId ?? session.session.activeOrganizationId ?? undefined,
		});

		return;
	}

	if (context.path === "/organization/leave") {
		throw new APIError("FORBIDDEN", { message: "Team membership must be managed by the owner." });
	}

	const parsed = apiKeyAccessSchema.safeParse(context.body);

	if (!parsed.success) {
		throw new APIError("BAD_REQUEST", { message: "An organization is required for API keys." });
	}

	const input = parsed.data;

	const [key] = input.keyId
		? await db
				.select({ metadata: apikeys.metadata })
				.from(apikeys)
				.where(and(eq(apikeys.id, input.keyId), eq(apikeys.referenceId, session.user.id)))
				.limit(1)
		: [];

	const organizationId =
		context.path === "/api-key/create"
			? input.metadata?.organizationId
			: readApiKeyOrganizationId(key?.metadata ?? null);

	if (!organizationId || (input.metadata && input.metadata.organizationId !== organizationId)) {
		throw new APIError("FORBIDDEN", { message: "The API key organization cannot be changed." });
	}

	if (isApiKeySelfRevocation({ input, path: context.path })) {
		return;
	}

	const role = await getOrganizationRole({ organizationId, userId: session.user.id });
	const permission = context.path === "/api-key/update" && input.expiresIn !== undefined ? "delete" : "write";

	if (!hasOrganizationPermission({ permission, role })) {
		throw new APIError("FORBIDDEN", { message: "You do not have permission to perform this action." });
	}
});
