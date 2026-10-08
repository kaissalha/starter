import { useLogger, withCronLog, withEvlog } from "@/lib/evlog";
import { withErrorHandler } from "@/utils/with-error-handler";
import { handleDataRetention } from "@starter/server/api";

// oxlint-disable-next-line react-doctor/nextjs-no-side-effect-in-get-handler -- Vercel Cron triggers data retention with an authenticated GET
export const GET = withEvlog(
	withErrorHandler((request: Request) => {
		// oxlint-disable-next-line react/rules-of-hooks -- evlog useLogger is request-local, not a React Hook
		const requestLog = useLogger();
		requestLog.set({ maintenance: { operation: "retention" } });

		return withCronLog(handleDataRetention)(request);
	})
);
