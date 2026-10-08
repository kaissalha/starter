import { describe, expect, it } from "vitest";

import { brandColorSchema, brandColorsSchema } from "../src/colors";

describe("Brand colors", () => {
	it("normalizes six-digit hexadecimal colors", () => {
		expect(brandColorSchema.parse("#A1B2C3")).toBe("#a1b2c3");
	});

	it("rejects shorthand, alpha, and CSS color functions", () => {
		["#abc", "#a1b2c3ff", "rgb(1 2 3)", "oklch(50% 0.1 20)"].forEach((color) => {
			expect(brandColorSchema.safeParse(color).success).toBe(false);
		});
	});

	it("accepts exactly the five authored roles", () => {
		const colors = {
			background: "#ffffff",
			neutral: "#111111",
			primary: "#ff0000",
			secondary: "#00ff00",
			tertiary: "#0000ff",
		};

		expect(brandColorsSchema.safeParse(colors).success).toBe(true);
		expect(brandColorsSchema.safeParse({ ...colors, action: "#000000" }).success).toBe(false);
	});
});
