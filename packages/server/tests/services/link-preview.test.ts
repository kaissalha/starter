import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ check: vi.fn(), fetch: vi.fn() }));

vi.mock("../../src/lib/redis", () => ({ checkRateLimit: mocks.check }));

const loadService = async () => import("../../src/services/link-preview");

const scope = { url: "https://www.example.com/page", userId: "user-1" };

const respondWith = (body: string) => mocks.fetch.mockImplementation(async () => new Response(body));

beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	mocks.check.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
	vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("link preview metadata", () => {
	it("reads Open Graph metadata and a relative favicon", async () => {
		respondWith(
			`<head><META CONTENT='Luna Cafe' PROPERTY='og:title'><meta property="og:description" content="Fresh coffee"><meta property="og:site_name" content="Luna"><link href="/icon.png" rel="shortcut icon"><title>Ignored</title></head>`
		);
		const { getLinkPreview } = await loadService();

		await expect(getLinkPreview(scope)).resolves.toEqual({
			description: "Fresh coffee",
			favicon: "https://www.example.com/icon.png",
			siteName: "Luna",
			title: "Luna Cafe",
			url: scope.url,
		});
		expect(mocks.fetch).toHaveBeenCalledWith(
			scope.url,
			expect.objectContaining({ signal: expect.any(AbortSignal) })
		);
	});

	it("falls back to the title element, the host name and the site favicon", async () => {
		respondWith(`<title>Plain page</title><meta name="description" content="Plain description">`);
		const { getLinkPreview } = await loadService();

		await expect(getLinkPreview(scope)).resolves.toEqual({
			description: "Plain description",
			favicon: "https://www.example.com/favicon.ico",
			siteName: "example.com",
			title: "Plain page",
			url: scope.url,
		});
	});

	it("only returns http(s) favicons", async () => {
		respondWith(
			`<link rel="icon" href="javascript:void(0)"><link rel="icon" href="data:image/png;base64,AAAA"><meta property="og:image" content="https://cdn.example.com/card.png">`
		);
		const { getLinkPreview } = await loadService();

		await expect(getLinkPreview(scope)).resolves.toMatchObject({ favicon: "https://cdn.example.com/card.png" });

		respondWith(`<link rel="icon" href="javascript:void(0)">`);

		await expect(getLinkPreview(scope)).resolves.toMatchObject({ favicon: "https://www.example.com/favicon.ico" });
	});

	it("bounds title and site name length", async () => {
		respondWith(`<meta property="og:site_name" content="${"s".repeat(500)}"><title>${"t".repeat(1000)}</title>`);
		const { getLinkPreview } = await loadService();

		const preview = await getLinkPreview(scope);

		expect(preview?.title).toHaveLength(200);
		expect(preview?.siteName).toHaveLength(100);
	});

	it("returns null when the fetch fails or is not successful", async () => {
		const { getLinkPreview } = await loadService();
		mocks.fetch.mockRejectedValue(new Error("refused"));
		await expect(getLinkPreview(scope)).resolves.toBeNull();

		mocks.fetch.mockImplementation(async () => new Response("<title>Missing</title>", { status: 404 }));
		await expect(getLinkPreview(scope)).resolves.toBeNull();
	});

	it("parses hostile unterminated markup without stalling", async () => {
		const { getLinkPreview } = await loadService();
		const started = performance.now();

		for (const unit of ["<link ", "<link rel='icon' ", "<meta ", "<title "]) {
			respondWith(unit.repeat(Math.floor(262_144 / unit.length)));
			await expect(getLinkPreview(scope)).resolves.toMatchObject({ title: "Untitled" });
		}

		expect(performance.now() - started).toBeLessThan(2000);
	});
});

describe("link preview rate limiting", () => {
	beforeEach(() => {
		respondWith("<title>Allowed</title>");
	});

	it("limits per user", async () => {
		const { getLinkPreview } = await loadService();

		await getLinkPreview(scope);

		expect(mocks.check).toHaveBeenCalledWith({ key: "link-preview:user-1", max: 30, windowSeconds: 60 });
	});

	it("refuses before fetching once the limit is exceeded", async () => {
		mocks.check.mockResolvedValue({ allowed: false, retryAfterSeconds: 10 });
		const { getLinkPreview, LinkPreviewRateLimitError } = await loadService();

		await expect(getLinkPreview(scope)).rejects.toBeInstanceOf(LinkPreviewRateLimitError);

		expect(mocks.fetch).not.toHaveBeenCalled();
	});
});
