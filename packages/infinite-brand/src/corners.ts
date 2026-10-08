import { z } from "zod";

export const brandCornerStyleSchema = z.compile(z.enum(["square", "subtle", "rounded", "soft"]));

export const brandCornerStyles = brandCornerStyleSchema.options;

export const brandButtonStyles = ["solid", "outline"] as const;

export const brandCornersSchema = z.compile(
	z
		.strictObject({
			style: brandCornerStyleSchema,
		})
		.meta({ id: "BrandCorners" })
);

export type BrandCornerStyle = z.infer<typeof brandCornerStyleSchema>;

export type BrandCorners = z.infer<typeof brandCornersSchema>;

export type BrandButtonStyle = (typeof brandButtonStyles)[number];
