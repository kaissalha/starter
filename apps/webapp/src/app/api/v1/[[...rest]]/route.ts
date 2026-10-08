import { SmartCoercionHandlerPlugin } from "@orpc/json-schema";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferenceHandlerPlugin } from "@orpc/openapi/plugins";
import { RequestLimitHandlerPlugin } from "@orpc/server/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod";

import { logProcedureErrors, useLogger, withEvlog } from "@/lib/evlog";
import { withErrorHandler } from "@/utils/with-error-handler";
import { apiRouter, generateOpenApiSpec, isPublicApiProcedure, openApiSpecPath } from "@starter/server/api";
import { getBaseURL } from "@starter/utils";

const handler = new OpenAPIHandler(apiRouter, {
	clientInterceptors: [logProcedureErrors],
	filter: (contract) => isPublicApiProcedure(contract),
	plugins: [
		new RequestLimitHandlerPlugin({ maxBodySize: 4_000_000 }),
		new SmartCoercionHandlerPlugin({
			converters: [new ZodToJsonSchemaConverter()],
		}),
		new OpenAPIReferenceHandlerPlugin({
			docsPath: "/docs",
			docsTitle: "starter API",
			spec: () => generateOpenApiSpec({ origin: getBaseURL().origin }),
			specPath: openApiSpecPath,
		}),
	],
});

const handleRequest = withErrorHandler(async (request: Request) => {
	// oxlint-disable-next-line react/rules-of-hooks -- evlog useLogger is request-local, not a React Hook
	const requestLog = useLogger();
	requestLog.set({ api: { surface: "public" } });

	const { matched, response } = await handler.handle(request, {
		context: { authMode: "session-or-api-key", log: requestLog },
		prefix: "/api/v1",
	});

	if (matched) {
		return response;
	}

	return Response.json({ error: { message: "Not found." } }, { status: 404 });
});

// oxlint-disable-next-line react-doctor/nextjs-no-side-effect-in-get-handler -- evlog mutates only the in-memory request event
export const GET = withEvlog(handleRequest);

export const POST = withEvlog(handleRequest);

export const PUT = withEvlog(handleRequest);

export const PATCH = withEvlog(handleRequest);

export const DELETE = withEvlog(handleRequest);
