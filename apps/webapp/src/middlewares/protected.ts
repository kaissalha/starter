import { type NextRequest, NextResponse } from "next/server";

import { getSessionCookie } from "better-auth/cookies";

import { locales } from "@/i18n/routing";

export const protectedMiddleware = async (request: NextRequest) => {
	if (getSessionCookie(request)) {
		return;
	}

	const [, locale] = request.nextUrl.pathname.split("/");

	const redirectUrl = new URL(
		locales.some((supportedLocale) => supportedLocale === locale) ? `/${locale}/login` : "/login",
		request.nextUrl.origin
	);

	redirectUrl.searchParams.set("redirect_url", request.nextUrl.pathname);

	return NextResponse.redirect(redirectUrl);
};
