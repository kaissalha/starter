import type { Metadata } from "next";

import { hasLocale } from "next-intl";
import { defineRouting } from "next-intl/routing";

import { localizedPath } from "./utils/localized-path";

export const locales = ["en", "ar"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale = "en";

export const DEFAULT_TIME_ZONE = "America/New_York";

export const routing = defineRouting({
	defaultLocale,

	localePrefix: "as-needed",

	locales,
});

export const generateLocalizedStaticParams = () => locales.map((locale) => ({ locale }));

const openGraphLocales = { ar: "ar_AR", en: "en_US" } satisfies Record<Locale, string>;

export const generateLocalizedMetadata = ({
	description,
	locale,
	pathname = "/",
	title,
}: {
	description?: string;
	locale: string;
	pathname?: string;
	title: string;
}): Metadata => {
	const resolvedLocale = hasLocale(locales, locale) ? locale : defaultLocale;
	const canonical = localizedPath({ defaultLocale, locale: resolvedLocale, pathname });

	return {
		alternates: {
			canonical,
			languages: {
				...Object.fromEntries(
					locales.map((entry) => [entry, localizedPath({ defaultLocale, locale: entry, pathname })])
				),
				"x-default": localizedPath({ defaultLocale, locale: defaultLocale, pathname }),
			},
		},
		description,
		openGraph: {
			alternateLocale: locales.flatMap((entry) => (entry === resolvedLocale ? [] : [openGraphLocales[entry]])),
			description,
			locale: openGraphLocales[resolvedLocale],
			title,
			type: "website",
			url: canonical,
		},
		title,
		twitter: { card: "summary", description, title },
	};
};
