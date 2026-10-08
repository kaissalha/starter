import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ consume: vi.fn() }));

vi.mock("@starter/cache", () => ({ checkRateLimit: mocks.consume }));

import { checkAnalyticsRateLimit } from "../../src/services/analytics/collection";
import { checkWebsiteContactRateLimit } from "../../src/services/websites/contact-submission";

const headers = new Headers({ "x-real-ip": "203.0.113.7" });

beforeEach(() => {
	vi.clearAllMocks();
	mocks.consume.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
});

describe("public endpoint rate limits", () => {
	const keys = () => mocks.consume.mock.calls.map(([{ key, max, windowSeconds }]) => ({ key, max, windowSeconds }));

	it("checks the contact visitor before the whole website", async () => {
		await checkWebsiteContactRateLimit({ headers, websiteId: "site-1" });

		expect(keys()).toEqual([
			{ key: "website-contact:site-1:203.0.113.7", max: 5, windowSeconds: 600 },
			{ key: "website-contact:site-1", max: 30, windowSeconds: 300 },
		]);
	});

	it("returns a denied contact visitor without spending the website budget", async () => {
		mocks.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 9 });

		await expect(checkWebsiteContactRateLimit({ headers, websiteId: "site-1" })).resolves.toEqual({
			allowed: false,
			retryAfterSeconds: 9,
		});
		expect(mocks.consume).toHaveBeenCalledOnce();
	});

	it("checks only the website budget without a client IP", async () => {
		await checkWebsiteContactRateLimit({ headers: new Headers(), websiteId: "site-1" });

		expect(keys()).toEqual([{ key: "website-contact:site-1", max: 30, windowSeconds: 300 }]);
	});

	it("limits analytics per website visitor", async () => {
		await checkAnalyticsRateLimit({ headers, websiteId: "site-1" });

		expect(keys()).toEqual([{ key: "analytics:site-1:203.0.113.7", max: 300, windowSeconds: 60 }]);
	});

	it("allows analytics without a client IP", async () => {
		await expect(checkAnalyticsRateLimit({ headers: new Headers(), websiteId: "site-1" })).resolves.toEqual({
			allowed: true,
			retryAfterSeconds: 0,
		});
		expect(mocks.consume).not.toHaveBeenCalled();
	});
});
