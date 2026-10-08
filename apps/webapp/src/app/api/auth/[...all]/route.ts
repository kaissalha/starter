import { useLogger, withEvlog } from "@/lib/evlog";
import { withErrorHandler } from "@/utils/with-error-handler";
import { auth } from "@starter/server/auth";

/* evlog-map-disable audit -- this Better Auth catch-all mixes high-volume reads with protocol mutations */

const ORIGINLESS_OAUTH_PATHS = new Set([
	"/api/auth/oauth2/introspect",
	"/api/auth/oauth2/register",
	"/api/auth/oauth2/revoke",
	"/api/auth/oauth2/token",
]);

const handleRequest = withErrorHandler(async (request: Request) => {
	const path = new URL(request.url).pathname;
	const origin = request.headers.get("origin");
	const isBrowserRequest = (origin && origin !== "null") || request.headers.has("referer");
	// oxlint-disable-next-line react/rules-of-hooks -- evlog useLogger is request-local, not a React Hook
	const requestLog = useLogger();

	requestLog.set({
		auth: {
			isBrowserRequest: Boolean(isBrowserRequest),
			path,
		},
	});

	if (isBrowserRequest || !request.headers.has("cookie") || !ORIGINLESS_OAUTH_PATHS.has(path)) {
		return auth.handler(request);
	}

	const headers = new Headers(request.headers);
	headers.delete("cookie");

	return auth.handler(
		new Request(request.url, {
			body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
			headers,
			method: request.method,
		})
	);
});

// oxlint-disable-next-line react-doctor/nextjs-no-side-effect-in-get-handler -- evlog mutates only the in-memory request event
export const GET = withEvlog(handleRequest);

export const POST = withEvlog(handleRequest);
