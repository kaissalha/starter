import { useLogger, withEvlog } from "@/lib/evlog";
import { withErrorHandler } from "@/utils/with-error-handler";
import { getMcpAuthentication, handleMcpRequest } from "@starter/server/mcp";

const handler = withErrorHandler(async (request: Request) => {
	// oxlint-disable-next-line react/rules-of-hooks -- evlog useLogger is request-local, not a React Hook
	const requestLog = useLogger();
	requestLog.set({ mcp: { authentication: getMcpAuthentication(request.headers), transport: "streamable-http" } });

	return handleMcpRequest(request);
});

export const POST = withEvlog(handler);
