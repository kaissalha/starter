import { beforeEach, describe, expect, it, vi } from "vitest";

import { createEmptyBlogPostDocument } from "@starter/infinite-website/contracts";

const mocks = vi.hoisted(() => ({
	bind: vi.fn(),
	choose: vi.fn(),
	createFile: vi.fn(),
	decide: vi.fn(),
	findFile: vi.fn(),
	generate: vi.fn(),
	insert: vi.fn(),
	read: vi.fn(),
	release: vi.fn(),
	save: vi.fn(),
	search: vi.fn(),
	stream: vi.fn(),
	translate: vi.fn(),
	values: vi.fn(),
	write: vi.fn(),
}));

vi.mock("../../src/services/content-translation", () => ({ translateContentFields: mocks.translate }));

vi.mock("ai", async (original) => ({ ...(await original()), generateText: mocks.generate, streamText: mocks.stream }));

vi.mock("workflow", () => ({
	getWorkflowMetadata: () => ({ workflowRunId: "initial-run" }),
	getWritable: () => ({ getWriter: () => ({ releaseLock: mocks.release, write: mocks.write }) }),
}));

vi.mock("../../src/ai/decisions", () => ({ evaluateDecision: mocks.decide }));

vi.mock("../../src/services/stock-image-choice", () => ({ chooseStockImageCandidate: mocks.choose }));

vi.mock("@starter/db", () => ({
	blogPosts: {},
	db: {
		insert: () => ({ values: mocks.values }),
		select: () => ({ from: () => ({ leftJoin: () => ({ where: () => ({ limit: async () => [] }) }) }) }),
	},
	organizations: { id: "id", name: "name" },
	websites: { brief: "brief", organizationId: "organizationId" },
}));

vi.mock("../../src/lib/stock-images", () => ({ bindStockImageCandidate: mocks.bind, searchStockImages: mocks.search }));

vi.mock("../../src/services/blog-posts/access", () => ({ readBlogPost: mocks.read }));

vi.mock("../../src/services/blog-posts/service", () => ({ saveGeneratedBlogPost: mocks.save }));

vi.mock("../../src/services/storage", () => ({ createFile: mocks.createFile, findFileByUrl: mocks.findFile }));

import { generateBlogDraft, prepareInitialBlogDraft } from "../../src/workflows/generate-blog-post/steps";

const input = { instructions: "", organizationId: "org-1", postId: "post-1", token: "token", topic: "Coffee" };

const content = {
	coverAlt: "Coffee",
	excerpt: "Coffee",
	paragraphs: ["Coffee story"],
	seoDescription: "Coffee",
	seoTitle: "Coffee",
	title: "Coffee",
};

const generated = { output: { ar: content, en: content } };

const acceptedReview = { answers: { verdict: { choice: "acceptable", probabilities: { acceptable: 0.9 } } } };

const rejectedReview = { answers: { verdict: { choice: "english_content", probabilities: { english_content: 0.9 } } } };

const candidate = {
	alt: "Coffee",
	height: 800,
	hotlinkUrl: "https://images.example.com/coffee.jpg",
	id: "stock:coffee",
	provider: "stock",
	sources: [],
	thumbnailUrl: "https://images.example.com/coffee-small.jpg",
	width: 1200,
};

describe("blog draft parallel cover lookup", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mocks.values.mockReturnValue({ onConflictDoNothing: mocks.insert });
		mocks.translate.mockImplementation(async ({ fields }: { fields: Array<string> }) =>
			fields.map((field) => (field ? `AR ${field}` : ""))
		);
		mocks.stream.mockImplementation((options) => {
			const pending = mocks.generate(options);

			return {
				get output() {
					return (async () => (await pending).output)();
				},
				partialOutputStream: {
					async *[Symbol.asyncIterator]() {
						yield (await pending).output;
					},
				},
			};
		});
		mocks.read.mockResolvedValue({
			document: createEmptyBlogPostDocument(),
			generationStatus: "writing",
			generationToken: "token",
		});
		mocks.generate.mockResolvedValue(generated);
		mocks.search.mockResolvedValue({ items: [] });
		mocks.choose.mockResolvedValue(null);
		mocks.decide.mockResolvedValue(acceptedReview);
	});

	it("creates an unpublished initial draft bound to the child workflow", async () => {
		mocks.read.mockResolvedValue({ generationRunId: "initial-run", generationToken: input.token });
		await expect(prepareInitialBlogDraft(input)).resolves.toBe(true);
		expect(mocks.values).toHaveBeenCalledWith({
			document: createEmptyBlogPostDocument(),
			generationRunId: "initial-run",
			generationStatus: "writing",
			generationToken: input.token,
			id: input.postId,
			organizationId: input.organizationId,
			slug: `post-${input.postId}`,
		});
		expect(mocks.insert).toHaveBeenCalledOnce();
	});

	it("leaves an existing draft owned by another run untouched", async () => {
		mocks.read.mockResolvedValue({ generationRunId: "other-run", generationToken: input.token });
		await expect(prepareInitialBlogDraft(input)).resolves.toBe(false);
		expect(mocks.generate).not.toHaveBeenCalled();
	});

	it("publishes a translated stream snapshot while preserving rich source content", async () => {
		const document = createEmptyBlogPostDocument();
		document.en.title = "Keep source";
		document.en.body.content = [
			{ content: [{ marks: [{ type: "bold" }], text: "Source paragraph", type: "text" }], type: "paragraph" },
		];
		mocks.read.mockResolvedValueOnce({ document, generationStatus: "writing", generationToken: "token" });
		const translated = await generateBlogDraft({ ...input, locale: "ar" });
		expect(translated?.en).toEqual(document.en);
		expect(translated?.ar.title).toBe("AR Keep source");
		expect(translated?.ar.body.content[0]).toMatchObject({
			content: [{ marks: [{ type: "bold" }], text: "AR Source paragraph" }],
		});
		expect(mocks.write).toHaveBeenCalledWith({ document: translated, locale: "ar" });
		expect(mocks.release).toHaveBeenCalledOnce();
	});

	it("prefers the caption-chosen cover and falls back to the first result", async () => {
		const alternative = { ...candidate, hotlinkUrl: "https://images.example.com/latte.jpg", id: "stock:latte" };
		mocks.search.mockResolvedValue({ items: [candidate, alternative] });
		mocks.choose.mockResolvedValueOnce(alternative);
		mocks.bind.mockImplementation(async ({ candidate: chosen }) => ({ ...chosen, src: chosen.hotlinkUrl }));
		expect((await generateBlogDraft(input))?.coverImage).toEqual({ src: alternative.hotlinkUrl });
		expect(mocks.stream).toHaveBeenCalledWith(
			expect.objectContaining({
				telemetry: { functionId: "blog-draft-generation", recordInputs: false, recordOutputs: false },
			})
		);
		expect(mocks.choose).toHaveBeenCalledWith(
			expect.objectContaining({ candidates: [candidate, alternative], policy: "background", query: "Coffee" })
		);
		expect((await generateBlogDraft(input))?.coverImage).toEqual({ src: candidate.hotlinkUrl });
	});

	it("repairs rejected Arabic once and requires the repair to pass review", async () => {
		const repaired = { ...content, title: "قهوة" };
		mocks.decide.mockResolvedValueOnce(rejectedReview).mockResolvedValueOnce(acceptedReview);
		mocks.generate
			.mockResolvedValueOnce(generated)
			.mockResolvedValueOnce({ output: { ar: repaired, en: content } });
		expect((await generateBlogDraft(input))?.ar.title).toBe("قهوة");
		expect(mocks.generate).toHaveBeenCalledTimes(2);
		expect(mocks.generate.mock.calls[1]?.[0].prompt).toContain('issue code "english_content"');
		expect(mocks.decide).toHaveBeenCalledWith(
			expect.objectContaining({
				functionId: "blog-arabic-localization-evaluation",
				policy: "background",
				state: expect.objectContaining({
					fields: expect.arrayContaining([
						{ path: "/ar/title", value: "Coffee" },
						{ path: "/ar/paragraphs/0", value: "Coffee story" },
					]),
				}),
			})
		);
		expect(mocks.decide).toHaveBeenCalledTimes(2);
	});

	it("fails generation when review is unavailable or its repair fails", async () => {
		mocks.decide.mockResolvedValueOnce(null);
		await expect(generateBlogDraft(input)).rejects.toThrow("review is unavailable");
		mocks.decide.mockResolvedValue(rejectedReview);
		mocks.generate.mockResolvedValueOnce(generated).mockRejectedValueOnce(new Error("repair failed"));
		await expect(generateBlogDraft(input)).rejects.toThrow("repair failed");
		mocks.generate.mockResolvedValueOnce(generated).mockResolvedValueOnce({ output: generated.output });
		await expect(generateBlogDraft(input)).rejects.toThrow("repair did not pass review");
	});

	it("rejects a localization repair that changes English content", async () => {
		mocks.decide.mockResolvedValue(rejectedReview);
		mocks.generate.mockResolvedValueOnce(generated).mockResolvedValueOnce({
			output: { ar: { ...content, title: "قهوة" }, en: { ...content, title: "Changed" } },
		});
		await expect(generateBlogDraft(input)).rejects.toThrow("changed the English draft");
	});

	it("skips the Arabic repair when the verdict accepts with high confidence", async () => {
		mocks.decide.mockResolvedValue(acceptedReview);
		expect((await generateBlogDraft(input))?.ar.title).toBe("Coffee");
		expect(mocks.generate).toHaveBeenCalledOnce();
	});

	it("starts cover lookup before article writing finishes", async () => {
		const writing = Promise.withResolvers<typeof generated>();
		mocks.generate.mockReturnValueOnce(writing.promise);
		mocks.search.mockResolvedValueOnce({ items: [candidate] });
		mocks.bind.mockResolvedValueOnce({ ...candidate, src: candidate.hotlinkUrl });
		const pending = generateBlogDraft(input);
		await vi.waitFor(() => expect(mocks.search).toHaveBeenCalledOnce());
		expect(mocks.bind).not.toHaveBeenCalled();
		expect(mocks.createFile).not.toHaveBeenCalled();
		writing.resolve(generated);
		expect(await pending).toMatchObject({ coverImage: { src: candidate.hotlinkUrl }, en: { title: "Coffee" } });
		expect(mocks.bind).toHaveBeenCalledWith({ candidate });
		expect(mocks.createFile).toHaveBeenCalledOnce();
	});

	it("never binds or registers a cover after article writing fails", async () => {
		const searching = Promise.withResolvers<{ items: Array<typeof candidate> }>();
		mocks.search.mockReturnValueOnce(searching.promise);
		mocks.generate.mockRejectedValueOnce(new Error("writing failed"));
		await expect(generateBlogDraft(input)).rejects.toThrow("writing failed");
		searching.resolve({ items: [candidate] });
		await searching.promise;
		await Promise.resolve();
		expect(mocks.bind).not.toHaveBeenCalled();
		expect(mocks.createFile).not.toHaveBeenCalled();
	});

	it("preserves existing covers and never searches when translating", async () => {
		const coverImage = { src: "https://example.com/cover.jpg" };
		mocks.read.mockResolvedValue({
			document: { ...createEmptyBlogPostDocument(), coverImage },
			generationStatus: "writing",
			generationToken: "token",
		});
		expect((await generateBlogDraft(input))?.coverImage).toEqual(coverImage);
		const source = createEmptyBlogPostDocument();
		source.en.title = "Coffee";
		source.en.body.content = [{ content: [{ text: "Coffee story", type: "text" }], type: "paragraph" }];
		mocks.read.mockResolvedValueOnce({
			document: { ...source, coverImage },
			generationStatus: "writing",
			generationToken: "token",
		});
		expect((await generateBlogDraft({ ...input, locale: "ar" }))?.coverImage).toEqual(coverImage);
		expect(mocks.search).not.toHaveBeenCalled();
	});

	it("keeps the article when cover lookup fails and skips stale runs", async () => {
		mocks.search.mockRejectedValueOnce(new Error("cover unavailable"));
		expect((await generateBlogDraft(input))?.en.title).toBe("Coffee");
		mocks.read.mockResolvedValueOnce({ generationToken: "newer" });
		expect(await generateBlogDraft(input)).toBeNull();
		expect(mocks.generate).toHaveBeenCalledOnce();
	});
});
