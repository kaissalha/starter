import { z } from "zod";

export const brandColorSchema = z.compile(
	z
		.string()
		.regex(/^#[\dA-Fa-f]{6}$/, "Must be a six-digit hexadecimal color")
		.toLowerCase()
		.meta({ examples: ["#2d4059"], id: "BrandColor" })
);

export const brandColorsSchema = z.compile(
	z
		.strictObject({
			background: brandColorSchema,
			neutral: brandColorSchema,
			primary: brandColorSchema,
			secondary: brandColorSchema,
			tertiary: brandColorSchema,
		})
		.meta({ id: "BrandColors" })
);

export type BrandColor = z.infer<typeof brandColorSchema>;

export type BrandColors = z.infer<typeof brandColorsSchema>;
