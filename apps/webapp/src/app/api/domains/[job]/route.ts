import { useLogger, withCronLog, withEvlog } from "@/lib/evlog";
import { withErrorHandler } from "@/utils/with-error-handler";
import { handleDomainCron } from "@starter/server/api";

// oxlint-disable-next-line react-doctor/nextjs-no-side-effect-in-get-handler -- Vercel Cron reconciles domains with an authenticated GET
export const GET = withEvlog(
	withErrorHandler((request: Request) => {
		// oxlint-disable-next-line react/rules-of-hooks -- evlog useLogger is request-local, not a React Hook
		const requestLog = useLogger();
		requestLog.set({ domains: { job: new URL(request.url).pathname.split("/").at(-1) } });

		return withCronLog(handleDomainCron)(request);
	})
);
