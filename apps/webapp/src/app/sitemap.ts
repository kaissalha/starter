import type { MetadataRoute } from "next";

import { pilotTemplateIds } from "@/app/[locale]/(site)/templates/pilot-templates";
import { defaultLocale, type Locale, locales } from "@/i18n/routing";
import { localizedPath } from "@/i18n/utils/localized-path";
import { getBaseURL } from "@starter/utils";

export default function sitemap(): MetadataRoute.Sitemap {
	const href = (pathname: string, locale: Locale) =>
		new URL(localizedPath({ defaultLocale, locale, pathname }), getBaseURL()).href;

	return ["/", "/privacy", "/terms", "/templates", ...pilotTemplateIds.map((id) => `/templates/${id}`)].flatMap(
		(pathname) =>
			locales.map((locale) => ({
				alternates: {
					languages: Object.fromEntries(locales.map((entry) => [entry, href(pathname, entry)])),
				},
				url: href(pathname, locale),
			}))
	);
}
