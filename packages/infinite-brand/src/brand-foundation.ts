import { z } from "zod";

import { brandColorsSchema } from "./colors";
import { brandButtonStyles, brandCornersSchema } from "./corners";
import { getBrandFont } from "./fonts/catalog";
import { localeSchema, localesSchema } from "./localization";
import { brandLogoSchema } from "./logo";
import { brandFontRoleSchema, resolveBrandFontSelection } from "./typography";

export const brandFoundationSchema = z.compile(
	z
		.strictObject({
			buttons: z.strictObject({ style: z.enum(brandButtonStyles) }).optional(),
			colors: brandColorsSchema,
			corners: brandCornersSchema,
			defaultLocale: localeSchema,
			locales: localesSchema,
			logo: brandLogoSchema.optional(),
			schemaVersion: z.literal(1),
			typography: z.strictObject({
				body: brandFontRoleSchema,
				catalogVersion: z.literal(1),
				heading: brandFontRoleSchema,
			}),
		})
		.superRefine((brand, context) => {
			if (!brand.locales.includes(brand.defaultLocale)) {
				context.addIssue({
					code: "custom",
					message: "Default locale must be included in locales",
					path: ["defaultLocale"],
				});
			}

			brand.locales.forEach((locale) => {
				const script = new Intl.Locale(locale).maximize().script;

				if (!script) {
					return;
				}

				(["heading", "body"] as const).forEach((roleName) => {
					const role = brand.typography[roleName];
					const selection = resolveBrandFontSelection({ locale, role });
					const font = getBrandFont({ fontId: selection.fontId });

					if (font && !font.scripts.includes(script)) {
						context.addIssue({
							code: "custom",
							message: `${selection.fontId} does not support the ${script} script used by ${locale}`,
							path: ["typography", roleName],
						});
					}
				});
			});
		})
		.meta({ id: "BrandFoundationV1", title: "Brand foundation v1" })
);

export type BrandFoundationV1 = z.infer<typeof brandFoundationSchema>;
