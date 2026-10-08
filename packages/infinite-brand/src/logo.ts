import { z } from "zod";

export const brandLogoScale = { default: 1, max: 2, min: 0.5, step: 0.1 } as const;

export const brandLogoSchema = z.compile(
	z
		.strictObject({
			scale: z.number().min(brandLogoScale.min).max(brandLogoScale.max),
			src: z.url({ protocol: /^https$/u }),
		})
		.meta({ id: "BrandLogo" })
);

export type BrandLogo = z.infer<typeof brandLogoSchema>;
