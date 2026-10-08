import { z } from "zod";

import type { BrandFoundationV1 } from "./brand-foundation";
import { brandCornerStyles, brandCornerStyleSchema } from "./corners";
import { brandFontPairingIdSchema, brandFontPairings, brandFontPairingSchema } from "./fonts/pairings";

export const brandOptionsSchema = z.compile(
	z
		.strictObject({
			cornerStyles: z.array(brandCornerStyleSchema),
			fontPairings: z.record(brandFontPairingIdSchema, brandFontPairingSchema),
		})
		.meta({ id: "BrandOptions" })
);

export const brandOptions = brandOptionsSchema.parse({
	cornerStyles: brandCornerStyles,
	fontPairings: brandFontPairings,
});

export type BrandOptions = z.infer<typeof brandOptionsSchema>;

export const brandPalettePresets = [
	{
		colors: {
			background: "#ffffff",
			neutral: "#202020",
			primary: "#202020",
			secondary: "#dedede",
			tertiary: "#f4f4f4",
		},
		description: "Neutral black and white, restrained and minimal",
		id: "ink",
	},
	{
		colors: {
			background: "#f8fafc",
			neutral: "#172033",
			primary: "#2563eb",
			secondary: "#dbeafe",
			tertiary: "#eff6ff",
		},
		description: "Cool blue, clean and professional",
		id: "ocean",
	},
	{
		colors: {
			background: "#fffaf7",
			neutral: "#111936",
			primary: "#f25545",
			secondary: "#eadfce",
			tertiary: "#f7f0e6",
		},
		description: "Warm coral and cream, energetic and friendly",
		id: "coral",
	},
	{
		colors: {
			background: "#fbf8ff",
			neutral: "#132238",
			primary: "#bf53c7",
			secondary: "#f0b3de",
			tertiary: "#f3efe4",
		},
		description: "Purple and pink, expressive and creative",
		id: "violet",
	},
	{
		colors: {
			background: "#fbfdf8",
			neutral: "#24332f",
			primary: "#25c98b",
			secondary: "#dce6ec",
			tertiary: "#f1f5f4",
		},
		description: "Fresh green, natural and calm",
		id: "meadow",
	},
	{
		colors: {
			background: "#fff9f7",
			neutral: "#30263a",
			primary: "#d94b43",
			secondary: "#f2aba3",
			tertiary: "#fff0d9",
		},
		description: "Warm red, blush and cream, welcoming and lively",
		id: "sunset",
	},
] as const satisfies ReadonlyArray<{ colors: BrandFoundationV1["colors"]; description: string; id: string }>;
