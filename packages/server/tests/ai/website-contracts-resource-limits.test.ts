import { describe, expect, it } from "vitest";

import { sectionAuthoringResourceLimits } from "@starter/infinite-website/editing";

import { websiteImagesSchema } from "../../src/ai/website-contracts";

describe("website authoring resource limits", () => {
	it("rejects more than 32 image intents before approval", () => {
		const images = Object.fromEntries(
			Array.from({ length: sectionAuthoringResourceLimits.media + 1 }, (_, index) => [
				`image-${index}`,
				{ alt: { ar: `صورة ${index}`, en: `Image ${index}` }, query: `editorial image ${index}` },
			])
		);

		expect(websiteImagesSchema.safeParse(images).success).toBe(false);
	});

	it("rejects image copy above the section byte budget", () => {
		const copy = "x".repeat(20_000);

		const images = Object.fromEntries(
			Array.from({ length: 7 }, (_, index) => [
				`image-${index}`,
				{ alt: { ar: copy, en: copy }, query: `editorial image ${index}` },
			])
		);

		expect(websiteImagesSchema.safeParse(images).success).toBe(false);
	});
});
