import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db, domainRegistrations, organizations, websiteDomains, websites, websiteSubdomainHistory } from "@starter/db";

import { prepareDomainPurchase } from "../../src/services/websites/domain-registrations";
import {
	connectWebsiteDomain,
	deleteDomainDnsRecord,
	disconnectWebsiteDomain,
	DomainConflictError,
	DomainLimitError,
	DomainNotFoundError,
	insertDomainGroup,
	listDomainDnsRecords,
	listWebsiteDomains,
	reconcilePendingDomains,
	reconcileWebsiteDomain,
	setPrimaryWebsiteDomain,
	updateWebsiteSubdomain,
} from "../../src/services/websites/domains";
import { resolveWebsiteHost } from "../../src/services/websites/website-host";

const mocks = vi.hoisted(() => ({ inspect: vi.fn(), list: vi.fn(), quote: vi.fn(), remove: vi.fn(), txt: vi.fn() }));

vi.mock("../../src/services/websites/vercel-domains", () => ({
	dnsRecordTypes: ["A", "AAAA", "CAA", "CNAME", "MX", "TXT"],
	getRecommendedRecords: (hostname: string) =>
		Promise.resolve([{ name: hostname, type: hostname.startsWith("www.") ? "CNAME" : "A", value: "vercel" }]),
	getRegistrantRequirements: () => Promise.resolve([]),
	inspectVercelDomain: mocks.inspect,
	listVercelDnsRecords: mocks.list,
	quoteRegistrationDomain: mocks.quote,
	removeVercelDomain: mocks.remove,
}));

vi.mock("@vercel/functions", () => ({ waitUntil: vi.fn() }));

vi.mock("node:dns/promises", () => ({
	Resolver: class {
		resolve4 = () => Promise.resolve([]);
		resolve6 = () => Promise.resolve([]);
		resolveCaa = () => Promise.resolve([]);
		resolveCname = () => Promise.resolve([]);
		resolveTxt = mocks.txt;
		setServers = vi.fn();
	},
}));

const organizationIds: Array<string> = [];

const websiteIds: Array<string> = [];

const createSite = async () => {
	const organizationId = randomUUID();
	const websiteId = randomUUID();
	organizationIds.push(organizationId);
	websiteIds.push(websiteId);
	await db.insert(organizations).values({ id: organizationId, name: "Domain test", slug: organizationId });
	await db.insert(websites).values({
		brief: { location: "Toronto", name: "Test", schemaVersion: 1, type: "Design" },
		id: websiteId,
		locale: "en",
		organizationId,
	});

	return { organizationId, websiteId };
};

const registrant = {
	address1: "1 Main St",
	city: "Toronto",
	country: "CA",
	email: "owner@example.com",
	firstName: "Test",
	lastName: "Owner",
	phone: "+15550100100",
	state: "ON",
	zip: "M5V 1A1",
};

const registrationDomains: Array<string> = [];

const createRegistration = async ({ domain, organizationId }: { domain: string; organizationId: string }) => {
	registrationDomains.push(domain);

	const [registration] = await db
		.insert(domainRegistrations)
		.values({ domain, organizationId, purchasePrice: 12, registrant, renewalPrice: 15, status: "active" })
		.returning();

	if (!registration) {
		throw new Error("Missing test registration");
	}

	return registration;
};

beforeEach(() => {
	vi.clearAllMocks();
	mocks.txt.mockResolvedValue([]);
	mocks.list.mockResolvedValue([]);
	vi.stubEnv("REDIS_URL", "");
	mocks.inspect.mockResolvedValue({ dnsReady: true, records: [], tlsReady: true });
	mocks.remove.mockResolvedValue(undefined);
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await db.delete(domainRegistrations).where(inArray(domainRegistrations.domain, registrationDomains));
	await db.delete(websiteDomains).where(inArray(websiteDomains.websiteId, websiteIds));
	await db.delete(websiteSubdomainHistory).where(inArray(websiteSubdomainHistory.websiteId, websiteIds));
	await db.delete(organizations).where(inArray(organizations.id, organizationIds));
	registrationDomains.length = 0;
	organizationIds.length = 0;
	websiteIds.length = 0;
});

describe("website domain lifecycle", () => {
	it("routes local subdomains independently without domain records or production redirects", async () => {
		const first = await createSite();
		const second = await createSite();
		vi.stubEnv("NODE_ENV", "development");

		for (const site of [first, second]) {
			expect(await resolveWebsiteHost(`${site.websiteId}.localhost:3001`)).toEqual({
				preview: true,
				primaryHostname: null,
				websiteId: site.websiteId,
			});
		}

		expect(await resolveWebsiteHost(`${randomUUID()}.localhost:3001`)).toBeNull();

		for (const host of [
			null,
			"localhost:3001",
			"127.0.0.1:3001",
			"invalid.localhost:3001",
			`extra.${first.websiteId}.localhost:3001`,
			`${first.websiteId}.localhost.evil.com:3001`,
		]) {
			expect(await resolveWebsiteHost(host)).toBeNull();
		}

		vi.stubEnv("NODE_ENV", "production");
		expect(await resolveWebsiteHost(`${first.websiteId}.localhost:3001`)).toBeNull();
	});
	it("reserves apex and www atomically, retries duplicates, and isolates organizations", async () => {
		const owner = await createSite();
		const other = await createSite();
		const input = { ...owner, hostname: "example.com" };
		const results = await Promise.all([connectWebsiteDomain(input), connectWebsiteDomain(input)]);
		expect(results.every(({ domains }) => domains.length === 2)).toBe(true);
		const [apex, www] = results[0]?.domains ?? [];
		expect(apex?.ownershipRecord).toEqual({
			name: "_starter-verification.example.com",
			type: "TXT",
			value: expect.any(String),
		});
		expect(www?.ownershipRecord).toEqual(apex?.ownershipRecord);
		expect(apex?.records).toEqual([{ name: "example.com", ready: false, type: "A", value: "vercel" }]);
		const contender = await connectWebsiteDomain({ ...other, hostname: "example.com" });
		expect(contender.domains).toHaveLength(2);
		await expect(listWebsiteDomains({ ...owner, organizationId: other.organizationId })).rejects.toBeInstanceOf(
			DomainNotFoundError
		);
		expect(await resolveWebsiteHost("example.com")).toBeNull();
		expect(mocks.inspect).not.toHaveBeenCalled();
	});
	it("verifies apex and www with one TXT proof and makes the apex primary once live", async () => {
		const scope = await createSite();
		const { domains } = await connectWebsiteDomain({ ...scope, hostname: "example.ae" });
		const [apex] = domains;

		if (!apex?.ownershipRecord) {
			throw new Error("Missing test domain");
		}

		const input = { ...scope, domainId: apex.id };
		await reconcileWebsiteDomain(input);
		expect(mocks.inspect).not.toHaveBeenCalled();
		mocks.txt.mockResolvedValue([[apex.ownershipRecord.value]]);
		mocks.inspect.mockRejectedValueOnce(new Error("timeout after attachment"));
		await expect(reconcileWebsiteDomain(input)).rejects.toThrow("timeout");
		const afterFailure = await listWebsiteDomains(scope);
		expect(afterFailure.domains.every((domain) => domain.ownershipVerified)).toBe(true);
		const { domains: live } = await reconcileWebsiteDomain(input);
		expect(live.map(({ hostname, primary, status }) => ({ hostname, primary, status }))).toEqual([
			{ hostname: "example.ae", primary: true, status: "connected" },
			{ hostname: "www.example.ae", primary: false, status: "connected" },
		]);
		expect(await resolveWebsiteHost("www.example.ae")).toEqual({
			preview: false,
			primaryHostname: "example.ae",
			websiteId: scope.websiteId,
		});
		expect(await resolveWebsiteHost("unknown.com")).toBeNull();
		const www = live.find((domain) => domain.hostname === "www.example.ae");

		if (!www) {
			throw new Error("Missing www domain");
		}

		await setPrimaryWebsiteDomain({ ...scope, domainId: www.id });
		expect((await resolveWebsiteHost("example.ae"))?.primaryHostname).toBe("www.example.ae");
	});
	it("requires the TXT proof for nameserver connections and never trusts delegation", async () => {
		const scope = await createSite();
		const { domains } = await connectWebsiteDomain({ ...scope, hostname: "example.sa", method: "nameservers" });
		const [apex] = domains;

		if (!apex?.ownershipRecord) {
			throw new Error("Missing test domain");
		}

		const input = { ...scope, domainId: apex.id };
		const { domains: pending } = await reconcileWebsiteDomain(input);
		expect(pending.every((domain) => !domain.ownershipVerified && domain.status === "pending")).toBe(true);
		expect(mocks.inspect).not.toHaveBeenCalled();
		mocks.txt.mockResolvedValue([[apex.ownershipRecord.value]]);
		const { domains: verified } = await reconcileWebsiteDomain(input);
		expect(verified.every((domain) => domain.ownershipVerified && domain.status === "connected")).toBe(true);
		await expect(listDomainDnsRecords(input)).resolves.toMatchObject({ records: [], zone: "example.sa" });
	});
	it("disconnects apex and www together and retains intent after provider failure", async () => {
		const scope = await createSite();
		const { domains } = await connectWebsiteDomain({ ...scope, hostname: "example.sa" });
		const [apex] = domains;

		if (!apex) {
			throw new Error("Missing test domain");
		}

		await db
			.update(websiteDomains)
			.set({ ownershipVerified: true, status: "connected" })
			.where(eq(websiteDomains.websiteId, scope.websiteId));
		await db.update(websiteDomains).set({ primary: true }).where(eq(websiteDomains.id, apex.id));
		const input = { ...scope, domainId: apex.id };
		mocks.remove.mockRejectedValueOnce(new Error("provider offline"));
		await expect(disconnectWebsiteDomain(input)).rejects.toThrow("provider offline");
		expect(await resolveWebsiteHost("example.sa")).toBeNull();
		expect(await resolveWebsiteHost("www.example.sa")).toBeNull();
		const remaining = (await listWebsiteDomains(scope)).domains;
		expect(remaining.map((domain) => domain.status)).toEqual(["disconnecting"]);
		await reconcileWebsiteDomain({ ...scope, domainId: remaining[0]?.id ?? "" });
		expect((await listWebsiteDomains(scope)).domains).toEqual([]);
	});
	it("does not make a hostname primary until its certificate is ready", async () => {
		const scope = await createSite();
		const { domains } = await connectWebsiteDomain({ ...scope, hostname: "example.com" });
		const [domain] = domains;

		if (!domain?.ownershipRecord) {
			throw new Error("Missing test domain");
		}

		mocks.txt.mockResolvedValue([[domain.ownershipRecord.value]]);
		mocks.inspect.mockResolvedValue({ dnsReady: true, records: [], tlsReady: false });
		const input = { ...scope, domainId: domain.id };
		await reconcileWebsiteDomain(input);
		await expect(setPrimaryWebsiteDomain(input)).rejects.toBeInstanceOf(DomainConflictError);
		expect(await resolveWebsiteHost(domain.hostname)).toBeNull();
	});
	it("routes platform subdomains and releases stale unverified reservations", async () => {
		vi.stubEnv("WEBSITES_PLATFORM_DOMAIN", "sites.example.net");
		const scope = await createSite();
		const { address, subdomain } = await listWebsiteDomains(scope);
		expect(address).toBe(`${subdomain}.sites.example.net`);
		expect(await resolveWebsiteHost(address)).toEqual({
			preview: false,
			primaryHostname: null,
			websiteId: scope.websiteId,
		});
		await connectWebsiteDomain({ ...scope, hostname: "stale.example.com" });
		await db
			.update(websiteDomains)
			.set({ createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() })
			.where(eq(websiteDomains.websiteId, scope.websiteId));
		expect((await reconcilePendingDomains()).released).toBeGreaterThanOrEqual(1);
		expect((await listWebsiteDomains(scope)).domains).toEqual([]);
	});
	it("rejects hostnames on or above the platform domain", async () => {
		vi.stubEnv("WEBSITES_PLATFORM_DOMAIN", "sites.example.net");
		const scope = await createSite();

		for (const hostname of ["sites.example.net", "shop.sites.example.net", "example.net"]) {
			await expect(connectWebsiteDomain({ ...scope, hostname })).rejects.toBeInstanceOf(DomainConflictError);
		}

		expect((await listWebsiteDomains(scope)).domains).toEqual([]);
	});
	it("refuses to register the platform domain", async () => {
		vi.stubEnv("WEBSITES_PLATFORM_DOMAIN", "platform-sites.com");
		const scope = await createSite();
		await expect(
			prepareDomainPurchase({
				autoRenew: true,
				domain: "platform-sites.com",
				expectedPrice: 12,
				organizationId: scope.organizationId,
				registrant: {},
				websiteId: scope.websiteId,
			})
		).rejects.toBeInstanceOf(DomainConflictError);
	});
	it("keeps registered domains with the registering organization", async () => {
		const owner = await createSite();
		const other = await createSite();
		await createRegistration({ domain: "ownedbrand.com", organizationId: owner.organizationId });

		for (const hostname of ["ownedbrand.com", "shop.ownedbrand.com"]) {
			await expect(connectWebsiteDomain({ ...other, hostname })).rejects.toBeInstanceOf(DomainConflictError);
		}

		expect((await listWebsiteDomains(other)).domains).toEqual([]);
		const { domains } = await connectWebsiteDomain({ ...owner, hostname: "shop.ownedbrand.com" });
		expect(
			domains.map(({ hostname, method, ownershipVerified }) => ({ hostname, method, ownershipVerified }))
		).toEqual([{ hostname: "shop.ownedbrand.com", method: "nameservers", ownershipVerified: true }]);
	});
	it("limits the DNS editor to the organization that owns the apex zone", async () => {
		vi.stubEnv("WEBSITES_PLATFORM_DOMAIN", "platform-sites.com");
		const owner = await createSite();
		const other = await createSite();
		await createRegistration({ domain: "ownedbrand.com", organizationId: owner.organizationId });
		const mine = await createRegistration({ domain: "minebrand.com", organizationId: other.organizationId });

		const seed = async ({ hostname, registrationId }: { hostname: string; registrationId?: string }) => {
			const [row] = await db
				.insert(websiteDomains)
				.values({
					hostname,
					method: "nameservers",
					ownershipVerified: true,
					registrationId,
					status: "connected",
					websiteId: other.websiteId,
				})
				.returning();

			if (!row) {
				throw new Error("Missing test domain");
			}

			return { ...other, domainId: row.id };
		};

		for (const hostname of ["ownedbrand.com", "shop.zone.example.com", "platform-sites.com"]) {
			const denied = await seed({ hostname });
			await expect(listDomainDnsRecords(denied)).rejects.toBeInstanceOf(DomainConflictError);
			await expect(deleteDomainDnsRecord({ ...denied, recordId: "record" })).rejects.toBeInstanceOf(
				DomainConflictError
			);
		}

		const allowed = await seed({ hostname: "minebrand.com", registrationId: mine.id });
		await expect(listDomainDnsRecords(allowed)).resolves.toMatchObject({ records: [], zone: "minebrand.com" });
		expect(mocks.list).toHaveBeenCalledTimes(1);
	});
	it("evicts unverified reservations when a registration connects the domain", async () => {
		const squatter = await createSite();
		const buyer = await createSite();
		await connectWebsiteDomain({ ...squatter, hostname: "boughtbrand.com" });

		const registration = await createRegistration({
			domain: "boughtbrand.com",
			organizationId: buyer.organizationId,
		});

		await db.transaction((tx) =>
			insertDomainGroup({
				hostname: "boughtbrand.com",
				method: "nameservers",
				recommended: [],
				registrationId: registration.id,
				tx,
				verified: true,
				websiteId: buyer.websiteId,
			})
		);
		const rows = await db.select().from(websiteDomains).where(eq(websiteDomains.hostname, "boughtbrand.com"));
		expect(rows.map((row) => row.websiteId)).toEqual([buyer.websiteId]);
	});
	it("lets a verified claim evict another organization's unverified reservation", async () => {
		const squatter = await createSite();
		const owner = await createSite();
		await connectWebsiteDomain({ ...squatter, hostname: "example.com" });
		const { domains } = await connectWebsiteDomain({ ...owner, hostname: "example.com" });
		const [apex] = domains;

		if (!apex?.ownershipRecord) {
			throw new Error("Missing test domain");
		}

		mocks.txt.mockResolvedValue([[apex.ownershipRecord.value]]);
		await reconcileWebsiteDomain({ ...owner, domainId: apex.id });
		expect((await listWebsiteDomains(owner)).domains.every((domain) => domain.ownershipVerified)).toBe(true);
		expect(await db.select().from(websiteDomains).where(eq(websiteDomains.websiteId, squatter.websiteId))).toEqual(
			[]
		);
		await expect(connectWebsiteDomain({ ...squatter, hostname: "example.com" })).rejects.toBeInstanceOf(
			DomainConflictError
		);
	});
	it("keeps another organization's unverified reservation from blocking a purchase", async () => {
		vi.stubEnv("DOMAIN_PURCHASES_ENABLED", "true");
		mocks.quote.mockResolvedValue({ purchasePrice: 12, renewalPrice: 15 });
		registrationDomains.push("example.com");
		const squatter = await createSite();
		const buyer = await createSite();
		await connectWebsiteDomain({ ...squatter, hostname: "example.com" });
		const purchase = { autoRenew: true, domain: "example.com", expectedPrice: 12, registrant };
		await expect(prepareDomainPurchase({ ...purchase, ...buyer })).resolves.toMatchObject({
			domain: "example.com",
			organizationId: buyer.organizationId,
		});
		await expect(prepareDomainPurchase({ ...purchase, ...squatter })).rejects.toBeInstanceOf(DomainConflictError);
	});
	it("caps unverified hostnames per website", async () => {
		const scope = await createSite();

		for (const index of Array.from({ length: 10 }, (_, item) => item)) {
			await connectWebsiteDomain({ ...scope, hostname: `site${index}.example.com` });
		}

		await expect(connectWebsiteDomain({ ...scope, hostname: "extra.example.com" })).rejects.toBeInstanceOf(
			DomainLimitError
		);
	});
	it("holds released platform addresses for their previous website", async () => {
		const first = await createSite();
		const second = await createSite();
		const { subdomain: original } = await listWebsiteDomains(first);

		if (!original) {
			throw new Error("Missing test subdomain");
		}

		await updateWebsiteSubdomain({ ...first, subdomain: "alpha-shop-one" });
		await expect(updateWebsiteSubdomain({ ...second, subdomain: original })).rejects.toBeInstanceOf(
			DomainConflictError
		);
		await updateWebsiteSubdomain({ ...first, subdomain: original });
		await db
			.update(websiteSubdomainHistory)
			.set({ releasedAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString() })
			.where(eq(websiteSubdomainHistory.websiteId, first.websiteId));
		await expect(updateWebsiteSubdomain({ ...second, subdomain: "alpha-shop-one" })).resolves.toBeUndefined();
	});
	it("reports a subdomain claimed concurrently as a conflict", async () => {
		const [first, second] = [await createSite(), await createSite()];
		const subdomain = `site-${randomUUID().slice(0, 8)}`;

		const results = await Promise.allSettled([
			updateWebsiteSubdomain({ ...first, subdomain }),
			updateWebsiteSubdomain({ ...second, subdomain }),
		]);

		expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
		const rejected = results.find((result) => result.status === "rejected");
		expect(rejected?.reason).toBeInstanceOf(DomainConflictError);
	});
	it("checks never-checked domains before recently checked ones", async () => {
		const { websiteId } = await createSite();
		const checkedAt = new Date().toISOString();

		const [unchecked] = await db
			.insert(websiteDomains)
			.values([
				{ checkedAt: null, hostname: `${randomUUID()}.example.com`, websiteId },
				...Array.from({ length: 4 }, () => ({ checkedAt, hostname: `${randomUUID()}.example.com`, websiteId })),
			])
			.returning({ id: websiteDomains.id });

		expect((await reconcilePendingDomains({ limit: 1 })).checked).toBe(1);

		const [row] = await db
			.select({ checkedAt: websiteDomains.checkedAt })
			.from(websiteDomains)
			.where(eq(websiteDomains.id, unchecked!.id));

		expect(row?.checkedAt).not.toBeNull();
	});
});
