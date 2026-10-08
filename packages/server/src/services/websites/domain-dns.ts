import { Resolver } from "node:dns/promises";
import { z } from "zod";

import type { WebsiteDomainRecord } from "@starter/db";

import { getApexHostname } from "./domain-input";

const missingCodes = new Set(["ENODATA", "ENOTFOUND", "ESERVFAIL", "ENOTIMP", "EREFUSED"]);

const dnsErrorSchema = z.object({ code: z.string() });

const createResolver = () => {
	const resolver = new Resolver({ timeout: 3000, tries: 1 });
	resolver.setServers(["1.1.1.1", "8.8.8.8"]);

	return resolver;
};

const resolveOrEmpty = async <T>(lookup: () => Promise<Array<T>>) => {
	try {
		return await lookup();
	} catch (error) {
		const code = dnsErrorSchema.safeParse(error).data?.code;

		if (code && missingCodes.has(code)) {
			return [];
		}

		throw error;
	}
};

const normalizeName = (value: string) => value.toLowerCase().replace(/\.$/u, "");

export const hasOwnershipTxt = async ({ hostname, token }: { hostname: string; token: string }) => {
	const records = await resolveOrEmpty(() => createResolver().resolveTxt(`_starter-verification.${hostname}`));

	return records.some((record) => record.join("") === token);
};

const findCaaRecords = async (hostname: string) => {
	const resolver = createResolver();
	const apex = getApexHostname(hostname);
	const labels = hostname.split(".");

	const candidates = labels
		.map((_, index) => labels.slice(index).join("."))
		.filter((name) => name.length >= apex.length);

	for (const name of candidates) {
		const records = await resolveOrEmpty(() => resolver.resolveCaa(name));

		if (records.length > 0) {
			return records;
		}
	}

	return [];
};

const isSameRecord = (left: { type: string; value: string }, right: { type: string; value: string }) =>
	left.type === right.type && normalizeName(left.value) === normalizeName(right.value);

export const inspectPublicDns = async ({
	expected,
	hostname,
}: {
	expected: Array<{ name: string; type: string; value: string }>;
	hostname: string;
}) => {
	const resolver = createResolver();

	const [cnames, addresses, ipv6, caa] = await Promise.all([
		resolveOrEmpty(() => resolver.resolveCname(hostname)),
		resolveOrEmpty(() => resolver.resolve4(hostname)),
		resolveOrEmpty(() => resolver.resolve6(hostname)),
		findCaaRecords(hostname),
	]);

	const current =
		cnames.length > 0
			? cnames.map((value) => ({ type: "CNAME", value }))
			: [...addresses.map((value) => ({ type: "A", value })), ...ipv6.map((value) => ({ type: "AAAA", value }))];

	const txtNames = [...new Set(expected.filter((record) => record.type === "TXT").map((record) => record.name))];

	const txt = new Map(
		await Promise.all(
			txtNames.map(
				async (name) =>
					[
						name,
						(await resolveOrEmpty(() => resolver.resolveTxt(name))).map((chunks) => chunks.join("")),
					] as const
			)
		)
	);

	const records = expected.map((record): WebsiteDomainRecord => ({
		...record,
		ready:
			record.type === "TXT"
				? (txt.get(record.name)?.includes(record.value) ?? false)
				: record.name === hostname && current.some((entry) => isSameRecord(entry, record)),
	}));

	const pointing = expected.filter((record) => record.name === hostname && record.type !== "TXT");

	const conflicts = pointing.length
		? current
				.filter((entry) => !pointing.some((record) => isSameRecord(entry, record)))
				.map((entry): WebsiteDomainRecord => ({ ...entry, name: hostname, ready: false }))
		: [];

	const caaBlocked =
		caa.length > 0 &&
		!caa.some((record) => [record.issue, record.issuewild].some((issuer) => issuer?.includes("letsencrypt.org")));

	return { caaBlocked, conflicts, records };
};
