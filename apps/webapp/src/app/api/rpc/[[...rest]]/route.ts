import { RPCHandler } from "@orpc/server/fetch";
import { RequestLimitHandlerPlugin } from "@orpc/server/plugins";

import { logProcedureErrors, useLogger, withEvlog } from "@/lib/evlog";
import { withErrorHandler } from "@/utils/with-error-handler";
import { apiRouter } from "@starter/server/api";

const rpcHandler = new RPCHandler(apiRouter, {
	interceptors: [logProcedureErrors],
	plugins: [new RequestLimitHandlerPlugin({ maxBodySize: 4_000_000 })],
});

const handleRequest = withErrorHandler(async (request: Request) => {
	// oxlint-disable-next-line react/rules-of-hooks -- evlog useLogger is request-local, not a React Hook
	const requestLog = useLogger();
	requestLog.set({ api: { surface: "rpc" } });

	const { response } = await rpcHandler.handle(request, {
		context: { authMode: "session-only", log: requestLog },
		prefix: "/api/rpc",
	});

	return response ?? Response.json({ error: { message: "Not found." } }, { status: 404 });
});

// oxlint-disable-next-line react-doctor/nextjs-no-side-effect-in-get-handler -- evlog mutates only the in-memory request event
export const GET = withEvlog(handleRequest);

export const POST = withEvlog(handleRequest);

export const PUT = withEvlog(handleRequest);

export const PATCH = withEvlog(handleRequest);

export const DELETE = withEvlog(handleRequest);

export const HEAD = withEvlog(handleRequest);
