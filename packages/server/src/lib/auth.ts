import { apiKey } from "@better-auth/api-key";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { i18n } from "@better-auth/i18n";
import { mcp } from "@better-auth/mcp";
import { ORPCError } from "@orpc/client";
import { waitUntil } from "@vercel/functions";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { parseCookies } from "better-auth/cookies";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import { customSession, lastLoginMethod } from "better-auth/plugins";
import { emailOTP } from "better-auth/plugins/email-otp";
import { jwt } from "better-auth/plugins/jwt";
import { organization } from "better-auth/plugins/organization";
import { eq, inArray } from "drizzle-orm";
import { createHash } from "node:crypto";
import { z } from "zod";

import { checkRateLimit } from "@starter/cache";
import { apikeys, db, members, schema, users } from "@starter/db";
import { log, serializeLogError } from "@starter/observability";
import { getBaseURL } from "@starter/utils";

import type { OrganizationAIShutdownLease } from "../services/chat-stream-state";
import {
	authPermissionHook,
	getOrganizationRole,
	readApiKeyOrganizationId,
	validateTeamRole,
} from "../services/permissions";
import { hasOrganizationPermission, organizationAccessControl, organizationRoles } from "../utils/permissions";
import { OTP_EXPIRES_IN_SECONDS, sendOrganizationInvitationEmail, sendOTPEmail } from "./auth-emails";

const googleClientId = process.env.GOOGLE_CLIENT_ID;

const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const isPlaywrightTest = process.env.PLAYWRIGHT_TEST === "1" && process.env.NODE_ENV !== "production";

const lastActiveOrganizationCookieName = "starter.last_active_organization";

const organizationResultSchema = z.compile(z.object({ id: z.string() }));

const emailBodySchema = z.compile(z.object({ email: z.string() }));

const organizationAIShutdownLeases = new WeakMap<object, OrganizationAIShutdownLease>();

const loggerErrorSchema = z.compile(
	z
		.object({
			message: z.string().optional(),
			name: z.string().optional(),
			stack: z.string().optional(),
		})
		.refine((value) => value.message !== undefined || value.name !== undefined || value.stack !== undefined)
);

const API_KEY_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

const API_KEY_RATE_LIMIT_MAX_REQUESTS = 1000;

if (!db) {
	throw new Error("Database not found");
}

const baseUrl = getBaseURL();

export const MCP_RESOURCE = new URL("/api/mcp", baseUrl).toString();

export const ORGANIZATION_ID_CLAIM = `${baseUrl.origin}/claims/organization-id`;

const authOptions = {
	account: { encryptOAuthTokens: true },
	advanced: {
		backgroundTasks: { handler: waitUntil },
	},
	appName: "starter",
	baseURL: baseUrl.toString(),
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
		usePlural: true,
	}),
	databaseHooks: {
		session: {
			create: {
				before: async (session, context) => {
					const userMemberships = await db
						.select({ organizationId: members.organizationId })
						.from(members)
						.where(eq(members.userId, session.userId))
						.execute();

					const preferredOrganizationId = parseCookies(context?.headers?.get("cookie") ?? "").get(
						lastActiveOrganizationCookieName
					);

					const member =
						userMemberships.find(({ organizationId }) => organizationId === preferredOrganizationId) ??
						userMemberships[0];

					if (!member) {
						return { data: session };
					}

					return {
						data: {
							...session,
							activeOrganizationId: member.organizationId,
						},
					};
				},
			},
		},
	},
	disabledPaths: [
		"/token",
		"/email-otp/request-password-reset",
		"/forget-password/email-otp",
		"/email-otp/reset-password",
		"/email-otp/request-email-change",
		"/email-otp/change-email",
	],
	hooks: {
		after: createAuthMiddleware(async (context) => {
			const returned = organizationResultSchema.safeParse(context.context.returned);
			const activeOrganizationIdReference = { value: context.context.newSession?.session.activeOrganizationId };

			if (context.path === "/organization/set-active" && returned.success) {
				activeOrganizationIdReference.value = returned.data.id;
			}

			if (!activeOrganizationIdReference.value) {
				return;
			}

			context.setCookie(lastActiveOrganizationCookieName, activeOrganizationIdReference.value, {
				httpOnly: true,
				maxAge: 60 * 60 * 24 * 365,
				path: "/",
				sameSite: "lax",
				secure: getBaseURL().protocol === "https:",
			});
		}),
		before: authPermissionHook,
	},
	logger: {
		disableColors: false,
		disabled: false,
		log: (level, message, ...args) => {
			const error = args.find((arg) => arg instanceof Error || loggerErrorSchema.safeParse(arg).success);

			const details = error ? args.filter((arg) => arg !== error) : args;

			switch (level) {
				case "error":
					log.error({
						details: details.length ? details : undefined,
						error: serializeLogError(error ?? message),
						message,
						source: "better-auth",
					});

					return;
				default:
					log[level]({
						details: details.length ? details : undefined,
						message,
						source: "better-auth",
					});

					return;
			}
		},
	},
	plugins: [
		apiKey({
			defaultPrefix: "starter_",
			enableMetadata: true,
			keyExpiration: { defaultExpiresIn: 60 * 60 * 24 * 90, maxExpiresIn: 365 },
			rateLimit: {
				enabled: true,
				maxRequests: API_KEY_RATE_LIMIT_MAX_REQUESTS,
				timeWindow: API_KEY_RATE_LIMIT_WINDOW_MS,
			},
		}),
		jwt({
			disableSettingJwtHeader: true,
			schema: {
				jwks: {
					modelName: "jwk",
				},
			},
		}),
		mcp({
			advertisedMetadata: {
				claims_supported: [ORGANIZATION_ID_CLAIM],
			},
			allowDynamicClientRegistration: true,
			allowUnauthenticatedClientRegistration: true,
			clientReference: ({ session }) => {
				const organizationId = session?.activeOrganizationId;

				return String(organizationId) === organizationId ? organizationId : undefined;
			},
			clientRegistrationDefaultScopes: ["openid", "profile", "email", "offline_access", "mcp"],
			consentPage: "/oauth/consent",
			customAccessTokenClaims: ({ referenceId, resources }) => {
				if (!resources?.includes(MCP_RESOURCE) || !referenceId) {
					return {};
				}

				return { [ORGANIZATION_ID_CLAIM]: referenceId };
			},
			loginPage: "/login",
			postLogin: {
				consentReferenceId: ({ scopes, session }) => {
					if (!scopes.includes("mcp")) {
						return undefined;
					}

					const organizationId = session?.activeOrganizationId;

					if (String(organizationId) !== organizationId) {
						throw new APIError("BAD_REQUEST", {
							error: "set_organization",
							error_description: "An active organization is required for MCP access.",
						});
					}

					return organizationId;
				},
				page: "/dashboard",
				shouldRedirect: () => {
					return false;
				},
			},
			resource: MCP_RESOURCE,
			scopes: ["openid", "profile", "email", "offline_access", "mcp"],
		}),
		cimd({
			fetchClientMetadataResource,
			metadataProfile: "mcp-2026-07-28",
		}),
		lastLoginMethod({
			customResolveMethod: (ctx) => {
				if (ctx.path === "/sign-in/email-otp") {
					return "email";
				}

				return null;
			},
		}),
		organization({
			ac: organizationAccessControl,
			organizationHooks: {
				afterDeleteOrganization: async ({ organization: deletedOrganization }, context) => {
					if (!context) {
						return;
					}

					const lease = organizationAIShutdownLeases.get(context);

					if (!lease) {
						return;
					}

					const [{ runOrganizationPurge }, { clearOrganizationAIShutdown }] = await Promise.all([
						import("../services/organization-purge"),
						import("../services/chat-stream-state"),
					]);

					try {
						await runOrganizationPurge({ organizationId: deletedOrganization.id });
					} catch (error) {
						await log.error({
							error: serializeLogError(error),
							message: "Failed to purge organization data",
							organizationId: deletedOrganization.id,
						});
					}

					try {
						await clearOrganizationAIShutdown({ lease });
					} catch (error) {
						await log.error({
							error: serializeLogError(error),
							message: "Failed to clear organization AI shutdown marker",
							organizationId: deletedOrganization.id,
						});
					} finally {
						organizationAIShutdownLeases.delete(context);
					}
				},
				afterRemoveMember: async ({ member, organization: removedFrom }) => {
					const keys = await db
						.select({ id: apikeys.id, metadata: apikeys.metadata })
						.from(apikeys)
						.where(eq(apikeys.referenceId, member.userId));

					await db.delete(apikeys).where(
						inArray(
							apikeys.id,
							keys
								.filter(({ metadata }) => readApiKeyOrganizationId(metadata) === removedFrom.id)
								.map(({ id }) => id)
						)
					);
				},
				beforeAcceptInvitation: async ({ invitation }) => validateTeamRole(invitation.role),
				beforeAddMember: async ({ member }) => {
					if (!hasOrganizationPermission({ permission: "read", role: member.role })) {
						throw new APIError("BAD_REQUEST", { message: "Choose Owner, Admin, or Member." });
					}
				},
				beforeCreateInvitation: async ({ invitation }) => validateTeamRole(invitation.role),
				beforeDeleteOrganization: async ({ organization: deletedOrganization }, context) => {
					if (!context) {
						throw new Error("Organization deletion context is required");
					}

					const [
						{ stopOrganizationAIActivity },
						{ snapshotOrganizationPurge },
						{ clearOrganizationAIShutdown },
					] = await Promise.all([
						import("../services/organization-ai-data"),
						import("../services/organization-purge"),
						import("../services/chat-stream-state"),
					]);

					const lease = await stopOrganizationAIActivity({ organizationId: deletedOrganization.id });

					try {
						await snapshotOrganizationPurge({
							logo: deletedOrganization.logo ?? null,
							organizationId: deletedOrganization.id,
						});
					} catch (error) {
						await clearOrganizationAIShutdown({ lease });
						throw error;
					}

					organizationAIShutdownLeases.set(context, lease);
				},
				beforeRemoveMember: async ({ member }) => validateTeamRole(member.role),
				beforeUpdateMemberRole: async ({ member, newRole }) => {
					validateTeamRole(member.role);
					validateTeamRole(newRole);
				},
				beforeUpdateOrganization: async ({ organization: update }) => {
					if (update.logo !== undefined) {
						throw new APIError("BAD_REQUEST", { message: "Set the business logo through the brand." });
					}
				},
			},
			roles: organizationRoles,
			async sendInvitationEmail({ email, id, inviter, organization, role }, request) {
				await sendOrganizationInvitationEmail({
					email,
					headers: request?.headers,
					invitationId: id,
					inviterEmail: inviter.user.email,
					inviterName: inviter.user.name,
					organizationName: organization.name,
					role,
				});
			},
		}),
		emailOTP({
			expiresIn: OTP_EXPIRES_IN_SECONDS,
			async sendVerificationOTP({ email, otp }, context) {
				if (isPlaywrightTest) {
					return;
				}

				await sendOTPEmail({ email, headers: context?.headers, otp });
			},
			storeOTP: "hashed",
		}),
		{
			hooks: {
				before: [
					{
						handler: createAuthMiddleware(async (context) => {
							const email = emailBodySchema.safeParse(context.body).data?.email.trim().toLowerCase();

							if (!email) {
								return;
							}

							const decision = await checkRateLimit({
								key: `auth:email-otp:${createHash("sha256").update(email).digest("hex")}`,
								max: 5,
								windowSeconds: 900,
							});

							if (!decision.allowed) {
								throw new APIError(
									"TOO_MANY_REQUESTS",
									{ message: "Too many requests. Please try again later." },
									{ "X-Retry-After": String(decision.retryAfterSeconds) }
								);
							}
						}),
						matcher: (context) => !isPlaywrightTest && context.path === "/email-otp/send-verification-otp",
					},
				],
			},
			id: "email-otp-throttle",
		},
		i18n({
			defaultLocale: "en",
			detection: ["header"],
			translations: {
				ar: {
					INVALID_EMAIL: "عنوان البريد الإلكتروني غير صالح",
					INVALID_OTP: "رمز التحقق غير صالح",
					OTP_EXPIRED: "انتهت صلاحية رمز التحقق",
					SESSION_EXPIRED: "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى",
					TOO_MANY_ATTEMPTS: "عدد المحاولات كبير جدًا. يرجى المحاولة لاحقًا",
					USER_NOT_FOUND: "تعذّر العثور على المستخدم",
				},
				en: {},
			},
		}),
	],
	rateLimit: {
		customStorage: process.env.REDIS_URL
			? {
					consume: async (key, rule) => {
						const decision = await checkRateLimit({
							key: `auth:${key}`,
							max: rule.max,
							windowSeconds: rule.window,
						});

						return {
							allowed: decision.allowed,
							retryAfter: decision.allowed ? null : decision.retryAfterSeconds,
						};
					},
				}
			: undefined,
	},
	session: {
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60,
		},
	},
	socialProviders:
		googleClientId && googleClientSecret
			? {
					google: {
						accessType: "offline",
						clientId: googleClientId,
						clientSecret: googleClientSecret,
						prompt: "select_account consent",
					},
				}
			: {},
	trustedOrigins: [baseUrl.toString()],
} satisfies BetterAuthOptions;

export const auth = betterAuth({
	...authOptions,
	plugins: [
		...authOptions.plugins,
		customSession(async ({ session, user }) => {
			const organizationId = session.activeOrganizationId;

			const organizationRole = organizationId
				? await getOrganizationRole({ organizationId, userId: user.id })
				: null;

			return {
				organizationRole,
				session: {
					...session,
					activeOrganizationId: hasOrganizationPermission({ permission: "read", role: organizationRole })
						? organizationId
						: null,
				},
				user,
			};
		}, authOptions),
		nextCookies(),
	],
});

export const API_KEY_HEADER = "x-api-key";

export const API_KEY_PREFIX = "starter_";

export const getApiKeyFromHeaders = (headers: Headers) => {
	const bearer = headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];

	return headers.get(API_KEY_HEADER) ?? (bearer?.startsWith(API_KEY_PREFIX) ? bearer : undefined);
};

const resolveAuthenticatedSession = async ({
	requestedOrganizationId,
	userId,
}: {
	requestedOrganizationId?: string;
	userId: string;
}) => {
	const memberships = await db
		.select({ organizationId: members.organizationId })
		.from(members)
		.where(eq(members.userId, userId))
		.execute();

	const organizationId = requestedOrganizationId
		? memberships.find((membership) => membership.organizationId === requestedOrganizationId)?.organizationId
		: memberships[0]?.organizationId;

	if (!organizationId) {
		return null;
	}

	const [user] = await db
		.select({ email: users.email, id: users.id, name: users.name })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1)
		.execute();

	if (!user) {
		return null;
	}

	return {
		session: { activeOrganizationId: organizationId },
		user,
	};
};

const resolveApiKeySession = async (key: string) => {
	const { error, key: apiKeyRecord, valid } = await auth.api.verifyApiKey({ body: { key } });

	if (error?.code === "RATE_LIMITED") {
		throw new ORPCError("TOO_MANY_REQUESTS", { message: "API key rate limit exceeded." });
	}

	if (!valid || !apiKeyRecord) {
		return null;
	}

	if (
		!apiKeyRecord.rateLimitEnabled ||
		apiKeyRecord.rateLimitMax !== API_KEY_RATE_LIMIT_MAX_REQUESTS ||
		apiKeyRecord.rateLimitTimeWindow !== API_KEY_RATE_LIMIT_WINDOW_MS
	) {
		await auth.api.updateApiKey({
			body: {
				keyId: apiKeyRecord.id,
				rateLimitEnabled: true,
				rateLimitMax: API_KEY_RATE_LIMIT_MAX_REQUESTS,
				rateLimitTimeWindow: API_KEY_RATE_LIMIT_WINDOW_MS,
				userId: apiKeyRecord.referenceId,
			},
		});
	}

	const requestedOrganizationId = readApiKeyOrganizationId(apiKeyRecord.metadata);

	if (!requestedOrganizationId) {
		return null;
	}

	return resolveAuthenticatedSession({ requestedOrganizationId, userId: apiKeyRecord.referenceId });
};

export const resolveOAuthSession = async ({ organizationId, userId }: { organizationId: string; userId: string }) => {
	return resolveAuthenticatedSession({ requestedOrganizationId: organizationId, userId });
};

export const resolveSession = async (headers: Headers, allowApiKey = true) => {
	const key = allowApiKey ? getApiKeyFromHeaders(headers) : undefined;

	if (key) {
		return resolveApiKeySession(key);
	}

	return auth.api.getSession({ headers });
};
