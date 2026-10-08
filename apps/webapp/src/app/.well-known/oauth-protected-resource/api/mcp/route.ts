import { withEvlog } from "@/lib/evlog";
import { withErrorHandler } from "@/utils/with-error-handler";
import { auth } from "@starter/server/auth";

export const GET = withEvlog(
	withErrorHandler(async (request: Request) => {
		const response = await auth.handler(request);

		response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
		response.headers.set("Access-Control-Allow-Origin", "*");

		return response;
	})
);

export const OPTIONS = () => {
	return new Response(null, {
		headers: {
			"Access-Control-Allow-Methods": "GET, OPTIONS",
			"Access-Control-Allow-Origin": "*",
		},
	});
};
