import { useLogger, withCronLog, withEvlog } from "@/lib/evlog";
import { withErrorHandler } from "@/utils/with-error-handler";
import { handleEventDispatch } from "@starter/server/api";

// oxlint-disable-next-line react-doctor/nextjs-no-side-effect-in-get-handler -- Vercel Cron triggers event recovery with an authenticated GET
export const GET = withEvlog(
	withErrorHandler((request: Request) => {
		// oxlint-disable-next-line react/rules-of-hooks -- evlog useLogger is request-local, not a React Hook
		const requestLog = useLogger();
		requestLog.set({ events: { operation: "sweep" } });

		return withCronLog(handleEventDispatch)(request);
	})
);

export const POST = withEvlog(
	withErrorHandler((request: Request) => {
		// oxlint-disable-next-line react/rules-of-hooks -- evlog useLogger is request-local, not a React Hook
		const requestLog = useLogger();
		requestLog.set({ events: { operation: "wake" } });

		return withCronLog(handleEventDispatch)(request);
	})
);
