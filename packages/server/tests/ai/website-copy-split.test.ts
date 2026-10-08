import { MockLanguageModelV4 } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { composeWebsiteSectionToolContract } from "../../src/ai/website-contracts";
import {
	applyComposedCopy,
	createComposedCopySchema,
	deriveComposedCopySlots,
	isWebsiteCopySplitEnabled,
	mergeComposedCopy,
} from "../../src/ai/website-copy-split";
import { generateComposedCopy } from "../../src/services/websites/composed-copy";

const example = composeWebsiteSectionToolContract.inputExamples[0]!.input;

const validated = await composeWebsiteSectionToolContract.inputSchema.validate?.(example);

if (!validated?.success) {
	throw new Error("example must validate");
}

const validInput = validated.value;

const written = {
	body: { ar: "نصنع كل قطعة يدويا.", en: "Every piece is made by hand." },
	heading: { ar: "فرن واحد", en: "One kiln" },
	"studio-photo-alt": { ar: "طاولة عمل", en: "A workbench" },
	"visit-label": { ar: "احجز زيارة", en: "Book a visit" },
};

describe("composed copy split", () => {
	afterEach(() => vi.unstubAllEnvs());

	it("is off unless the environment flag is exactly 1", () => {
		expect(isWebsiteCopySplitEnabled()).toBe(false);
		vi.stubEnv("WEBSITE_AUTHORING_COPY_SPLIT", "true");
		expect(isWebsiteCopySplitEnabled()).toBe(false);
		vi.stubEnv("WEBSITE_AUTHORING_COPY_SPLIT", "1");
		expect(isWebsiteCopySplitEnabled()).toBe(true);
	});

	it("derives one slot per referenced content key with role, container and the author's draft", () => {
		const slots = deriveComposedCopySlots(validInput);

		expect(slots.map(({ key }) => key).toSorted()).toEqual(Object.keys(written).toSorted());
		expect(slots.find(({ key }) => key === "heading")).toMatchObject({
			appearance: "heading-lg",
			draft: example.copy.heading,
			element: "h2",
			role: "text.content",
			within: "flex",
		});
		expect(slots.find(({ key }) => key === "visit-label")?.within).toBe("action");
		expect(slots.find(({ key }) => key === "studio-photo-alt")).toMatchObject({
			draft: example.images["studio-photo"].alt,
			query: "sunlit ceramics studio workbench",
			role: "media.alt",
		});
	});

	it("builds a strict schema over exactly the referenced keys", () => {
		const schema = createComposedCopySchema(deriveComposedCopySlots(validInput));

		expect(schema.safeParse(written).success).toBe(true);
		expect(schema.safeParse({ ...written, extra: written.body }).success).toBe(false);
		expect(schema.safeParse({ ...written, heading: undefined }).success).toBe(false);
		expect(schema.safeParse({ ...written, heading: { ar: "", en: "x" } }).success).toBe(false);
	});

	it("merges alt copy into the image and every other key into copy", () => {
		const { copy, images } = mergeComposedCopy({ input: validInput, output: written });

		expect(Object.keys(copy).toSorted()).toEqual(["body", "heading", "visit-label"]);
		expect(images?.["studio-photo"]).toMatchObject({
			alt: written["studio-photo-alt"],
			query: "sunlit ceramics studio workbench",
		});
	});

	it("rewrites the shared tool arguments in place and rejects non-objects", () => {
		const args = structuredClone(example);
		const merged = mergeComposedCopy({ input: validInput, output: written });

		expect(applyComposedCopy({ args, ...merged })).toBe(true);
		expect(args.copy.heading).toEqual(written.heading);
		expect(args.images["studio-photo"].alt).toEqual(written["studio-photo-alt"]);
		expect(applyComposedCopy({ args: null, ...merged })).toBe(false);
	});

	it("asks the copy model with evidence and slots, then returns the merged copy", async () => {
		const prompts: Array<string> = [];

		const model = new MockLanguageModelV4({
			doGenerate: async ({ prompt }) => {
				prompts.push(JSON.stringify(prompt));

				return {
					content: [{ text: JSON.stringify(written), type: "text" as const }],
					finishReason: { raw: "stop", unified: "stop" as const },
					usage: {
						inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 1, total: 1 },
						outputTokens: { reasoning: 0, text: 1, total: 1 },
					},
					warnings: [],
				};
			},
		});

		const result = await generateComposedCopy({
			evidence: { facts: ["result: Open Tuesday to Saturday"], requests: ["Add a studio section"] },
			input: validInput,
			model,
		});

		expect(result?.copy.heading).toEqual(written.heading);
		expect(prompts).toHaveLength(1);
		expect(prompts[0]).toContain("Open Tuesday to Saturday");
		expect(prompts[0]).toContain("visit-label");
		expect(prompts[0]).toContain("untrusted business data");
	});
});
