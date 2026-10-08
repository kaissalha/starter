import { describe, expect, it } from "vitest";

import { brandFontPairings, brandPalettePresets } from "../src";
import { areBrandFontRolesEqual, findBrandFontPairing, findBrandPalettePreset } from "../src/matching";

describe("Brand matching", () => {
	it("finds a palette preset only when every color matches", () => {
		const [preset] = brandPalettePresets;

		expect(findBrandPalettePreset({ colors: preset.colors })?.id).toBe(preset.id);
		expect(findBrandPalettePreset({ colors: { ...preset.colors, primary: "#123456" } })).toBeUndefined();
		expect(findBrandPalettePreset({ colors: undefined })).toBeUndefined();
	});

	it("finds a font pairing by full role equality, not just font ids", () => {
		const { body, heading } = brandFontPairings.modern;

		expect(findBrandFontPairing({ typography: { body, heading } })).toBe("modern");
		expect(
			findBrandFontPairing({
				typography: { body, heading: { ...heading, default: { ...heading.default, weight: 100 } } },
			})
		).toBeUndefined();
		expect(findBrandFontPairing({ pairingIds: ["minimal"], typography: { body, heading } })).toBeUndefined();
	});

	it("compares locale and script overrides", () => {
		const role = brandFontPairings["crimson-pro"].body;

		expect(areBrandFontRolesEqual({ left: role, right: role })).toBe(true);
		expect(areBrandFontRolesEqual({ left: role, right: { default: role.default } })).toBe(false);
	});
});
