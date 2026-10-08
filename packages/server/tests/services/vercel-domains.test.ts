import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z, ZodError } from "zod";

import {
	createWebsiteSubdomain,
	domainHostnameSchema,
	domainSearchQuerySchema,
	getConnectionHostnames,
	getOwnershipHostname,
	registrationDomainSchema,
	websiteSubdomainSchema,
} from "../../src/services/websites/domain-input";
import {
	checkDomainAvailability,
	ensureVercelDomain,
	buyVercelDomain,
	getRegistrantRequirements,
	getVercelOrderStatus,
	priceRegistrationDomains,
	quoteRegistrationDomain,
} from "../../src/services/websites/vercel-domains";

const mocks = vi.hoisted(() => ({
	availability: vi.fn(),
	bulkAvailability: vi.fn(),
	bulkPrice: vi.fn(),
	buy: vi.fn(),
	order: vi.fn(),
	price: vi.fn(),
}));

vi.mock("@vercel/sdk", () => ({
	Vercel: class {
		domainsRegistrar = {
			buySingleDomain: mocks.buy,
			getBulkAvailability: mocks.bulkAvailability,
			getBulkPrice: mocks.bulkPrice,
			getDomainAvailability: mocks.availability,
			getDomainPrice: mocks.price,
			getOrder: mocks.order,
		};
	},
}));

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubEnv("VERCEL_DOMAINS_TOKEN", "test");
	vi.stubEnv("VERCEL_DOMAINS_TEAM_ID", "test");
	vi.stubEnv("VERCEL_WEBSITES_PROJECT_ID", "test");
	mocks.availability.mockResolvedValue({ available: true });
	mocks.price.mockResolvedValue({ purchasePrice: "12.00", renewalPrice: 15, transferPrice: 12, years: 1 });
});

afterEach(() => vi.unstubAllEnvs());

describe("domain input", () => {
	it.each([
		".com",
		"foo..com",
		"https://example.com",
		"example.com/path",
		"example.com:443",
		"localhost",
		"127.0.0.1",
		"a.vercel.app",
		"xn--mgbh0fb.com",
	])("rejects invalid or private hostname %s", (hostname) => {
		expect(domainHostnameSchema.safeParse(hostname).success).toBe(false);
	});
	it("groups apex with www and verifies www through the apex record", () => {
		expect(domainHostnameSchema.parse(" Example.COM ")).toBe("example.com");
		expect(getConnectionHostnames("example.com.sa")).toEqual(["example.com.sa", "www.example.com.sa"]);
		expect(getConnectionHostnames("shop.example.ae")).toEqual(["shop.example.ae"]);
		expect(getOwnershipHostname("www.example.com")).toBe("example.com");
		expect(getOwnershipHostname("shop.example.com")).toBe("shop.example.com");
	});
	it("registers only registrable domains of any extension", () => {
		expect(registrationDomainSchema.safeParse("example.io").success).toBe(true);
		expect(registrationDomainSchema.safeParse("example.co.uk").success).toBe(true);
		expect(registrationDomainSchema.safeParse("shop.example.com").success).toBe(false);
		expect(registrationDomainSchema.safeParse("example.uk.com").success).toBe(true);
		expect(getConnectionHostnames("example.uk.com")).toEqual(["example.uk.com", "www.example.uk.com"]);
		expect(domainSearchQuerySchema.parse("brand.sa.com")).toEqual({ label: "brand", suffix: "sa.com" });
	});
	it("turns business names and domains into a search label and suffix", () => {
		expect(domainSearchQuerySchema.parse("Café Luna Studio")).toEqual({ label: "cafelunastudio", suffix: null });
		expect(domainSearchQuerySchema.parse("luna-studio")).toEqual({ label: "luna-studio", suffix: null });
		expect(domainSearchQuerySchema.parse("lunastudio.co.uk")).toEqual({ label: "lunastudio", suffix: "co.uk" });
		expect(domainSearchQuerySchema.safeParse("مقهى").success).toBe(false);
	});
	it("creates valid platform subdomains and rejects reserved ones", () => {
		expect(websiteSubdomainSchema.safeParse(createWebsiteSubdomain("Luna Café")).success).toBe(true);
		expect(createWebsiteSubdomain("مقهى")).toMatch(/^site-[a-f0-9]{6}$/u);
		expect(websiteSubdomainSchema.safeParse("admin").success).toBe(false);
		expect(websiteSubdomainSchema.safeParse("luna-studio").success).toBe(true);
	});
	it.each(["login", "auth", "secure", "pay", "checkout", "cdn", "static", "assets", "staging", "smtp"])(
		"reserves the infrastructure and account label %s",
		(label) => {
			expect(websiteSubdomainSchema.safeParse(label).success).toBe(false);
		}
	);
});

describe("Vercel registrar", () => {
	it("reads TLD registrant requirements once per extension and buys with them unstripped", async () => {
		const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) =>
			Response.json(
				url.includes("/buy")
					? { orderId: "order-1" }
					: {
							email: { required: true, type: "string", validation: "valid_email" },
							legal_type: {
								label: "Legal Type",
								options: [{ label: "Corp", value: "CCO" }],
								required: true,
								type: "enum",
							},
						}
			)
		);

		vi.stubGlobal("fetch", fetchMock);
		const requirements = await getRegistrantRequirements("luna.ca");
		expect(requirements.map((field) => field.key)).toEqual(["email", "legal_type"]);
		await getRegistrantRequirements("other.ca");
		expect(fetchMock).toHaveBeenCalledTimes(1);

		const orderId = await buyVercelDomain({
			autoRenew: true,
			domain: "luna.ca",
			expectedPrice: 16.99,
			registrant: {
				additional: { legal_type: "CCO" },
				address1: "1 Main",
				city: "Toronto",
				country: "CA",
				email: "owner@example.com",
				firstName: "Ada",
				lastName: "Lovelace",
				phone: "+14165550100",
				state: "ON",
				zip: "M5V 1A1",
			},
			years: 1,
		});

		expect(orderId).toBe("order-1");

		const body = z
			.object({
				contactInformation: z.object({ additional: z.object({ ca: z.record(z.string(), z.string()) }) }),
			})
			.parse(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)));

		expect(body.contactInformation.additional.ca).toMatchObject({ email: "owner@example.com", legal_type: "CCO" });
		expect(mocks.buy).not.toHaveBeenCalled();
		vi.unstubAllGlobals();
	});
	it("checks availability in bulk and keeps request order", async () => {
		mocks.bulkAvailability.mockResolvedValue({
			results: [
				{ available: true, domain: "luna.co" },
				{ available: false, domain: "luna.com" },
			],
		});
		expect(await checkDomainAvailability(["luna.com", "luna.co", "luna.io"])).toEqual([
			{ available: false, domain: "luna.com" },
			{ available: true, domain: "luna.co" },
			{ available: false, domain: "luna.io" },
		]);
	});
	it("prices domains in one bulk request", async () => {
		mocks.bulkPrice.mockResolvedValue({
			results: [
				{ domain: "luna.co", purchasePrice: "9.99", renewalPrice: 29.99, transferPrice: 29.99, years: 1 },
				{ domain: "luna.ai", purchasePrice: 0, renewalPrice: 0, transferPrice: 0, years: 1 },
			],
		});
		expect(await priceRegistrationDomains(["luna.co"])).toEqual([
			{ domain: "luna.co", purchasePrice: 9.99, renewalPrice: 29.99 },
		]);
		expect(mocks.bulkPrice).toHaveBeenCalledWith({
			requestBody: { domains: ["luna.co"], years: 1 },
			teamId: "test",
		});
	});
	it("quotes one year and skips pricing for taken domains", async () => {
		expect(await quoteRegistrationDomain("example.com")).toEqual({ purchasePrice: 12, renewalPrice: 15 });
		mocks.availability.mockResolvedValue({ available: false });
		mocks.price.mockClear();
		expect(await quoteRegistrationDomain("example.com")).toBeNull();
		expect(mocks.price).not.toHaveBeenCalled();
	});
	it("rejects malformed prices and missing credentials", async () => {
		mocks.price.mockResolvedValue({ purchasePrice: "NaN", renewalPrice: 10 });
		await expect(quoteRegistrationDomain("example.com")).rejects.toBeInstanceOf(ZodError);
		vi.stubEnv("VERCEL_DOMAINS_TOKEN", "");
		await expect(quoteRegistrationDomain("example.com")).rejects.toThrow("not configured");
	});
	it("rejects hosting until its project is configured", async () => {
		vi.stubEnv("VERCEL_WEBSITES_PROJECT_ID", "");
		await expect(ensureVercelDomain("example.com")).rejects.toThrow("VERCEL_WEBSITES_PROJECT_ID is required");
	});
	it.each([
		[{ domains: [{ status: "completed" }], status: "completed" }, "completed"],
		[{ domains: [{ status: "pending" }], status: "purchasing" }, "pending"],
		[{ domains: [{ status: "refunded" }], status: "completed" }, "failed"],
		[{ domains: [], status: "failed" }, "failed"],
	])("maps order %j to %s", async (order, expected) => {
		mocks.order.mockResolvedValue(order);
		expect(await getVercelOrderStatus("order")).toBe(expected);
	});
});
