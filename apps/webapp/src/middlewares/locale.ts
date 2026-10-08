import { type NextRequest, NextResponse } from "next/server";

import createIntlMiddleware from "next-intl/middleware";

import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

export const localeMiddleware = async (request: NextRequest) => {
	if (
		request.nextUrl.pathname.startsWith("/api") ||
		request.nextUrl.pathname === "/robots.txt" ||
		request.nextUrl.pathname.startsWith("/sitemap") ||
		request.nextUrl.pathname.startsWith("/ingest") ||
		request.nextUrl.pathname.startsWith("/.well-known")
	) {
		return NextResponse.next();
	}

	const pathname = request.nextUrl.pathname;

	const url = request.nextUrl;

	if (!routing.locales.some((locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`)) {
		const cookieLocale = routing.locales.find((locale) => locale === request.cookies.get("NEXT_LOCALE")?.value);

		if (
			cookieLocale &&
			cookieLocale !== routing.defaultLocale &&
			["/accept-invitation", "/dashboard", "/login", "/onboarding", "/signup"].some(
				(root) => pathname === root || pathname.startsWith(`${root}/`)
			)
		) {
			const redirectUrl = new URL(`/${cookieLocale}${pathname}`, request.url);
			redirectUrl.search = url.search;

			return NextResponse.redirect(redirectUrl);
		}

		const rewrittenUrl = new URL(
			`/${routing.defaultLocale}${pathname.startsWith("/") ? "" : "/"}${pathname}`,
			request.url
		);

		rewrittenUrl.search = url.search;

		return NextResponse.rewrite(rewrittenUrl);
	}

	return intlMiddleware(request);
};
