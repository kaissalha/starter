import { Vercel } from "@vercel/sdk";
import { SDKError } from "@vercel/sdk/models/sdkerror.js";
import { isIP } from "node:net";
import { connect } from "node:tls";
import { z } from "zod";

import type { DomainRegistrant } from "@starter/db";

import { getApexHostname, parseDomain } from "./domain-input";

class DomainProviderError extends Error {}

export const dnsRecordTypes = ["A", "AAAA", "CAA", "CNAME", "MX", "TXT"] as const;

type DnsRecordType = (typeof dnsRecordTypes)[number];

const priceSchema = z.coerce.number().finite().nonnegative();

const getVercelCredentials = () => {
	const bearerToken = process.env.VERCEL_DOMAINS_TOKEN?.trim();
	const teamId = process.env.VERCEL_DOMAINS_TEAM_ID?.trim();

	if (!bearerToken || !teamId) {
		throw new DomainProviderError(
			"Domain provider is not configured: VERCEL_DOMAINS_TOKEN and VERCEL_DOMAINS_TEAM_ID are required."
		);
	}

	return { bearerToken, teamId };
};

const getVercelDomains = () => {
	const { bearerToken, teamId } = getVercelCredentials();

	return {
		client: new Vercel({ bearerToken, retryConfig: { strategy: "none" }, timeoutMs: 15_000 }),
		teamId,
	};
};

const getVercelHosting = () => {
	const idOrName = process.env.VERCEL_WEBSITES_PROJECT_ID?.trim();

	if (!idOrName) {
		throw new DomainProviderError("Domain hosting is not configured: VERCEL_WEBSITES_PROJECT_ID is required.");
	}

	return { ...getVercelDomains(), idOrName };
};

const ignoreStatus = async <T>(statusCode: number, request: () => Promise<T>) => {
	try {
		return await request();
	} catch (error) {
		if (error instanceof SDKError && error.statusCode === statusCode) {
			return null;
		}

		throw error;
	}
};

export const getSupportedTlds = async () => {
	const { client, teamId } = getVercelDomains();

	return client.domainsRegistrar.getSupportedTlds({ teamId });
};

export const checkDomainAvailability = async (domains: Array<string>) => {
	const { client, teamId } = getVercelDomains();
	const { results } = await client.domainsRegistrar.getBulkAvailability({ requestBody: { domains }, teamId });

	return domains.map((domain) => ({
		available: results.some((result) => result.domain === domain && result.available),
		domain,
	}));
};

export const priceRegistrationDomains = async (domains: Array<string>) => {
	const { client, teamId } = getVercelDomains();
	const { results } = await client.domainsRegistrar.getBulkPrice({ requestBody: { domains, years: 1 }, teamId });

	return results
		.map((result) => ({
			domain: result.domain,
			purchasePrice: priceSchema.parse(result.purchasePrice),
			renewalPrice: priceSchema.parse(result.renewalPrice),
		}))
		.filter((result) => result.purchasePrice > 0);
};

export const quoteRegistrationDomain = async (domain: string) => {
	const { client, teamId } = getVercelDomains();
	const availability = await client.domainsRegistrar.getDomainAvailability({ domain, teamId });

	if (!availability.available) {
		return null;
	}

	const price = await client.domainsRegistrar.getDomainPrice({ domain, teamId, years: "1" });
	const purchasePrice = priceSchema.parse(price.purchasePrice);

	return purchasePrice > 0 ? { purchasePrice, renewalPrice: priceSchema.parse(price.renewalPrice) } : null;
};

const contactFieldSchema = z.object({
	description: z.string().optional(),
	label: z.string().optional(),
	options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
	required: z.boolean().optional(),
	type: z.string(),
	validation: z.string().optional(),
});

const contactSchemaSchema = z.record(z.string(), contactFieldSchema);

export type RegistrantRequirement = z.infer<typeof contactFieldSchema> & { key: string };

const requirementCache = new Map<string, { expiresAt: number; fields: Array<RegistrantRequirement> }>();

const registrarRequest = async ({ body, domain, path }: { body?: object; domain: string; path: string }) => {
	const { bearerToken, teamId } = getVercelCredentials();

	const response = await fetch(
		`https://api.vercel.com/v1/registrar/domains/${encodeURIComponent(domain)}/${path}?teamId=${teamId}`,
		{
			body: body && JSON.stringify(body),
			headers: { authorization: `Bearer ${bearerToken}`, "content-type": "application/json" },
			method: body ? "POST" : "GET",
			signal: AbortSignal.timeout(30_000),
		}
	);

	if (!response.ok) {
		throw new DomainProviderError(`Vercel registrar ${path} failed (${response.status}).`);
	}

	return response.json();
};

export const getRegistrantRequirements = async (domain: string) => {
	const tld = parseDomain(domain).publicSuffix ?? domain;
	const cached = requirementCache.get(tld);

	if (cached && cached.expiresAt > Date.now()) {
		return cached.fields;
	}

	const schema = contactSchemaSchema.parse(await registrarRequest({ domain, path: "contact-info/schema" }));
	const fields = Object.entries(schema).map(([key, field]) => ({ ...field, key }));
	requirementCache.set(tld, { expiresAt: Date.now() + 24 * 60 * 60 * 1000, fields });

	return fields;
};

export const buyVercelDomain = async ({
	autoRenew,
	domain,
	expectedPrice,
	registrant: { additional, ...contact },
	years,
}: {
	autoRenew: boolean;
	domain: string;
	expectedPrice: number;
	registrant: DomainRegistrant;
	years: number;
}) => {
	const tld = parseDomain(domain).publicSuffix ?? domain;

	const contactInformation = additional
		? { ...contact, additional: { [tld]: { ...contact, ...additional } } }
		: contact;

	const order = await registrarRequest({
		body: { autoRenew, contactInformation, expectedPrice, years },
		domain,
		path: "buy",
	});

	return z.object({ orderId: z.string() }).parse(order).orderId;
};

export const getVercelOrderStatus = async (orderId: string) => {
	const { client, teamId } = getVercelDomains();
	const order = await client.domainsRegistrar.getOrder({ orderId, teamId });

	if (order.status === "failed" || order.domains.some((domain) => ["failed", "refunded"].includes(domain.status))) {
		return "failed";
	}

	return order.status === "completed" && order.domains.every((domain) => domain.status === "completed")
		? "completed"
		: "pending";
};

export const getVercelRegisteredDomain = async (domain: string) => {
	const { client, teamId } = getVercelDomains();
	const result = await ignoreStatus(404, () => client.domains.getDomain({ domain, teamId }));

	if (!result) {
		return null;
	}

	return {
		autoRenew: result.domain.renew ?? false,
		expiresAt: result.domain.expiresAt ? new Date(result.domain.expiresAt).toISOString() : null,
	};
};

export const setVercelAutoRenew = async ({ autoRenew, domain }: { autoRenew: boolean; domain: string }) => {
	const { client, teamId } = getVercelDomains();
	await client.domainsRegistrar.updateDomainAutoRenew({ domain, requestBody: { autoRenew }, teamId });
};

export const getVercelAuthCode = async (domain: string) => {
	const { client, teamId } = getVercelDomains();
	const { authCode } = await client.domainsRegistrar.getDomainAuthCode({ domain, teamId });

	return authCode;
};

export const ensureVercelDomain = async (domain: string) => {
	const { client, idOrName, teamId } = getVercelHosting();
	const existing = await ignoreStatus(404, () => client.projects.getProjectDomain({ domain, idOrName, teamId }));

	return existing ?? client.projects.addProjectDomain({ idOrName, requestBody: { name: domain }, teamId });
};

const hasVercelCertificate = (hostname: string, address?: string) =>
	new Promise<boolean>((resolve) => {
		if (!address || isIP(address) !== 4) {
			resolve(false);

			return;
		}

		const socket = connect({ host: address, port: 443, rejectUnauthorized: true, servername: hostname });

		const finish = (ready: boolean) => {
			socket.destroy();
			resolve(ready);
		};

		socket.setTimeout(5000, () => finish(false));
		socket.once("secureConnect", () => finish(socket.authorized));
		socket.once("error", () => finish(false));
	});

const getVercelDomainConfig = async (hostname: string) => {
	const { client, idOrName, teamId } = getVercelHosting();
	const config = await client.domains.getDomainConfig({ domain: hostname, projectIdOrName: idOrName, teamId });

	return {
		addresses: config.recommendedIPv4.toSorted((a, b) => a.rank - b.rank)[0]?.value ?? [],
		cname: config.recommendedCNAME.toSorted((a, b) => a.rank - b.rank)[0]?.value,
		misconfigured: config.misconfigured,
	};
};

const toPointingRecords = ({
	addresses,
	cname,
	hostname,
}: {
	addresses: Array<string>;
	cname?: string;
	hostname: string;
}) =>
	getApexHostname(hostname) !== hostname && cname
		? [{ name: hostname, type: "CNAME", value: cname }]
		: addresses.slice(0, 1).map((value) => ({ name: hostname, type: "A", value }));

export const getRecommendedRecords = async (hostname: string) =>
	toPointingRecords({ hostname, ...(await getVercelDomainConfig(hostname)) });

export const inspectVercelDomain = async (hostname: string) => {
	const { client, idOrName, teamId } = getVercelHosting();
	const attached = await ensureVercelDomain(hostname);

	if (!attached.verified) {
		await ignoreStatus(400, () => client.projects.verifyProjectDomain({ domain: hostname, idOrName, teamId }));
	}

	const project = await client.projects.getProjectDomain({ domain: hostname, idOrName, teamId });
	const config = await getVercelDomainConfig(hostname);

	const records = [
		...(project.verification ?? []).map((record) => ({
			name: record.domain,
			type: record.type,
			value: record.value,
		})),
		...toPointingRecords({ hostname, ...config }),
	].filter((record) => record.value.length > 0);

	const dnsReady = project.verified && !config.misconfigured;
	const tlsReady = dnsReady && (await hasVercelCertificate(hostname, config.addresses[0]));

	return { dnsReady, records, tlsReady };
};

export const removeVercelDomain = async (domain: string) => {
	const { client, idOrName, teamId } = getVercelHosting();
	await ignoreStatus(404, () => client.projects.removeProjectDomain({ domain, idOrName, teamId }));
};

const dnsRecordsSchema = z.object({
	records: z.array(
		z.object({
			id: z.string(),
			mxPriority: z.number().optional(),
			name: z.string(),
			ttl: z.number().optional(),
			type: z.string(),
			value: z.string(),
		})
	),
});

export const listVercelDnsRecords = async (domain: string) => {
	const { client, teamId } = getVercelDomains();
	const response = dnsRecordsSchema.safeParse(await client.dns.getRecords({ domain, limit: "100", teamId }));

	return (response.data?.records ?? []).flatMap((record) =>
		dnsRecordTypes.some((type) => type === record.type)
			? [
					{
						id: record.id,
						mxPriority: record.mxPriority ?? null,
						name: record.name,
						ttl: record.ttl ?? null,
						type: record.type,
						value: record.value,
					},
				]
			: []
	);
};

export type DnsRecordInput = { mxPriority?: number; name: string; ttl?: number; type: DnsRecordType; value: string };

export const createVercelDnsRecord = async ({ domain, record }: { domain: string; record: DnsRecordInput }) => {
	const { client, teamId } = getVercelDomains();
	const { mxPriority, ...base } = record;
	await client.dns.createRecord({
		domain,
		requestBody: base.type === "MX" ? { ...base, mxPriority: mxPriority ?? 10, type: "MX" } : base,
		teamId,
	});
};

export const updateVercelDnsRecord = async ({ record, recordId }: { record: DnsRecordInput; recordId: string }) => {
	const { client, teamId } = getVercelDomains();
	await client.dns.updateRecord({
		recordId,
		requestBody: { ...record, mxPriority: record.type === "MX" ? (record.mxPriority ?? 10) : null },
		teamId,
	});
};

export const removeVercelDnsRecord = async ({ domain, recordId }: { domain: string; recordId: string }) => {
	const { client, teamId } = getVercelDomains();
	await ignoreStatus(404, () => client.dns.removeRecord({ domain, recordId, teamId }));
};
