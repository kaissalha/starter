import { describe, expect, it } from "vitest";

import {
	brandFontRoleSchema,
	brandFontSelectionSchema,
	resolveBrandFontSelection,
	scriptSchema,
} from "../src/typography";

const role = brandFontRoleSchema.parse({
	default: { fontId: "inter", weight: 400 },
	locales: {
		"ar-SA": { fontId: "noto-kufi-arabic", weight: 600 },
		en: { fontId: "outfit", weight: 450 },
	},
	scripts: { Arab: { fontId: "noto-sans-arabic", weight: 400 } },
});

describe("Brand typography", () => {
	it("resolves locale, base locale, script, then default", () => {
		expect(resolveBrandFontSelection({ locale: "ar-SA", role }).fontId).toBe("noto-kufi-arabic");
		expect(resolveBrandFontSelection({ locale: "en-CA", role }).fontId).toBe("outfit");
		expect(resolveBrandFontSelection({ locale: "ar-EG", role }).fontId).toBe("noto-sans-arabic");
		expect(resolveBrandFontSelection({ locale: "fr", role }).fontId).toBe("inter");
	});

	it("normalizes explicit script input", () => {
		expect(scriptSchema.parse("arab")).toBe("Arab");
		expect(resolveBrandFontSelection({ locale: "en", role, script: "arab" }).fontId).toBe("outfit");
	});

	it("accepts catalog-backed variable settings", () => {
		expect(
			brandFontSelectionSchema.parse({
				axes: { wdth: 92.5 },
				fontId: "noto-sans-arabic",
				weight: 500,
			})
		).toEqual({
			axes: { wdth: 92.5 },
			fontId: "noto-sans-arabic",
			weight: 500,
		});
	});

	it("rejects invalid IDs, weights, axes, and noncanonical override keys", () => {
		expect(brandFontSelectionSchema.safeParse({ fontId: "Inter Variable", weight: 400 }).success).toBe(false);
		expect(brandFontSelectionSchema.safeParse({ fontId: "missing", weight: 400 }).success).toBe(false);
		expect(brandFontSelectionSchema.safeParse({ fontId: "inter", weight: 1001 }).success).toBe(false);

		expect(brandFontSelectionSchema.safeParse({ axes: { wght: 700 }, fontId: "inter", weight: 400 }).success).toBe(
			false
		);

		expect(brandFontSelectionSchema.safeParse({ axes: { width: 90 }, fontId: "inter", weight: 400 }).success).toBe(
			false
		);

		expect(
			brandFontSelectionSchema.safeParse({ axes: { wdth: Infinity }, fontId: "inter", weight: 400 }).success
		).toBe(false);

		expect(
			brandFontRoleSchema.safeParse({
				default: { fontId: "inter", weight: 400 },
				scripts: { arab: { fontId: "noto-sans-arabic", weight: 400 } },
			}).success
		).toBe(false);

		expect(
			brandFontRoleSchema.safeParse({
				default: { fontId: "inter", weight: 400 },
				locales: { "ar-sa": { fontId: "noto-sans-arabic", weight: 400 } },
			}).success
		).toBe(false);
	});
});
