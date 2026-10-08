import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	createGenerationTemplateBrand,
	websiteGenerationProfiles,
	type WebsiteSnapshotV1,
} from "@starter/infinite-website/generation";
import { templatePreviews } from "@starter/infinite-website/template-previews";

const mocks = vi.hoisted(() => ({
	getUploadedMedia: vi.fn(),
	getWebsite: vi.fn(),
	redis: new Map<string, string>(),
	resolveWebsiteAuthoringMedia: vi.fn(),
}));

vi.mock("@starter/cache", () => ({
	getFailFastRedis: () => ({
		get: async (key: string) => mocks.redis.get(key) ?? null,
		set: async (key: string, value: string) => mocks.redis.set(key, value),
	}),
}));

vi.mock("../../src/services/media", () => ({ getUploadedMedia: mocks.getUploadedMedia }));

vi.mock("../../src/services/websites/assets", () => ({
	resolveWebsiteAuthoringMedia: mocks.resolveWebsiteAuthoringMedia,
}));

vi.mock("../../src/services/websites/service", () => ({
	getWebsite: mocks.getWebsite,
	WebsiteMutationConflictError: class WebsiteMutationConflictError extends Error {},
}));

import { composeWebsiteSectionToolContract } from "../../src/ai/website-contracts";
import { prepareComposeDraft, previewWebsiteDraft, resolveImages } from "../../src/ai/website-drafts";

const original = templatePreviews[0]!;

const snapshot: WebsiteSnapshotV1 = {
	assets: original.assets,
	brand: createGenerationTemplateBrand({
		locale: "en",
		profile: websiteGenerationProfiles.find(({ templateId }) => templateId === original.id)!,
	}),
	document: { ...original.document, logic: {} },
	schemaVersion: 1,
	templateId: original.id,
};

const revision = "2026-09-18T12:00:00.000Z";

const binding = { src: "https://images.example.com/studio.jpg", type: "image" } as const;

const alt = { ar: "مشغل", en: "Studio" };

const composeInput = {
	anchor: "our-story",
	category: "features" as const,
	copy: { heading: { ar: "عنوان", en: "Heading" } },
	images: { photo: { alt, query: "sunlit studio" } },
	index: 1,
	page: "p0",
	revision,
	structure: {
		nodes: [
			{
				children: ["photo", "heading"],
				key: "surface",
				props: { padding: { blockEnd: "2rem", blockStart: "2rem", inlineEnd: "1rem", inlineStart: "1rem" } },
				type: "box" as const,
			},
			{ children: [], key: "photo", props: { alt: "photo-alt", asset: "photo" }, type: "media" as const },
			{ children: [], key: "heading", props: { content: "heading" }, type: "text" as const },
		],
		root: "surface",
	},
};

beforeEach(() => {
	mocks.redis.clear();
	mocks.getWebsite.mockResolvedValue({ id: "website-1", snapshot, updatedAt: revision });
	mocks.resolveWebsiteAuthoringMedia.mockImplementation(async (media: Record<string, { query: string }>) => ({
		assets: Object.fromEntries(Object.keys(media).map((key) => [key, crypto.randomUUID()])),
		bindings: {},
	}));
});

describe("website drafts", () => {
	it("resolves stock images once so the approved execution reuses the previewed assets", async () => {
		mocks.resolveWebsiteAuthoringMedia.mockImplementation(async () => ({
			assets: { photo: "00000000-0000-4000-8000-000000000010" },
			bindings: { "00000000-0000-4000-8000-000000000010": binding },
		}));
		const input = { images: composeInput.images, organizationId: "org-1" };

		const previewed = await resolveImages(input);
		const executed = await resolveImages(input);

		expect(mocks.resolveWebsiteAuthoringMedia).toHaveBeenCalledTimes(1);
		expect(executed).toEqual(previewed);
		await resolveImages({ images: { photo: { alt, query: "another query" } }, organizationId: "org-1" });
		await resolveImages({ ...input, organizationId: "org-2" });
		expect(mocks.resolveWebsiteAuthoringMedia).toHaveBeenCalledTimes(3);
	});

	it("binds uploaded files without searching stock images", async () => {
		const fileId = "00000000-0000-4000-8000-000000000020";
		mocks.getUploadedMedia.mockResolvedValue({ id: fileId, kind: "image", url: "https://files.example.com/a.png" });

		const resolved = await resolveImages({ images: { photo: { alt, fileId } }, organizationId: "org-1" });

		expect(mocks.resolveWebsiteAuthoringMedia).not.toHaveBeenCalled();
		expect(resolved.assets).toEqual({ photo: fileId });
		expect(resolved.assetBindings).toEqual({ [fileId]: { src: "https://files.example.com/a.png", type: "image" } });
	});

	it("previews a composed section between its real neighbours with its category, anchor and images", async () => {
		mocks.resolveWebsiteAuthoringMedia.mockResolvedValue({
			assets: { photo: "00000000-0000-4000-8000-000000000010" },
			bindings: { "00000000-0000-4000-8000-000000000010": binding },
		});
		const draft = await prepareComposeDraft({ input: composeInput, organizationId: "org-1" });
		const preview = await previewWebsiteDraft(draft);
		const page = snapshot.document.structure.pages[0]!;
		const sections = preview.document.structure.pages.find(({ id }) => id === page.id)!.sections;

		expect(sections.map(({ id }) => id)).toEqual([
			page.sections[0]!.id,
			draft.sectionId,
			...(page.sections[1] ? [page.sections[1].id] : []),
		]);
		expect(sections[1]).toMatchObject({ anchor: "our-story", category: "features" });
		expect(preview.assets["00000000-0000-4000-8000-000000000010"]).toEqual(binding);
		expect(Object.keys(preview.assets).length).toBeLessThanOrEqual(8);
		expect(preview.document.structure.layout).toEqual({ footer: [], header: [] });
		expect(snapshot.document.structure.pages[0]!.sections).toHaveLength(page.sections.length);
	});

	it.each([
		["a semantic category and kebab anchor", { anchor: "pricing-plans", category: "pricing" }, true],
		["a layout category", { category: "footer" }, false],
		["a non-kebab anchor", { anchor: "Pricing Plans" }, false],
	])("validates %s on the compose input", async (_name, fields, valid) => {
		const result = await composeWebsiteSectionToolContract.inputSchema.validate?.({
			...composeInput,
			anchor: undefined,
			category: undefined,
			...fields,
		});

		expect(result?.success).toBe(valid);
	});
});
