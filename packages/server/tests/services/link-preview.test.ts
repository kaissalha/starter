import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	createRateLimiter: vi.fn(),
	createRedisClient: vi.fn(),
	fetch: vi.fn(),
	limit: vi.fn(),
	warn: vi.fn(),
}));

vi.mock("@starter/cache", () => ({
	createRateLimiter: mocks.createRateLimiter,
	createRedisClient: mocks.createRedisClient,
}));

vi.mock("@starter/observability", () => ({ log: { warn: mocks.warn }, serializeLogError: (error: Error) => error }));

const loadService = async () => import("../../src/services/link-preview");

const scope = { url: "https://www.example.com/page", userId: "user-1" };

const redis = {};

const respondWith = (body: string) => mocks.fetch.mockImplementation(async () => new Response(body));

beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	vi.stubEnv("UPSTASH_URL", "");
	vi.stubEnv("UPSTASH_TOKEN", "");
	mocks.createRedisClient.mockReturnValue(redis);
	mocks.createRateLimiter.mockReturnValue({ limit: mocks.limit });
	mocks.limit.mockResolvedValue({ success: true });
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
		vi.stubEnv("UPSTASH_URL", "https://limiter.example.test");
		vi.stubEnv("UPSTASH_TOKEN", "test-token");
		respondWith("<title>Allowed</title>");
	});

	it("limits per user with a sliding window", async () => {
		const { getLinkPreview } = await loadService();

		await getLinkPreview(scope);
		vi.stubEnv("UPSTASH_URL", "");
		vi.resetModules();
		await (await loadService()).getLinkPreview(scope);

		expect(mocks.createRateLimiter).toHaveBeenCalledTimes(1);
		expect(mocks.createRedisClient).toHaveBeenCalledWith({
			token: "test-token",
			url: "https://limiter.example.test",
		});
		expect(mocks.createRateLimiter).toHaveBeenCalledWith(
			redis,
			expect.objectContaining({
				algorithm: "slidingWindow",
				maxRequests: 30,
				prefix: "ratelimit:link-preview:",
				withinSeconds: 60,
			})
		);
		expect(mocks.limit).toHaveBeenCalledWith("user-1");
	});

	it("refuses before fetching once the limit is exceeded", async () => {
		mocks.limit.mockResolvedValue({ success: false });
		const { getLinkPreview, LinkPreviewRateLimitError } = await loadService();

		await expect(getLinkPreview(scope)).rejects.toBeInstanceOf(LinkPreviewRateLimitError);

		expect(mocks.fetch).not.toHaveBeenCalled();
	});

	it("keeps serving previews when the limiter is unavailable", async () => {
		mocks.limit.mockRejectedValue(new Error("redis down"));
		const { getLinkPreview } = await loadService();

		await expect(getLinkPreview(scope)).resolves.toMatchObject({ title: "Allowed" });

		expect(mocks.warn).toHaveBeenCalledOnce();
	});
});
