import type { MetadataRoute } from "next";

import { defaultLocale, locales } from "@/i18n/routing";
import { localizedPath } from "@/i18n/utils/localized-path";
import { getBaseURL } from "@starter/utils";

export default function robots(): MetadataRoute.Robots {
	if (process.env.VERCEL_ENV !== "production") {
		return { rules: { disallow: "/", userAgent: "*" } };
	}

	return {
		rules: {
			allow: "/",
			disallow: [
				"/api/",
				...["/dashboard", "/onboarding", "/login", "/oauth", "/accept-invitation"].flatMap((pathname) =>
					locales.map((locale) => localizedPath({ defaultLocale, locale, pathname }))
				),
			],
			userAgent: "*",
		},
		sitemap: new URL("/sitemap.xml", getBaseURL()).href,
	};
}
