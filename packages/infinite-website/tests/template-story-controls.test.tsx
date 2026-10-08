import { describe, expect, it } from "vitest";

import { getTemplateStoryBrandArgs } from "../src/storybook/fixtures/template-brands";
import { applyTemplateBrandControls } from "../src/storybook/template-story-brand";

describe("template Brand controls", () => {
	it("normalizes custom controls into a valid Brand", () => {
		const { brand, locale: _locale, ...controls } = getTemplateStoryBrandArgs({ templateId: "nordic-edge" });

		const controlledBrand = applyTemplateBrandControls({
			brand,
			controls: {
				...controls,
				backgroundColor: "rgb(18, 52, 86)",
				cornerStyle: "square",
				fontPairing: "modern",
				headingWeight: 700,
			},
		});

		expect(controlledBrand.colors.background).toBe("#123456");
		expect(controlledBrand.typography.heading.default).toEqual({ fontId: "outfit", weight: 700 });
		expect(controlledBrand.typography.heading.scripts?.Arab).toEqual({ fontId: "noto-kufi-arabic", weight: 700 });
		expect(controlledBrand.typography.body.default.fontId).toBe("manrope");
		expect(controlledBrand.corners.style).toBe("square");
	});

	it("clamps shared weight controls to each selected variable font", () => {
		const { brand, locale: _locale, ...controls } = getTemplateStoryBrandArgs({ templateId: "nordic-edge" });

		const controlledBrand = applyTemplateBrandControls({
			brand,
			controls: { ...controls, bodyWeight: 100, fontPairing: "editorial", headingWeight: 900 },
		});

		expect(controlledBrand.typography.heading.default.weight).toBe(900);
		expect(controlledBrand.typography.heading.scripts?.Arab?.weight).toBe(700);
		expect(controlledBrand.typography.body.default.weight).toBe(200);
		expect(controlledBrand.typography.body.scripts?.Arab?.weight).toBe(400);
	});

	it("applies a curated color group as one Storybook-only combination", () => {
		const { brand, locale: _locale, ...controls } = getTemplateStoryBrandArgs({ templateId: "nordic-edge" });

		const controlledBrand = applyTemplateBrandControls({
			brand,
			controls: { ...controls, backgroundColor: "rgb(18, 52, 86)", colorGroup: "sunset" },
		});

		expect(controlledBrand.colors).toEqual({
			background: "#fff7ed",
			neutral: "#431407",
			primary: "#ea5455",
			secondary: "#f07b3f",
			tertiary: "#ffd460",
		});
	});
});
