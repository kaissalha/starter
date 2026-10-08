import { waitUntil } from "@vercel/functions";
import { and, asc, eq, gt, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import {
	db,
	domainRegistrations,
	isUniqueViolation,
	websiteDomains,
	websites,
	websiteSubdomainHistory,
	type Transaction,
	type WebsiteDomainMethod,
	type WebsiteDomainRow,
} from "@starter/db";
import { log, serializeLogError } from "@starter/observability";

import type { OrganizationPermission } from "../../utils/permissions";
import { appendEvents, wakeEventDispatcher } from "../events/append";
import { requireOrganizationPermission } from "../permissions";
import { hasOwnershipTxt, inspectPublicDns } from "./domain-dns";
import {
	createWebsiteSubdomain,
	domainHostnameSchema,
	domainIdInputSchema,
	getApexHostname,
	getConnectionHostnames,
	getOwnershipHostname,
	websiteSubdomainSchema,
} from "./domain-input";
import {
	createVercelDnsRecord,
	dnsRecordTypes,
	getRecommendedRecords,
	inspectVercelDomain,
	listVercelDnsRecords,
	removeVercelDnsRecord,
	removeVercelDomain,
	updateVercelDnsRecord,
} from "./vercel-domains";
import { getWebsiteAddress, invalidateWebsiteHosts, isPlatformHostname } from "./website-host";

export class DomainConflictError extends Error {}

export class DomainNotFoundError extends Error {}

export class DomainLimitError extends Error {}

type DomainScope = { organizationId: string; websiteId: string };

type DomainInput = DomainScope & { domainId: string };

const unverifiedReservationMs = 14 * 24 * 60 * 60 * 1000;

export const getDomainScope = async ({ organizationId }: { organizationId: string }) => {
	const [website] = await db
		.select({ id: websites.id })
		.from(websites)
		.where(eq(websites.organizationId, organizationId));

	if (!website) {
		throw new DomainNotFoundError("Website not found.");
	}

	return { organizationId, websiteId: website.id };
};

export const requireDomainScope = async (actor: {
	organizationId: string;
	permission: OrganizationPermission;
	userId: string;
}) => {
	await requireOrganizationPermission(actor);

	return getDomainScope(actor);
};

const lockDomainWebsite = async (tx: Transaction, scope: DomainScope) => {
	const [website] = await tx
		.select({ id: websites.id })
		.from(websites)
		.where(and(eq(websites.id, scope.websiteId), eq(websites.organizationId, scope.organizationId)))
		.for("update");

	if (!website) {
		throw new DomainNotFoundError("Website not found.");
	}
};

const requireDomainWebsite = async ({ organizationId, websiteId }: DomainScope) => {
	const [website] = await db
		.select({
			brief: websites.brief,
			id: websites.id,
			organizationId: websites.organizationId,
			subdomain: websites.subdomain,
		})
		.from(websites)
		.where(and(eq(websites.id, websiteId), eq(websites.organizationId, organizationId)));

	if (!website) {
		throw new DomainNotFoundError("Website not found.");
	}

	return website;
};

const requireScopedDomain = async ({ domainId, ...scope }: DomainInput) => {
	await requireDomainWebsite(scope);

	const [domain] = await db
		.select()
		.from(websiteDomains)
		.where(and(eq(websiteDomains.id, domainId), eq(websiteDomains.websiteId, scope.websiteId)));

	if (!domain) {
		throw new DomainNotFoundError("Domain not found.");
	}

	return domain;
};

const settleAll = async <Item, Result>(items: Array<Item>, run: (item: Item) => Promise<Result>) => {
	const failure = (await Promise.allSettled(items.map(run))).find((result) => result.status === "rejected");

	if (failure) {
		throw failure.reason;
	}
};

const readDomainGroup = async (domain: WebsiteDomainRow) =>
	db
		.select()
		.from(websiteDomains)
		.where(
			and(
				eq(websiteDomains.websiteId, domain.websiteId),
				inArray(websiteDomains.hostname, getConnectionHostnames(getOwnershipHostname(domain.hostname)))
			)
		);

const ownershipRecord = (domain: Pick<WebsiteDomainRow, "hostname" | "verificationToken">) => ({
	name: `_starter-verification.${getOwnershipHostname(domain.hostname)}`,
	type: "TXT",
	value: domain.verificationToken,
});

const assignWebsiteSubdomain = async (website: Awaited<ReturnType<typeof requireDomainWebsite>>) => {
	const [assigned] = await db
		.update(websites)
		.set({ subdomain: createWebsiteSubdomain(website.brief.name) })
		.where(and(eq(websites.id, website.id), isNull(websites.subdomain)))
		.returning({ subdomain: websites.subdomain });

	return assigned?.subdomain ?? (await requireDomainWebsite({ ...website, websiteId: website.id })).subdomain;
};

export const updateWebsiteSubdomain = async ({ subdomain: input, ...scope }: DomainScope & { subdomain: string }) => {
	const subdomain = websiteSubdomainSchema.parse(input);
	const website = await requireDomainWebsite(scope);

	if (website.subdomain === subdomain) {
		return;
	}

	const [taken] = await db.select({ id: websites.id }).from(websites).where(eq(websites.subdomain, subdomain));

	const [held] = await db
		.select({ websiteId: websiteSubdomainHistory.websiteId })
		.from(websiteSubdomainHistory)
		.where(
			and(
				eq(websiteSubdomainHistory.subdomain, subdomain),
				gt(websiteSubdomainHistory.releasedAt, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
			)
		);

	if (taken || (held && held.websiteId !== scope.websiteId)) {
		throw new DomainConflictError("This address is taken.");
	}

	try {
		await db.transaction(async (tx) => {
			await tx.update(websites).set({ subdomain }).where(eq(websites.id, scope.websiteId));

			if (website.subdomain) {
				await tx
					.insert(websiteSubdomainHistory)
					.values({ subdomain: website.subdomain, websiteId: scope.websiteId })
					.onConflictDoUpdate({
						set: { releasedAt: new Date().toISOString(), websiteId: scope.websiteId },
						target: websiteSubdomainHistory.subdomain,
					});
			}
		});
	} catch (error) {
		if (error instanceof Error && isUniqueViolation({ error })) {
			throw new DomainConflictError("This address is taken.");
		}

		throw error;
	}

	await invalidateWebsiteHosts({
		hostnames: [website.subdomain, subdomain].flatMap((value) => getWebsiteAddress(value) ?? []),
		websiteId: scope.websiteId,
	});
};

export const listWebsiteDomains = async (scope: DomainScope) => {
	const website = await requireDomainWebsite(scope);
	const subdomain = website.subdomain ?? (await assignWebsiteSubdomain(website));

	const [domains, registrations] = await Promise.all([
		db
			.select()
			.from(websiteDomains)
			.where(eq(websiteDomains.websiteId, scope.websiteId))
			.orderBy(asc(websiteDomains.hostname)),
		db
			.select({
				autoRenew: domainRegistrations.autoRenew,
				domain: domainRegistrations.domain,
				expiresAt: domainRegistrations.expiresAt,
				id: domainRegistrations.id,
				purchasePrice: domainRegistrations.purchasePrice,
				renewalPrice: domainRegistrations.renewalPrice,
				status: domainRegistrations.status,
			})
			.from(domainRegistrations)
			.where(
				and(
					eq(domainRegistrations.organizationId, scope.organizationId),
					eq(domainRegistrations.websiteId, scope.websiteId)
				)
			)
			.orderBy(asc(domainRegistrations.domain)),
	]);

	return {
		address: getWebsiteAddress(subdomain),
		businessName: website.brief.name,
		domains: domains.map(({ verificationToken, ...domain }) => ({
			...domain,
			ownershipRecord: domain.ownershipVerified ? null : ownershipRecord({ ...domain, verificationToken }),
		})),
		registrations,
		subdomain,
	};
};

const loadRecommendedRecords = async (hostname: string) => {
	try {
		return await getRecommendedRecords(hostname);
	} catch (error) {
		await log.warn({
			error: serializeLogError(error),
			hostname,
			message: "Recommended domain records unavailable",
		});

		return [];
	}
};

export const insertDomainGroup = async ({
	hostname,
	method,
	recommended,
	registrationId = null,
	tx,
	verified = false,
	websiteId,
}: {
	hostname: string;
	method: WebsiteDomainMethod;
	recommended: Array<Array<{ name: string; type: string; value: string }>>;
	registrationId?: string | null;
	tx: Transaction;
	verified?: boolean;
	websiteId: string;
}) => {
	const verificationToken = randomUUID();

	for (const [index, name] of getConnectionHostnames(hostname).entries()) {
		if (verified) {
			await tx
				.delete(websiteDomains)
				.where(
					and(
						eq(websiteDomains.hostname, name),
						ne(websiteDomains.websiteId, websiteId),
						eq(websiteDomains.ownershipVerified, false)
					)
				);
		}

		await tx
			.insert(websiteDomains)
			.values({
				hostname: name,
				method,
				ownershipVerified: verified,
				records: (recommended[index] ?? []).map((record) => ({ ...record, ready: false })),
				registrationId,
				verificationToken,
				websiteId,
			})
			.onConflictDoNothing();
		const rows = await tx.select().from(websiteDomains).where(eq(websiteDomains.hostname, name));
		const own = rows.find((row) => row.websiteId === websiteId);

		if (
			!own ||
			own.status === "disconnecting" ||
			rows.some((row) => row.websiteId !== websiteId && row.ownershipVerified)
		) {
			throw new DomainConflictError("Domain is already connected or being disconnected.");
		}
	}
};

const readApexRegistration = async (hostname: string) => {
	const [registration] = await db
		.select({
			id: domainRegistrations.id,
			organizationId: domainRegistrations.organizationId,
			status: domainRegistrations.status,
		})
		.from(domainRegistrations)
		.where(
			and(eq(domainRegistrations.domain, getApexHostname(hostname)), ne(domainRegistrations.status, "failed"))
		);

	return registration ?? null;
};

export const connectWebsiteDomain = async ({
	hostname: input,
	method: requestedMethod = "records",
	...scope
}: DomainScope & { hostname: string; method?: WebsiteDomainMethod }) => {
	const hostname = domainHostnameSchema.parse(input);
	await requireDomainWebsite(scope);

	if (isPlatformHostname(hostname)) {
		throw new DomainConflictError("This domain is reserved.");
	}

	const registration = await readApexRegistration(hostname);

	if (registration && (registration.organizationId !== scope.organizationId || registration.status !== "active")) {
		throw new DomainConflictError("This domain is registered to another account or is not active.");
	}

	const registrationId = registration?.id ?? null;
	const method = registrationId ? "nameservers" : requestedMethod;

	const recommended =
		method === "records"
			? await Promise.all(getConnectionHostnames(hostname).map((name) => loadRecommendedRecords(name)))
			: [];

	await db.transaction(async (tx) => {
		await lockDomainWebsite(tx, scope);

		const pending =
			registrationId === null
				? await tx
						.select({ id: websiteDomains.id })
						.from(websiteDomains)
						.where(
							and(
								eq(websiteDomains.websiteId, scope.websiteId),
								eq(websiteDomains.ownershipVerified, false)
							)
						)
						.limit(10)
				: [];

		if (pending.length >= 10) {
			throw new DomainLimitError("Too many domains are waiting for verification.");
		}

		await insertDomainGroup({
			hostname,
			method,
			recommended,
			registrationId,
			tx,
			verified: registrationId !== null,
			websiteId: scope.websiteId,
		});
	});

	const [domain] = await db
		.select()
		.from(websiteDomains)
		.where(and(eq(websiteDomains.hostname, hostname), eq(websiteDomains.websiteId, scope.websiteId)));

	try {
		if (domain) {
			await reconcileDomainGroup(domain);
		}
	} catch (error) {
		await log.warn({ error: serializeLogError(error), hostname, message: "Initial domain check failed" });
	}

	return listWebsiteDomains(scope);
};

const commitOwnership = async (domain: WebsiteDomainRow) => {
	if (
		domain.ownershipVerified ||
		!(await hasOwnershipTxt({ hostname: getOwnershipHostname(domain.hostname), token: domain.verificationToken }))
	) {
		return domain.ownershipVerified;
	}

	try {
		return await db.transaction(async (tx) => {
			const [updated] = await tx
				.update(websiteDomains)
				.set({ ownershipVerified: true })
				.where(and(eq(websiteDomains.id, domain.id), ne(websiteDomains.status, "disconnecting")))
				.returning({ id: websiteDomains.id });

			if (updated) {
				await tx
					.delete(websiteDomains)
					.where(
						and(
							eq(websiteDomains.hostname, domain.hostname),
							ne(websiteDomains.id, domain.id),
							eq(websiteDomains.ownershipVerified, false)
						)
					);
			}

			return Boolean(updated);
		});
	} catch (error) {
		if (
			error instanceof Error &&
			error.cause instanceof Error &&
			"code" in error.cause &&
			error.cause.code === "23505"
		) {
			return false;
		}

		throw error;
	}
};

const inspectDomain = async (domain: WebsiteDomainRow) => {
	const ownershipVerified = await commitOwnership(domain);

	if (!ownershipVerified) {
		const pointing = domain.records.filter((record) => record.type !== "TXT");

		const expected = [
			ownershipRecord(domain),
			...(pointing.length > 0 || domain.method !== "records"
				? pointing
				: await loadRecommendedRecords(domain.hostname)),
		];

		const dns =
			domain.method === "records" ? await inspectPublicDns({ expected, hostname: domain.hostname }) : null;

		return {
			caaBlocked: dns?.caaBlocked ?? false,
			conflicts: dns?.conflicts ?? [],
			dnsReady: false,
			ownershipVerified,
			records: (dns?.records ?? domain.records).filter((record) => record.name !== ownershipRecord(domain).name),
			tlsReady: false,
		};
	}

	const vercel = await inspectVercelDomain(domain.hostname);
	const managed = domain.method === "nameservers" || Boolean(domain.registrationId);
	const dns = managed ? null : await inspectPublicDns({ expected: vercel.records, hostname: domain.hostname });

	return {
		caaBlocked: dns?.caaBlocked ?? false,
		conflicts: dns?.conflicts ?? [],
		dnsReady: vercel.dnsReady,
		ownershipVerified,
		records: dns?.records ?? vercel.records.map((record) => ({ ...record, ready: vercel.dnsReady })),
		tlsReady: vercel.tlsReady,
	};
};

const choosePrimary = async ({ tx, websiteId }: { tx: Transaction; websiteId: string }) => {
	const rows = await tx.select().from(websiteDomains).where(eq(websiteDomains.websiteId, websiteId));

	if (rows.some((row) => row.primary)) {
		return;
	}

	const connected = rows.filter((row) => row.status === "connected");

	const primary =
		connected.find((row) => getApexHostname(row.hostname) === row.hostname) ??
		connected.find((row) => !rows.some((other) => row.hostname === `www.${other.hostname}`));

	if (primary) {
		await tx.update(websiteDomains).set({ primary: true }).where(eq(websiteDomains.id, primary.id));
	}
};

const finishDisconnect = async (domain: WebsiteDomainRow) => {
	if (domain.ownershipVerified) {
		await removeVercelDomain(domain.hostname);
	}

	await db
		.delete(websiteDomains)
		.where(and(eq(websiteDomains.id, domain.id), eq(websiteDomains.status, "disconnecting")));
	await invalidateWebsiteHosts({ hostnames: [domain.hostname], websiteId: domain.websiteId });

	return null;
};

const readOrganizationId = async (websiteId: string) => {
	const [website] = await db
		.select({ organizationId: websites.organizationId })
		.from(websites)
		.where(eq(websites.id, websiteId));

	return website?.organizationId ?? null;
};

const reconcileWebsiteDomainRow = async (domain: WebsiteDomainRow) => {
	if (domain.status === "disconnecting") {
		return finishDisconnect(domain);
	}

	const organizationId = await readOrganizationId(domain.websiteId);

	if (!organizationId) {
		return null;
	}

	const state = await inspectDomain(domain);
	const now = new Date().toISOString();
	const connected = state.dnsReady && state.tlsReady;

	const result = await db.transaction(async (tx) => {
		await lockDomainWebsite(tx, { organizationId, websiteId: domain.websiteId });
		const [current] = await tx.select().from(websiteDomains).where(eq(websiteDomains.id, domain.id));

		if (!current || current.status === "disconnecting") {
			return { domain: current ?? null, eventIds: [] };
		}

		const [updated] = await tx
			.update(websiteDomains)
			.set({
				...state,
				checkedAt: now,
				connectedAt: connected ? (current.connectedAt ?? now) : current.connectedAt,
				status: connected || current.status === "connected" ? "connected" : "pending",
				updatedAt: now,
			})
			.where(eq(websiteDomains.id, domain.id))
			.returning();

		if (!updated || !connected || current.status === "connected") {
			return { domain: updated ?? null, eventIds: [] };
		}

		await choosePrimary({ tx, websiteId: domain.websiteId });

		const eventIds = current.connectedAt
			? []
			: await appendEvents({
					events: [
						{
							actor: { type: "system" },
							data: { domainId: updated.id, hostname: updated.hostname, websiteId: updated.websiteId },
							subject: { id: updated.id },
							type: "website_domain.connected",
						},
					],
					organizationId,
					source: "system",
					transaction: tx,
				});

		return { domain: updated, eventIds };
	});

	if (result.domain?.status !== domain.status || result.domain?.primary !== domain.primary) {
		await invalidateWebsiteHosts({ hostnames: [domain.hostname], websiteId: domain.websiteId });
	}

	if (result.eventIds.length > 0) {
		waitUntil(wakeEventDispatcher({ eventIds: result.eventIds }));
	}

	return result.domain;
};

export const reconcileDomainGroup = async (domain: WebsiteDomainRow) => {
	await settleAll(await readDomainGroup(domain), reconcileWebsiteDomainRow);
};

export const reconcileWebsiteDomain = async ({ domainId, ...scope }: DomainInput) => {
	await reconcileDomainGroup(await requireScopedDomain({ ...scope, domainId }));

	return listWebsiteDomains(scope);
};

export const changeWebsiteDomainMethod = async ({
	domainId,
	method,
	...scope
}: DomainInput & { method: WebsiteDomainMethod }) => {
	const domain = await requireScopedDomain({ ...scope, domainId });

	if (domain.registrationId || domain.status === "disconnecting") {
		throw new DomainConflictError("This domain's connection method cannot change.");
	}

	const group = await readDomainGroup(domain);

	const recommended =
		method === "records" ? await Promise.all(group.map((row) => loadRecommendedRecords(row.hostname))) : [];

	await db.transaction(async (tx) => {
		await lockDomainWebsite(tx, scope);

		for (const [index, row] of group.entries()) {
			await tx
				.update(websiteDomains)
				.set({
					conflicts: [],
					method,
					records:
						method === "records"
							? (recommended[index] ?? []).map((record) => ({ ...record, ready: false }))
							: row.records,
				})
				.where(eq(websiteDomains.id, row.id));
		}
	});

	return reconcileWebsiteDomain({ ...scope, domainId });
};

export const disconnectWebsiteDomain = async ({ domainId, ...scope }: DomainInput) => {
	const domain = await requireScopedDomain({ ...scope, domainId });
	const group = await readDomainGroup(domain);
	await db.transaction(async (tx) => {
		await lockDomainWebsite(tx, scope);
		await tx
			.update(websiteDomains)
			.set({ primary: false, status: "disconnecting" })
			.where(
				inArray(
					websiteDomains.id,
					group.map((row) => row.id)
				)
			);
		await choosePrimary({ tx, websiteId: scope.websiteId });
	});
	await invalidateWebsiteHosts({ hostnames: group.map((row) => row.hostname), websiteId: scope.websiteId });
	await settleAll(group, (row) => finishDisconnect({ ...row, status: "disconnecting" }));

	return listWebsiteDomains(scope);
};

export const setPrimaryWebsiteDomain = async ({ domainId, ...scope }: DomainInput) => {
	const domain = await requireScopedDomain({ ...scope, domainId });

	if (domain.status !== "connected") {
		throw new DomainConflictError("Verify DNS and TLS before selecting a primary domain.");
	}

	const hostnames = await db.transaction(async (tx) => {
		await lockDomainWebsite(tx, scope);

		const rows = await tx
			.update(websiteDomains)
			.set({ primary: false })
			.where(eq(websiteDomains.websiteId, scope.websiteId))
			.returning({ hostname: websiteDomains.hostname });

		await tx.update(websiteDomains).set({ primary: true }).where(eq(websiteDomains.id, domainId));

		return rows.map((row) => row.hostname);
	});

	await invalidateWebsiteHosts({ hostnames, websiteId: scope.websiteId });

	return listWebsiteDomains(scope);
};

const recheckIntervalMs = (domain: WebsiteDomainRow) => {
	const age = Date.now() - Date.parse(domain.createdAt);

	if (age < 60 * 60 * 1000) {
		return 60 * 1000;
	}

	return age < 24 * 60 * 60 * 1000 ? 10 * 60 * 1000 : 60 * 60 * 1000;
};

export const reconcilePendingDomains = async ({ limit = 50 }: { limit?: number } = {}) => {
	const cutoff = new Date(Date.now() - unverifiedReservationMs).toISOString();

	const released = await db
		.delete(websiteDomains)
		.where(
			and(
				eq(websiteDomains.status, "pending"),
				eq(websiteDomains.ownershipVerified, false),
				isNull(websiteDomains.registrationId),
				lt(websiteDomains.createdAt, cutoff)
			)
		)
		.returning({ hostname: websiteDomains.hostname });

	const candidates = await db
		.select()
		.from(websiteDomains)
		.where(ne(websiteDomains.status, "connected"))
		.orderBy(sql`${websiteDomains.checkedAt} asc nulls first`)
		.limit(limit * 4);

	const due = candidates
		.filter(
			(domain) =>
				domain.status === "disconnecting" ||
				!domain.checkedAt ||
				Date.now() - Date.parse(domain.checkedAt) >= recheckIntervalMs(domain)
		)
		.slice(0, limit);

	const results = await Promise.allSettled(due.map((domain) => reconcileWebsiteDomainRow(domain)));
	await Promise.all(
		results.map(async (result, index) => {
			if (result.status === "rejected") {
				await log.warn({
					error: serializeLogError(result.reason),
					hostname: due[index]?.hostname,
					message: "Pending domain could not be reconciled",
				});
			}
		})
	);

	return {
		checked: due.length,
		failed: results.filter((result) => result.status === "rejected").length,
		released: released.length,
	};
};

const routingTypes = new Set(["A", "AAAA", "ALIAS", "CNAME"]);

export const dnsRecordInputSchema = z
	.strictObject({
		mxPriority: z.int().min(0).max(65_535).optional(),
		name: z
			.string()
			.trim()
			.toLowerCase()
			.max(190)
			.regex(
				/^(?:(?:\*|[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9])?)(?:\.[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9])?)*)?$/u
			),
		ttl: z.int().min(60).max(86_400).optional(),
		type: z.enum(dnsRecordTypes),
		value: z.string().trim().min(1).max(2048),
	})
	.meta({ id: "DnsRecordInput" });

export const dnsRecordSaveInputSchema = domainIdInputSchema
	.extend({ record: dnsRecordInputSchema, recordId: z.string().min(1).max(64).optional() })
	.meta({ id: "SaveDnsRecordInput" });

const isLockedRecord = ({ name, type }: { name: string; type: string }) =>
	name.startsWith("_vercel") ||
	name.startsWith("_starter-verification") ||
	(routingTypes.has(type) && (name === "" || name === "www"));

const requireManagedZone = async (input: DomainInput) => {
	const domain = await requireScopedDomain(input);
	const zone = getApexHostname(domain.hostname);

	const managed =
		domain.ownershipVerified &&
		(domain.method === "nameservers" || Boolean(domain.registrationId)) &&
		getOwnershipHostname(domain.hostname) === zone &&
		!isPlatformHostname(zone);

	const registration = managed ? await readApexRegistration(zone) : null;

	if (!managed || (registration && registration.organizationId !== input.organizationId)) {
		throw new DomainConflictError("DNS records are managed at your domain provider.");
	}

	return zone;
};

const assertEditable = (record: { name: string; type: string }) => {
	if (isLockedRecord(record)) {
		throw new DomainConflictError("This record keeps your website online and cannot be changed.");
	}
};

export const listDomainDnsRecords = async (scope: DomainInput) => {
	const zone = await requireManagedZone(scope);
	const records = await listVercelDnsRecords(zone);

	return {
		records: records
			.map((record) => ({ ...record, locked: isLockedRecord(record) }))
			.toSorted((left, right) => left.type.localeCompare(right.type) || left.name.localeCompare(right.name)),
		zone,
	};
};

const requireEditableRecord = async ({ recordId, zone }: { recordId: string; zone: string }) => {
	const existing = (await listVercelDnsRecords(zone)).find((record) => record.id === recordId);

	if (!existing) {
		throw new DomainNotFoundError("DNS record not found.");
	}

	assertEditable(existing);
};

export const saveDomainDnsRecord = async ({
	record,
	recordId,
	...scope
}: DomainInput & { record: z.output<typeof dnsRecordInputSchema>; recordId?: string }) => {
	const zone = await requireManagedZone(scope);
	assertEditable(record);

	if (recordId) {
		await requireEditableRecord({ recordId, zone });
		await updateVercelDnsRecord({ record, recordId });
	} else {
		await createVercelDnsRecord({ domain: zone, record });
	}

	return listDomainDnsRecords(scope);
};

export const deleteDomainDnsRecord = async ({ recordId, ...scope }: DomainInput & { recordId: string }) => {
	const zone = await requireManagedZone(scope);
	await requireEditableRecord({ recordId, zone });
	await removeVercelDnsRecord({ domain: zone, recordId });

	return listDomainDnsRecords(scope);
};
