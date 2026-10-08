import { describe, expect, it } from "vitest";

import { brandFontPairings } from "../../src/fonts/pairings";
import { brandFontRoleSchema, resolveBrandFontSelection } from "../../src/typography";

describe("Brand font pairings", () => {
	it.each([
		["minimal", "inter", "inter", "noto-sans-arabic", "noto-sans-arabic"],
		["modern", "outfit", "manrope", "noto-kufi-arabic", "cairo"],
		["editorial", "playfair-display", "source-serif-4", "noto-naskh-arabic", "noto-naskh-arabic"],
	] as const)(
		"resolves %s heading and body roles for Latin and Arabic",
		(pairingId, latinHeadingId, latinBodyId, arabicHeadingId, arabicBodyId) => {
			const pairing = brandFontPairings[pairingId];
			expect(brandFontRoleSchema.safeParse(pairing.heading).success).toBe(true);
			expect(brandFontRoleSchema.safeParse(pairing.body).success).toBe(true);
			expect(resolveBrandFontSelection({ locale: "en", role: pairing.heading }).fontId).toBe(latinHeadingId);
			expect(resolveBrandFontSelection({ locale: "en", role: pairing.body }).fontId).toBe(latinBodyId);
			expect(resolveBrandFontSelection({ locale: "ar", role: pairing.heading }).fontId).toBe(arabicHeadingId);
			expect(resolveBrandFontSelection({ locale: "ar", role: pairing.body }).fontId).toBe(arabicBodyId);
		}
	);
});
