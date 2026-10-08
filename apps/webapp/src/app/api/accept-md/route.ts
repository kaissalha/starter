import { loadConfig } from "accept-md-runtime";

import { useLogger, withEvlog } from "@/lib/evlog";
import { withErrorHandler } from "@/utils/with-error-handler";
import { getMarkdownResponse } from "@starter/utils/markdown";

// oxlint-disable-next-line react-doctor/nextjs-no-side-effect-in-get-handler -- evlog mutates only the in-memory request event
export const GET = withEvlog(
	withErrorHandler(async (request: Request) => {
		// oxlint-disable-next-line react/rules-of-hooks -- evlog useLogger is request-local, not a React Hook
		const requestLog = useLogger();
		requestLog.set({ markdown: { enabled: true } });

		return getMarkdownResponse(request, loadConfig(process.cwd()));
	})
);
