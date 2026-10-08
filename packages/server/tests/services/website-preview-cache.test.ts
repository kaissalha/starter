import { beforeEach, describe, expect, it, vi } from "vitest";

const { redis, values } = vi.hoisted(() => {
	const values = new Map<string, string>();

	return {
		redis: {
			mget: vi.fn(async (...keys: Array<string>) => keys.map((key) => values.get(key) ?? null)),
			on: vi.fn(),
			set: vi.fn(async (key: string, value: string) => {
				values.set(key, value);
			}),
		},
		values,
	};
});

vi.mock("@starter/cache", () => ({ createTCPRedisClient: () => redis }));

import {
	createWebsiteLayoutPreviewTarget,
	readWebsitePreviewFields,
	saveWebsitePreviewFields,
} from "../../src/services/websites/preview-cache";

const scope = { organizationId: "organization", revision: "revision-1", websiteId: "website" };

const fields = [{ path: "/copy/title", value: "Saved preview copy" }];

beforeEach(() => {
	values.clear();
	vi.clearAllMocks();
	vi.stubEnv("REDIS_URL", "redis://preview.test");
});

describe("website preview cache", () => {
	it("uses stable layout targets across durable serialization property ordering", () => {
		const first = {
			pattern: "hero",
			target: { area: "page" as const, index: 1, pageId: "page", sectionId: "section" },
		};

		const reordered = { ...first, target: Object.assign({ sectionId: first.target.sectionId }, first.target) };
		expect(createWebsiteLayoutPreviewTarget({ input: first, locale: "en" })).toBe(
			createWebsiteLayoutPreviewTarget({ input: reordered, locale: "en" })
		);
		expect(createWebsiteLayoutPreviewTarget({ input: first, locale: "en" })).not.toBe(
			createWebsiteLayoutPreviewTarget({ input: first, locale: "ar" })
		);
	});

	it("reuses validated fields only for the exact tenant, source revision and target", async () => {
		await saveWebsitePreviewFields({ fields, scope, target: "template:en:hero" });
		expect(await readWebsitePreviewFields({ scope, targets: ["template:en:hero"] })).toEqual({
			"template:en:hero": fields,
		});

		for (const other of [
			{ ...scope, organizationId: "other" },
			{ ...scope, revision: "revision-2" },
			{ ...scope, websiteId: "other" },
		]) {
			expect(await readWebsitePreviewFields({ scope: other, targets: ["template:en:hero"] })).toEqual({});
		}

		expect(await readWebsitePreviewFields({ scope, targets: ["template:ar:hero"] })).toEqual({});
		expect(redis.set).toHaveBeenCalledWith(expect.any(String), JSON.stringify(fields), "EX", 1800);
	});

	it("cannot reuse a preview that finishes after its source revision changes", async () => {
		const delayedWrite = Promise.withResolvers<void>();
		redis.set.mockImplementationOnce(async (key, value) => {
			await delayedWrite.promise;
			values.set(key, value);
		});
		const writing = saveWebsitePreviewFields({ fields, scope, target: "template:en:hero" });
		const current = { ...scope, revision: "revision-2" };
		expect(await readWebsitePreviewFields({ scope: current, targets: ["template:en:hero"] })).toEqual({});
		delayedWrite.resolve();
		await writing;
		expect(await readWebsitePreviewFields({ scope: current, targets: ["template:en:hero"] })).toEqual({});
		expect(await readWebsitePreviewFields({ scope, targets: ["template:en:hero"] })).toEqual({
			"template:en:hero": fields,
		});
	});

	it("does not persist invalid or empty model output", async () => {
		await saveWebsitePreviewFields({ fields: [{ path: "/copy/title", value: "" }], scope, target: "target" });
		expect(redis.set).not.toHaveBeenCalled();
		expect(await readWebsitePreviewFields({ scope, targets: ["target"] })).toEqual({});
	});

	it("ignores unavailable and malformed cache data", async () => {
		redis.mget.mockRejectedValueOnce(new Error("Cache unavailable"));
		expect(await readWebsitePreviewFields({ scope, targets: ["target"] })).toEqual({});
		redis.mget.mockResolvedValueOnce(["not-json"]);
		expect(await readWebsitePreviewFields({ scope, targets: ["target"] })).toEqual({});
		redis.set.mockRejectedValueOnce(new Error("Cache unavailable"));
		await expect(saveWebsitePreviewFields({ fields, scope, target: "target" })).resolves.toBeUndefined();
	});
});
