import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import { postHogMiddleware } from "@posthog/next";

import { getMarkdownRewriteUrl } from "@starter/utils";

import { localeMiddleware } from "./middlewares/locale";
import { protectedMiddleware } from "./middlewares/protected";
import { publicMiddleware } from "./middlewares/public";

const routeMiddlewares = {
	"/dashboard": [protectedMiddleware],
	"/login": [publicMiddleware],
	"/onboarding": [protectedMiddleware],
	"/signup": [publicMiddleware],
} satisfies Record<string, Array<(req: NextRequest) => Promise<NextResponse | undefined>>>;

const applyPostHogMiddleware = async (request: NextRequest, response?: NextResponse) => {
	const result = await postHogMiddleware({
		proxy: true,
		response,
	})(request);

	result?.headers.append("Vary", "Accept");

	return result;
};

export default async function proxy(
	req: NextRequest,
	_event: Pick<NextFetchEvent, "passThroughOnException" | "waitUntil">
) {
	const { pathname } = req.nextUrl;
	const rewriteUrl = getMarkdownRewriteUrl(req, { excludedPrefixes: ["ingest", "umbra"] });

	if (rewriteUrl) {
		return applyPostHogMiddleware(req, NextResponse.rewrite(rewriteUrl));
	}

	const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "");
	const normalizedPath = pathWithoutLocale || "/";

	const matchedMiddlewares = Object.entries(routeMiddlewares).find(([route]) => {
		return route === "/dashboard" ? normalizedPath.startsWith("/dashboard") : normalizedPath === route;
	})?.[1];

	if (matchedMiddlewares) {
		for (const middlewareFn of matchedMiddlewares) {
			const middlewareResponse = await middlewareFn(req);

			if (middlewareResponse) {
				return applyPostHogMiddleware(req, middlewareResponse);
			}
		}
	}

	const localeResponse = await localeMiddleware(req);

	return applyPostHogMiddleware(req, localeResponse);
}

export const config = {
	matcher: [
		"/ingest/:path*",

		// oxlint-disable-next-line unicorn/prefer-string-raw -- Next.js statically analyzes matcher string literals.
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|riv|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",

		"/(api)(.*)",
	],
};
