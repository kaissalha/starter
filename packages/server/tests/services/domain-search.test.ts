import { beforeEach, describe, expect, it, vi } from "vitest";

import { suggestDomains } from "../../src/services/websites/domain-search";

const mocks = vi.hoisted(() => ({
	generate: vi.fn(),
	tlds: vi.fn(),
	website: vi.fn(),
}));

vi.mock("@starter/db", () => ({
	db: { select: () => ({ from: () => ({ where: mocks.website }) }) },
	websites: { brief: "brief", id: "id", organizationId: "organization_id" },
}));

vi.mock("../../src/services/websites/domains", () => ({ DomainNotFoundError: class extends Error {} }));

vi.mock("../../src/mastra/models", () => ({ models: { cheapFast: { model: "model", providerOptions: {} } } }));

vi.mock("ai", () => ({ generateText: mocks.generate, Output: { object: vi.fn() } }));

vi.mock("../../src/services/websites/vercel-domains", () => ({
	getSupportedTlds: mocks.tlds,
}));

const scope = { organizationId: "org", websiteId: "00000000-0000-4000-8000-000000000000" };

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubEnv("REDIS_URL", "");
	vi.stubEnv("UPSTASH_URL", "");
	mocks.website.mockResolvedValue([{ brief: { location: "Riyadh", name: "Luna", schemaVersion: 1, type: "Cafe" } }]);
	mocks.tlds.mockResolvedValue(["com", ".co", "io", "shop"]);
	mocks.generate.mockResolvedValue({ output: { names: ["lunacafe", "luna", "Bad Name", "lunacafe"] } });
});

describe("domain suggestions", () => {
	it("leads with the name on top extensions, then model suggestions, then other extensions", async () => {
		const result = await suggestDomains({ ...scope, query: "Luna" });
		expect(result.domains).toEqual(["luna.com", "luna.co", "luna.io", "lunacafe.com", "luna.shop"]);
		expect(result.unsupportedSuffix).toBeNull();
	});
	it("puts a requested extension first and flags unsupported ones", async () => {
		expect((await suggestDomains({ ...scope, query: "luna.io" })).domains[0]).toBe("luna.io");
		const unsupported = await suggestDomains({ ...scope, query: "luna.sa" });
		expect(unsupported.unsupportedSuffix).toBe("sa");
		expect(unsupported.domains[0]).toBe("luna.com");
	});
	it("falls back to deterministic suggestions when the model fails", async () => {
		mocks.generate.mockRejectedValue(new Error("model offline"));
		const result = await suggestDomains({ ...scope, query: "luna" });
		expect(result.domains).toContain("getluna.com");
		expect(result.domains).toContain("lunahq.com");
	});
	it("rejects searches for another organization's website", async () => {
		mocks.website.mockResolvedValue([]);
		await expect(suggestDomains({ ...scope, query: "luna" })).rejects.toThrow("Website not found");
		expect(mocks.tlds).not.toHaveBeenCalled();
	});
});
