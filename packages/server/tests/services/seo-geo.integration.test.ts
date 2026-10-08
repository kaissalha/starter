import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db, organizations, seoAnswerRuns, seoQuestions, websites } from "@starter/db";

import { cleanupTestActors } from "../helpers/db";

const ai = vi.hoisted(() => ({ generateText: vi.fn() }));

vi.mock("ai", async (importOriginal) => ({
	...(await importOriginal<typeof import("ai")>()),
	generateText: ai.generateText,
}));

const redis = vi.hoisted(() => ({
	eval: vi.fn(async (): Promise<number | null> => 1),
	get: vi.fn(async () => null),
	mget: vi.fn(async (...keys: Array<string>): Promise<Array<string | null>> => keys.map(() => null)),
	set: vi.fn(async () => "OK"),
}));

vi.mock("@starter/cache", async (importOriginal) => ({
	...(await importOriginal<typeof import("@starter/cache")>()),
	createTCPRedisClient: () => redis,
}));

vi.mock("../../src/lib/firecrawl", () => ({ firecrawl: { search: vi.fn() } }));

vi.mock("@vercel/functions", () => ({ waitUntil: vi.fn() }));

import {
	exploreSeoPrompt,
	getGeoOverview,
	refreshGeoQuestion,
	SeoBusinessRequiredError,
	SeoPromptLimitError,
	seedGeoOverview,
} from "../../src/services/seo/prompt-explorer";

const cleanupIds: Array<string> = [];

const snapshot = {
	brand: "North Studio",
	location: "Toronto",
	prompt: "For a customer in Toronto: Which design studios would you recommend?",
	results: [
		{
			brandMentioned: true,
			fetchedAt: "2026-01-01T00:00:00.000Z",
			model: "openai" as const,
			sources: [],
			status: "success" as const,
			text: "North Studio is great",
		},
	],
};

const createWebsite = async () => {
	const organizationId = randomUUID();
	cleanupIds.push(organizationId);
	await db.insert(organizations).values({ id: organizationId, name: "GEO test", slug: organizationId });

	const [website] = await db
		.insert(websites)
		.values({
			brief: { location: "Toronto", name: "North Studio", schemaVersion: 1, type: "Design studio" },
			locale: "en",
			organizationId,
		})
		.returning();

	return { organizationId, websiteId: website!.id };
};

const countRows = async (organizationId: string) => ({
	questions: (await db.query.seoQuestions.findMany({ where: { organizationId } })).length,
	runs: (await db.query.seoAnswerRuns.findMany({ where: { organizationId } })).length,
});

beforeEach(() => {
	vi.clearAllMocks();
	redis.eval.mockResolvedValue(1);
	vi.stubEnv("REDIS_URL", "redis://localhost:6379");
	ai.generateText.mockImplementation(async (options: { output?: unknown }) =>
		options.output
			? {
					output: {
						questions: [
							"Which design studios would you recommend?",
							"What are the best design studio options?",
							"Where can I find a reliable design studio?",
						],
					},
				}
			: { text: "A sample answer" }
	);
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await cleanupTestActors(cleanupIds);
});

describe("GEO overview", () => {
	it("reads without generating questions, calling models or inserting rows", async () => {
		const { organizationId } = await createWebsite();

		expect(await getGeoOverview({ locale: "en", organizationId })).toEqual({
			business: { location: "Toronto", name: "North Studio" },
			samples: [],
		});
		expect(ai.generateText).not.toHaveBeenCalled();
		expect(await countRows(organizationId)).toEqual({ questions: 0, runs: 0 });
	});

	it("keeps an older question's latest run when another question has many newer runs", async () => {
		const { organizationId, websiteId } = await createWebsite();

		const [older, busy] = await db
			.insert(seoQuestions)
			.values(
				["Older question", "Busy question"].map((question) => ({
					locale: "en" as const,
					organizationId,
					question,
					source: "custom" as const,
					websiteId,
				}))
			)
			.returning();

		await db.insert(seoAnswerRuns).values({
			checkedAt: "2026-01-01T00:00:00Z",
			mode: "sample",
			organizationId,
			questionId: older!.id,
			result: snapshot,
			websiteId,
		});
		await db.insert(seoAnswerRuns).values(
			Array.from({ length: 160 }, (_, index) => ({
				checkedAt: new Date(Date.parse("2026-02-01T00:00:00Z") + index * 60_000).toISOString(),
				mode: "sample" as const,
				organizationId,
				questionId: busy!.id,
				result: snapshot,
				websiteId,
			}))
		);

		const { samples } = await getGeoOverview({ locale: "en", organizationId });

		expect(samples.find(({ id }) => id === older!.id)?.result).toEqual(snapshot);
		const busySample = samples.find(({ id }) => id === busy!.id);
		expect(busySample?.history).toHaveLength(5);
		expect(busySample?.history.every(({ mentionedCount }) => mentionedCount === 1)).toBe(true);
	});

	it("seeds questions and sample runs once", async () => {
		const { organizationId } = await createWebsite();

		const seeded = await seedGeoOverview({ locale: "en", organizationId });

		expect(seeded.samples).toHaveLength(3);
		expect(seeded.samples.every(({ result, source }) => source === "generated" && result !== null)).toBe(true);
		expect((await countRows(organizationId)).runs).toBe(3);
		expect(ai.generateText).toHaveBeenCalledTimes(10);

		await seedGeoOverview({ locale: "en", organizationId });

		expect(await countRows(organizationId)).toEqual({ questions: 3, runs: 3 });
		expect(ai.generateText).toHaveBeenCalledTimes(10);
	});

	it("returns the empty shape without a website", async () => {
		const organizationId = randomUUID();
		cleanupIds.push(organizationId);
		await db.insert(organizations).values({ id: organizationId, name: "GEO test", slug: organizationId });

		expect(await getGeoOverview({ locale: "en", organizationId })).toEqual({ business: null, samples: [] });
		expect(await seedGeoOverview({ locale: "en", organizationId })).toEqual({ business: null, samples: [] });
	});
});

describe("prompt explorer cost controls", () => {
	const prompt = "Who is the best local design studio?";

	it("rejects the request past the hourly limit before any model call", async () => {
		const { organizationId } = await createWebsite();
		redis.eval.mockResolvedValue(13);

		await expect(exploreSeoPrompt({ locale: "en", organizationId, prompt })).rejects.toBeInstanceOf(
			SeoPromptLimitError
		);
		expect(ai.generateText).not.toHaveBeenCalled();
	});

	it("fails closed when the limiter is unreadable or unavailable", async () => {
		const { organizationId } = await createWebsite();
		redis.eval.mockResolvedValueOnce(null);

		await expect(exploreSeoPrompt({ locale: "en", organizationId, prompt })).rejects.toBeInstanceOf(
			SeoPromptLimitError
		);

		redis.eval.mockRejectedValueOnce(new Error("redis down"));

		await expect(exploreSeoPrompt({ locale: "en", organizationId, prompt })).rejects.toThrow("redis down");
		expect(ai.generateText).not.toHaveBeenCalled();
	});

	it("does not consume allowance for a fully cached answer", async () => {
		const { organizationId } = await createWebsite();
		const cached = JSON.stringify({ fetchedAt: new Date().toISOString(), sources: [], text: "cached answer" });
		redis.mget.mockResolvedValueOnce([cached, cached, cached]);

		const result = await exploreSeoPrompt({ locale: "en", organizationId, prompt });

		expect(result.results.every(({ status }) => status === "success")).toBe(true);
		expect(redis.eval).not.toHaveBeenCalled();
		expect(ai.generateText).not.toHaveBeenCalled();
	});

	it("reports a failing model as an error entry instead of throwing", async () => {
		const { organizationId } = await createWebsite();
		ai.generateText.mockRejectedValueOnce(new Error("model down"));
		ai.generateText.mockResolvedValue({ text: "ok" });

		const { results } = await exploreSeoPrompt({ locale: "en", organizationId, prompt });

		expect(results.filter(({ status }) => status === "error")).toHaveLength(1);
		expect(results.filter(({ status }) => status === "success")).toHaveLength(2);
	});

	it("refuses another organization's question and a missing website", async () => {
		const owner = await createWebsite();
		const foreign = await createWebsite();

		const [question] = await db
			.insert(seoQuestions)
			.values({
				locale: "en",
				organizationId: foreign.organizationId,
				question: "Which studio is best in town?",
				source: "custom",
				websiteId: foreign.websiteId,
			})
			.returning();

		if (!question) {
			throw new Error("Foreign question was not inserted");
		}

		await expect(
			refreshGeoQuestion({ mode: "sample", organizationId: owner.organizationId, questionId: question.id })
		).rejects.toBeInstanceOf(SeoBusinessRequiredError);
		expect(redis.eval).not.toHaveBeenCalled();
		expect(ai.generateText).not.toHaveBeenCalled();

		const organizationId = randomUUID();
		cleanupIds.push(organizationId);
		await db.insert(organizations).values({ id: organizationId, name: "No website", slug: organizationId });

		await expect(exploreSeoPrompt({ locale: "en", organizationId, prompt })).rejects.toBeInstanceOf(
			SeoBusinessRequiredError
		);
	});
});
