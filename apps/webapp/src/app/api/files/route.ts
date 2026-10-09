import { useLogger, withEvlog } from "@/lib/evlog";
import { withErrorHandler } from "@/utils/with-error-handler";
import { handleFilesRequest } from "@starter/server/api";

const handler = withEvlog(
	withErrorHandler((request: Request) => {
		// oxlint-disable-next-line react/rules-of-hooks -- evlog useLogger is request-local, not a React Hook
		const requestLog = useLogger();
		requestLog.set({ files: { operation: "upload" } });

		return handleFilesRequest(request);
	})
);

export const POST = handler;

export const PUT = handler;
