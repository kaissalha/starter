import { randomBytes } from "node:crypto";
import { parse } from "tldts";
import { z } from "zod";

const registrablePrivateSuffixes = new Set([
	"br.com",
	"cn.com",
	"co.com",
	"de.com",
	"eu.com",
	"gr.com",
	"jpn.com",
	"radio.am",
	"radio.fm",
	"ru.com",
	"sa.com",
	"se.net",
	"uk.com",
	"uk.net",
	"us.com",
	"za.com",
]);

export const parseDomain = (hostname: string) => {
	const withPrivate = parse(hostname, { allowPrivateDomains: true });

	return withPrivate.isPrivate && registrablePrivateSuffixes.has(withPrivate.publicSuffix ?? "")
		? withPrivate
		: parse(hostname);
};

export const domainHostnameSchema = z
	.string()
	.trim()
	.toLowerCase()
	.max(253)
	.regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u)
	.refine((hostname) => {
		const parsed = parse(hostname, { allowPrivateDomains: true });
		const registrable = !parsed.isPrivate || registrablePrivateSuffixes.has(parsed.publicSuffix ?? "");

		return Boolean(
			parsed.domain &&
			registrable &&
			parseDomain(hostname).domain &&
			!hostname.split(".").some((label) => label.startsWith("xn--"))
		);
	}, "Use a public domain name without a URL or path.");

export const registrationDomainSchema = domainHostnameSchema.refine(
	(hostname) => parseDomain(hostname).domain === hostname,
	"Use a registrable domain such as example.com."
);

export const domainSearchQuerySchema = z
	.string()
	.trim()
	.toLowerCase()
	.min(1)
	.max(80)
	.transform((query) => {
		const hostname = domainHostnameSchema.safeParse(query);
		const parsed = hostname.success ? parseDomain(hostname.data) : null;
		const label = parsed?.domainWithoutSuffix ?? query;

		return {
			label: label
				.normalize("NFKD")
				.replaceAll(/[̀-ͯ]/gu, "")
				.replaceAll(/[^a-z0-9-]+/gu, "")
				.replaceAll(/^-+|-+$/gu, "")
				.slice(0, 63),
			suffix: parsed?.publicSuffix ?? null,
		};
	})
	.refine(({ label }) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label) && !label.startsWith("xn--"), {
		message: "Use letters, numbers, or hyphens.",
	});

const reservedSubdomains = new Set([
	"account",
	"accounts",
	"admin",
	"administrator",
	"api",
	"app",
	"assets",
	"auth",
	"billing",
	"blog",
	"cdn",
	"checkout",
	"cms",
	"dashboard",
	"dev",
	"docs",
	"email",
	"files",
	"ftp",
	"help",
	"imap",
	"login",
	"logout",
	"mail",
	"media",
	"oauth",
	"pay",
	"payment",
	"payments",
	"pop",
	"portal",
	"register",
	"secure",
	"security",
	"signin",
	"signup",
	"smtp",
	"sso",
	"staging",
	"static",
	"status",
	"support",
	"test",
	"verify",
	"webmail",
	"www",
]);

export const websiteSubdomainSchema = z
	.string()
	.trim()
	.toLowerCase()
	.regex(/^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/u)
	.refine((label) => !label.startsWith("xn--") && !reservedSubdomains.has(label), "This address is reserved.");

export const domainMethodSchema = z.enum(["records", "nameservers"]);

export const domainIdInputSchema = z.strictObject({ domainId: z.uuid() });

export const domainConnectInputSchema = z
	.strictObject({ hostname: domainHostnameSchema, method: domainMethodSchema.default("records") })
	.meta({ id: "ConnectDomainInput" });

export const domainMethodInputSchema = domainIdInputSchema.extend({ method: domainMethodSchema });

export const domainSuggestInputSchema = z.strictObject({ query: z.string().trim().min(1).max(80) });

export const domainListInputSchema = z.strictObject({ domains: z.array(registrationDomainSchema).min(1).max(30) });

export const domainQuoteInputSchema = z.strictObject({ domain: domainHostnameSchema });

export const websiteSubdomainInputSchema = z.strictObject({ subdomain: websiteSubdomainSchema });

export const domainAutoRenewInputSchema = z.strictObject({ autoRenew: z.boolean(), registrationId: z.uuid() });

export const dnsRecordDeleteInputSchema = domainIdInputSchema.extend({ recordId: z.string().min(1).max(64) });

export const getApexHostname = (hostname: string) => parseDomain(hostname).domain ?? hostname;

export const getConnectionHostnames = (hostname: string) =>
	getApexHostname(hostname) === hostname ? [hostname, `www.${hostname}`] : [hostname];

export const getOwnershipHostname = (hostname: string) => {
	const apex = getApexHostname(hostname);

	return hostname === `www.${apex}` ? apex : hostname;
};

export const createWebsiteSubdomain = (name: string) => {
	const base = name
		.normalize("NFKD")
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/gu, "-")
		.replaceAll(/^-+|-+$/gu, "")
		.slice(0, 40);

	const suffix = randomBytes(3).toString("hex");

	return base.length >= 3 ? `${base}-${suffix}` : `site-${suffix}`;
};
