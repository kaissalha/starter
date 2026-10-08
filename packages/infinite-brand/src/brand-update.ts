import { z } from "zod";

import { brandFoundationSchema, type BrandFoundationV1 } from "./brand-foundation";
import { brandColorsSchema } from "./colors";
import { brandCornerStyleSchema } from "./corners";
import { brandFontPairingIdSchema, brandFontPairings } from "./fonts/pairings";

export const brandUpdateSchema = z.compile(
	z
		.strictObject({
			colors: brandColorsSchema.partial().optional(),
			cornerStyle: brandCornerStyleSchema.optional(),
			fontPairingId: brandFontPairingIdSchema.optional(),
		})
		.refine(
			(update) =>
				update.colors !== undefined || update.fontPairingId !== undefined || update.cornerStyle !== undefined,
			"At least one Brand setting is required"
		)
		.meta({ id: "BrandUpdate" })
);

export type BrandUpdate = z.infer<typeof brandUpdateSchema>;

export const applyBrandUpdate = ({ brand, update }: { brand: BrandFoundationV1; update: BrandUpdate }) =>
	brandFoundationSchema.parse({
		...brand,
		colors: update.colors ? { ...brand.colors, ...update.colors } : brand.colors,
		corners: update.cornerStyle ? { style: update.cornerStyle } : brand.corners,
		typography: update.fontPairingId
			? { catalogVersion: 1, ...brandFontPairings[update.fontPairingId] }
			: brand.typography,
	});
