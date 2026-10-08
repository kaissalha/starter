import { waitUntil } from "@vercel/functions";
import { and, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";

import { db, domainRegistrations, websiteDomains, websites, type DomainRegistrationRow } from "@starter/db";
import { log, serializeLogError } from "@starter/observability";

import { appendEvents, wakeEventDispatcher, type AppendEventInput } from "../events/append";
import { domainHostnameSchema, getConnectionHostnames, registrationDomainSchema } from "./domain-input";
import { DomainConflictError, DomainNotFoundError, insertDomainGroup, reconcileDomainGroup } from "./domains";
import {
	buyVercelDomain,
	getVercelAuthCode,
	getVercelOrderStatus,
	getRegistrantRequirements,
	getVercelRegisteredDomain,
	quoteRegistrationDomain,
	type RegistrantRequirement,
	setVercelAutoRenew,
} from "./vercel-domains";
import { isPlatformHostname } from "./website-host";

export class DomainPurchaseDisabledError extends Error {}

export class DomainPriceChangedError extends Error {}

export class DomainRegistrantError extends Error {
	constructor(readonly fields: Array<string>) {
		super("Registrant details are incomplete.");
	}
}

const reminderDays = [30, 7, 1];

const dayMs = 24 * 60 * 60 * 1000;

const baseRegistrantSchema = z.strictObject({
	address1: z.string().trim().min(1).max(120),
	address2: z.string().trim().max(120).optional(),
	city: z.string().trim().min(1).max(80),
	companyName: z.string().trim().max(120).optional(),
	country: z
		.string()
		.trim()
		.toUpperCase()
		.regex(/^[A-Z]{2}$/u),
	email: z.email().max(254),
	firstName: z.string().trim().min(1).max(60),
	lastName: z.string().trim().min(1).max(60),
	phone: z
		.string()
		.transform((value) => value.replaceAll(/[\s().-]/gu, ""))
		.pipe(z.string().regex(/^\+[1-9]\d{6,14}$/u)),
	state: z.string().trim().min(1).max(80),
	zip: z.string().trim().min(1).max(20),
});

export const domainRegistrantInputSchema = z
	.record(z.string().max(64), z.string().max(255))
	.meta({ id: "DomainRegistrantInput" });

export const domainPurchaseInputSchema = z
	.strictObject({
		autoRenew: z.boolean(),
		domain: domainHostnameSchema,
		expectedPrice: z.number().nonnegative(),
		registrant: domainRegistrantInputSchema,
	})
	.meta({ id: "PurchaseDomainInput" });

type Scope = { organizationId: string; websiteId: string };

const isDomainPurchaseEnabled = () => process.env.DOMAIN_PURCHASES_ENABLED === "true";

const requireRegistration = async ({
	organizationId,
	registrationId,
}: {
	organizationId: string;
	registrationId: string;
}) => {
	const [registration] = await db
		.select()
		.from(domainRegistrations)
		.where(and(eq(domainRegistrations.id, registrationId), eq(domainRegistrations.organizationId, organizationId)));

	if (!registration) {
		throw new DomainNotFoundError("Domain registration not found.");
	}

	return registration;
};

const recordRegistrationEvent = async ({
	organizationId,
	...event
}: AppendEventInput & { organizationId: string | null }) => {
	if (!organizationId) {
		return;
	}

	const eventIds = await db.transaction((transaction) =>
		appendEvents({ events: [event], organizationId, source: "workflow", transaction })
	);

	if (eventIds.length > 0) {
		waitUntil(wakeEventDispatcher({ eventIds }));
	}
};

const toRequirement = ({ description, key, label, options, required, type, validation }: RegistrantRequirement) => ({
	description: description ?? null,
	key,
	label: label ?? null,
	options: options ?? null,
	pattern:
		validation
			?.split("|")
			.find((rule) => rule.startsWith("regex:"))
			?.slice("regex:".length) ?? null,
	required: required ?? false,
	type: type === "enum" || type === "notice" ? type : "string",
});

export const quoteDomain = async ({ domain: input }: { domain: string }) => {
	const domain = registrationDomainSchema.parse(input);

	const [quote, requirements] = await Promise.all([
		quoteRegistrationDomain(domain),
		getRegistrantRequirements(domain),
	]);

	return {
		available: Boolean(quote),
		domain,
		purchaseEnabled: isDomainPurchaseEnabled(),
		purchasePrice: quote?.purchasePrice ?? null,
		renewalPrice: quote?.renewalPrice ?? null,
		requirements: requirements.map(toRequirement),
		years: 1,
	};
};

const matchesPattern = ({ pattern, value }: { pattern: string | null; value: string }) => {
	const body = pattern?.match(/^\/(.*)\/([a-z]*)$/u);

	return !body?.[1] || new RegExp(body[1], body[2]?.replaceAll("g", "")).test(value);
};

const validateRegistrant = async ({ domain, input }: { domain: string; input: Record<string, string> }) => {
	const values = new Map(
		Object.entries(input).flatMap(([key, value]) => (value.trim() ? [[key, value.trim()] as const] : []))
	);

	const baseKeys = new Set([...baseRegistrantSchema.keyof().options, "fax"]);

	const base = baseRegistrantSchema.safeParse(
		Object.fromEntries([...values].filter(([key]) => baseKeys.has(key) && key !== "fax"))
	);

	const requirements = (await getRegistrantRequirements(domain)).map(toRequirement);

	const invalid = new Set([
		...(base.error?.issues.map((issue) => String(issue.path[0])) ?? []),
		...requirements
			.filter((field) => {
				const value = values.get(field.key) ?? "";

				if (field.type === "notice" || !value) {
					return field.type !== "notice" && field.required;
				}

				return (
					(field.options !== null && !field.options.some((option) => option.value === value)) ||
					!matchesPattern({ pattern: field.pattern, value })
				);
			})
			.map((field) => field.key),
	]);

	if (!base.success || invalid.size > 0) {
		throw new DomainRegistrantError([...invalid]);
	}

	const additional = Object.fromEntries(
		requirements.flatMap((field) => {
			const value = values.get(field.key);

			return !baseKeys.has(field.key) && value ? [[field.key, value]] : [];
		})
	);

	return Object.keys(additional).length > 0 ? { ...base.data, additional } : base.data;
};

export const prepareDomainPurchase = async ({
	autoRenew,
	domain: input,
	expectedPrice,
	organizationId,
	registrant,
	websiteId,
}: Scope & {
	autoRenew: boolean;
	domain: string;
	expectedPrice: number;
	registrant: Record<string, string>;
}) => {
	const domain = registrationDomainSchema.parse(input);

	if (isPlatformHostname(domain)) {
		throw new DomainConflictError("Domain is not available.");
	}

	const parsedRegistrant = await validateRegistrant({ domain, input: registrant });

	if (!isDomainPurchaseEnabled()) {
		throw new DomainPurchaseDisabledError("Domain purchases are not enabled.");
	}

	const [website] = await db
		.select({ id: websites.id })
		.from(websites)
		.where(and(eq(websites.id, websiteId), eq(websites.organizationId, organizationId)));

	if (!website) {
		throw new DomainNotFoundError("Website not found.");
	}

	const connected = await db
		.select({ id: websiteDomains.id })
		.from(websiteDomains)
		.where(
			and(
				inArray(websiteDomains.hostname, getConnectionHostnames(domain)),
				or(eq(websiteDomains.ownershipVerified, true), eq(websiteDomains.websiteId, websiteId))
			)
		);

	if (connected.length > 0) {
		throw new DomainConflictError("Domain is already connected.");
	}

	const quote = await quoteRegistrationDomain(domain);

	if (!quote) {
		throw new DomainConflictError("Domain is not available.");
	}

	if (quote.purchasePrice !== expectedPrice) {
		throw new DomainPriceChangedError("Domain price changed.");
	}

	await db
		.delete(domainRegistrations)
		.where(and(eq(domainRegistrations.domain, domain), eq(domainRegistrations.status, "failed")));

	const [registration] = await db
		.insert(domainRegistrations)
		.values({
			autoRenew,
			domain,
			organizationId,
			purchasePrice: quote.purchasePrice,
			registrant: parsedRegistrant,
			renewalPrice: quote.renewalPrice,
			websiteId,
		})
		.onConflictDoNothing({ target: domainRegistrations.domain })
		.returning();

	if (!registration) {
		throw new DomainConflictError("Domain is already being registered.");
	}

	return registration;
};

export const bindDomainRegistrationRun = async ({
	registrationId,
	runId,
}: {
	registrationId: string;
	runId: string;
}) => {
	await db
		.update(domainRegistrations)
		.set({ workflowRunId: runId })
		.where(eq(domainRegistrations.id, registrationId));
};

export const submitDomainRegistrationOrder = async (registrationId: string) => {
	const [registration] = await db
		.select()
		.from(domainRegistrations)
		.where(eq(domainRegistrations.id, registrationId));

	if (!registration || registration.status !== "registering") {
		return null;
	}

	if (registration.orderId) {
		return registration.orderId;
	}

	const orderId = await buyVercelDomain({
		autoRenew: registration.autoRenew,
		domain: registration.domain,
		expectedPrice: registration.purchasePrice,
		registrant: registration.registrant,
		years: registration.years,
	});

	await db.update(domainRegistrations).set({ orderId }).where(eq(domainRegistrations.id, registrationId));

	return orderId;
};

export const checkDomainRegistrationOrder = (orderId: string) => getVercelOrderStatus(orderId);

export const failDomainRegistration = async ({ code, registrationId }: { code: string; registrationId: string }) => {
	const [failed] = await db
		.update(domainRegistrations)
		.set({ failureCode: code, status: "failed", updatedAt: new Date().toISOString() })
		.where(and(eq(domainRegistrations.id, registrationId), eq(domainRegistrations.status, "registering")))
		.returning();

	if (failed) {
		await recordRegistrationEvent({
			actor: { type: "system" },
			data: { domain: failed.domain, registrationId: failed.id },
			organizationId: failed.organizationId,
			subject: { id: failed.id },
			type: "domain_registration.failed",
		});
	}
};

const connectRegisteredDomain = async ({ domain, id, websiteId }: DomainRegistrationRow) => {
	if (!websiteId) {
		return;
	}

	try {
		await db.transaction((tx) =>
			insertDomainGroup({
				hostname: domain,
				method: "nameservers",
				recommended: [],
				registrationId: id,
				tx,
				verified: true,
				websiteId,
			})
		);
	} catch (error) {
		if (error instanceof DomainConflictError) {
			return;
		}

		throw error;
	}

	const [connected] = await db
		.select()
		.from(websiteDomains)
		.where(and(eq(websiteDomains.hostname, domain), eq(websiteDomains.websiteId, websiteId)));

	if (connected) {
		await reconcileDomainGroup(connected);
	}
};

export const activateDomainRegistration = async (registrationId: string) => {
	const [registration] = await db
		.select()
		.from(domainRegistrations)
		.where(eq(domainRegistrations.id, registrationId));

	if (!registration || registration.status === "failed" || registration.status === "expired") {
		return;
	}

	if (registration.status === "registering") {
		const registered = await getVercelRegisteredDomain(registration.domain);
		const now = new Date().toISOString();
		await db
			.update(domainRegistrations)
			.set({ expiresAt: registered?.expiresAt ?? null, registeredAt: now, status: "active", updatedAt: now })
			.where(eq(domainRegistrations.id, registrationId));
		await recordRegistrationEvent({
			actor: { type: "system" },
			data: { domain: registration.domain, registrationId },
			organizationId: registration.organizationId,
			subject: { id: registrationId },
			type: "domain_registration.completed",
		});
	}

	await connectRegisteredDomain(registration);
};

export const setDomainRegistrationAutoRenew = async ({
	autoRenew,
	organizationId,
	registrationId,
}: {
	autoRenew: boolean;
	organizationId: string;
	registrationId: string;
}) => {
	const registration = await requireRegistration({ organizationId, registrationId });

	if (registration.status !== "active") {
		throw new DomainConflictError("Only active registrations can change renewal.");
	}

	await setVercelAutoRenew({ autoRenew, domain: registration.domain });
	await db
		.update(domainRegistrations)
		.set({ autoRenew, updatedAt: new Date().toISOString() })
		.where(eq(domainRegistrations.id, registrationId));
};

export const getDomainRegistrationTransferCode = async ({
	organizationId,
	registrationId,
}: {
	organizationId: string;
	registrationId: string;
}) => {
	const registration = await requireRegistration({ organizationId, registrationId });

	if (registration.status !== "active") {
		throw new DomainConflictError("Only active registrations can transfer.");
	}

	return { authCode: await getVercelAuthCode(registration.domain) };
};

const nextReminder = ({ expiresAt, registration }: { expiresAt: string; registration: DomainRegistrationRow }) => {
	const daysLeft = Math.ceil((Date.parse(expiresAt) - Date.now()) / dayMs);

	return reminderDays.findLast(
		(days) => daysLeft <= days && (registration.reminderDays === null || registration.reminderDays > days)
	);
};

const syncDomainRegistration = async (registration: DomainRegistrationRow) => {
	const registered = await getVercelRegisteredDomain(registration.domain);
	const expiresAt = registered?.expiresAt ?? registration.expiresAt;
	const autoRenew = registered?.autoRenew ?? registration.autoRenew;
	const renewed = Boolean(expiresAt && registration.expiresAt && expiresAt > registration.expiresAt);
	const expired = Boolean(expiresAt && Date.parse(expiresAt) <= Date.now());

	const reminder =
		expiresAt && !autoRenew && !expired
			? nextReminder({
					expiresAt,
					registration: renewed ? { ...registration, reminderDays: null } : registration,
				})
			: undefined;

	await db
		.update(domainRegistrations)
		.set({
			autoRenew,
			expiresAt,
			reminderDays: reminder ?? (renewed ? null : registration.reminderDays),
			status: expired ? "expired" : "active",
			updatedAt: new Date().toISOString(),
		})
		.where(eq(domainRegistrations.id, registration.id));

	if (reminder && expiresAt) {
		await recordRegistrationEvent({
			actor: { type: "system" },
			data: { days: reminder, domain: registration.domain, expiresAt, registrationId: registration.id },
			organizationId: registration.organizationId,
			subject: { id: registration.id, revision: `${expiresAt}:${reminder}` },
			type: "domain_registration.expiring",
		});
	}
};

export const syncDomainRegistrations = async () => {
	const registrations = await db
		.select()
		.from(domainRegistrations)
		.where(inArray(domainRegistrations.status, ["active", "expired"]));

	const results = await Promise.allSettled(registrations.map((registration) => syncDomainRegistration(registration)));
	await Promise.all(
		results.map(async (result, index) => {
			if (result.status === "rejected") {
				await log.warn({
					error: serializeLogError(result.reason),
					message: "Domain registration sync failed",
					registrationId: registrations[index]?.id,
				});
			}
		})
	);

	return {
		failed: results.filter((result) => result.status === "rejected").length,
		synced: registrations.length,
	};
};
