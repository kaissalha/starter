import { z } from "zod";

const canonicalizeLocale = ({ locale }: { locale: string }) => {
	try {
		return Intl.getCanonicalLocales(locale)[0];
	} catch {
		return undefined;
	}
};

const validLocaleSchema = z
	.string()
	.refine((locale) => canonicalizeLocale({ locale }) !== undefined, "Must be a valid BCP 47 locale tag");

export const localeSchema = z.compile(
	validLocaleSchema
		.overwrite((locale) => canonicalizeLocale({ locale }) ?? locale)
		.meta({ examples: ["en", "en-CA", "ar"], id: "BrandLocale" })
);

export const canonicalLocaleKeySchema = validLocaleSchema.refine(
	(locale) => canonicalizeLocale({ locale }) === locale,
	"Locale record keys must use canonical BCP 47 casing"
);

export const localesSchema = z.compile(
	z
		.array(localeSchema)
		.min(1)
		.max(20)
		.superRefine((locales, context) => {
			const firstIndexByLocale = new Map<string, number>();

			locales.forEach((locale, index) => {
				const firstIndex = firstIndexByLocale.get(locale);

				if (firstIndex !== undefined) {
					context.addIssue({
						code: "custom",
						message: `Duplicate locale after canonicalization; first declared at index ${firstIndex}`,
						path: [index],
					});

					return;
				}

				firstIndexByLocale.set(locale, index);
			});
		})
);

export type BrandLocale = z.infer<typeof localeSchema>;
