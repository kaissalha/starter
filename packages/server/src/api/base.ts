import { headers } from "next/headers";

import { ORPCError } from "@orpc/client";
import { openapi } from "@orpc/openapi";
import { defineMeta, os } from "@orpc/server";
import { identifyUser } from "evlog/better-auth";
import type { EvlogOrpcContext } from "evlog/orpc";

import { resolveSession } from "../lib/auth";
import { requireOrganizationPermission } from "../services/permissions";
import { hasOrganizationPermission, type OrganizationPermission } from "../utils/permissions";

export const [publicApi, getPublicApiMeta] = defineMeta("starter.public-api", (incoming: boolean) => incoming);

export const isPublicApiProcedure = (contract: Parameters<typeof getPublicApiMeta>[0]) =>
	getPublicApiMeta(contract) === true;

const betterAuthSecurity: Array<Record<string, Array<string>>> = [
	{ apiKeyAuth: [] },
	{ betterAuthSession: [] },
	{ betterAuthSecureSession: [] },
];

export const pub = os
	.$context<Partial<EvlogOrpcContext> & { authMode?: "session-only" | "session-or-api-key" }>()
	.use(({ context, next, path }) => {
		context.log?.set({ operation: path.join(".") });

		return next();
	});

export const authed = pub
	.errors({
		TOO_MANY_REQUESTS: { message: "Too many requests." },
		UNAUTHORIZED: { message: "Authentication is required." },
	})
	.meta(
		openapi({
			spec: (current) => ({
				...current,
				security: betterAuthSecurity,
			}),
		})
	)
	.use(async ({ context, errors, next }) => {
		const session = await (async () => {
			try {
				return await resolveSession(await headers(), context.authMode === "session-or-api-key");
			} catch (error) {
				if (error instanceof ORPCError && error.code === "TOO_MANY_REQUESTS") {
					throw errors.TOO_MANY_REQUESTS();
				}

				throw error;
			}
		})();

		if (!session) {
			throw errors.UNAUTHORIZED();
		}

		if (context.log) {
			identifyUser(context.log, session, { fields: ["emailVerified", "createdAt"], session: false });
		}

		return next({ context: { session } });
	});

export const authedWithOrganization = authed
	.errors({
		BAD_REQUEST: {},
		FORBIDDEN: { message: "You do not have permission to perform this action." },
	})
	.use(async ({ context, errors, next }) => {
		const organizationId = context.session.session.activeOrganizationId;

		if (!organizationId) {
			throw errors.BAD_REQUEST({ message: "Organization not found" });
		}

		const sessionRole = "organizationRole" in context.session ? context.session.organizationRole : null;

		const organizationRole =
			sessionRole && hasOrganizationPermission({ permission: "read", role: sessionRole })
				? sessionRole
				: await requireOrganizationPermission({
						organizationId,
						permission: "read",
						userId: context.session.user.id,
					});

		context.log?.set({ organization: { id: organizationId, role: organizationRole } });

		return next({ context: { organizationId, organizationRole } });
	});

export const organizationPermission = (permission: OrganizationPermission) =>
	authedWithOrganization.middleware(({ context, errors, next }) => {
		if (!hasOrganizationPermission({ permission, role: context.organizationRole })) {
			throw errors.FORBIDDEN();
		}

		return next();
	});
