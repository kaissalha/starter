import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { locales } from "@/i18n/routing";
import { getLoginRedirect } from "@/utils/get-login-redirect";

export const publicMiddleware = async (request: NextRequest) => {
	const { auth } = await import("@starter/server/auth");

	const session = await auth.api.getSession({
		headers: await headers(),
	});

	const { origin, search, searchParams } = request.nextUrl;
	const [, locale, ..._segments] = request.nextUrl.pathname.split("/");

	if (session) {
		const isOAuthRequest = searchParams.has("sig") && searchParams.has("ba_param");

		if (session.session.activeOrganizationId && isOAuthRequest) {
			const authorizeUrl = new URL("/api/auth/oauth2/authorize", origin);
			authorizeUrl.search = search;

			return NextResponse.redirect(authorizeUrl);
		}

		const returnPath = getLoginRedirect(searchParams.get("redirect_url"));

		if (!isOAuthRequest && returnPath) {
			return NextResponse.redirect(new URL(returnPath, origin));
		}

		const destination = session.session.activeOrganizationId ? "/dashboard" : "/onboarding";

		const signInPath = locales.some((supportedLocale) => supportedLocale === locale)
			? `/${locale}${destination}`
			: destination;

		const redirectUrl = new URL(signInPath, origin);

		redirectUrl.search = search;

		if (!isOAuthRequest) {
			redirectUrl.searchParams.delete("redirect_url");
		}

		return NextResponse.redirect(redirectUrl);
	}

	return;
};
