import { describe, expect, it } from "vitest";

import { brandUpdateSchema } from "../src";

describe("Brand customization contract", () => {
	it("accepts partial color, font pairing, and corner updates", () => {
		expect(
			brandUpdateSchema.parse({
				colors: { primary: "#AABBCC" },
				cornerStyle: "soft",
				fontPairingId: "editorial",
			})
		).toEqual({
			colors: { primary: "#aabbcc" },
			cornerStyle: "soft",
			fontPairingId: "editorial",
		});
	});

	it("requires at least one supported setting", () => {
		expect(brandUpdateSchema.safeParse({}).success).toBe(false);
		expect(brandUpdateSchema.safeParse({ fontPairingId: "missing" }).success).toBe(false);
	});
});
