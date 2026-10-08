import { isSpanContextValid, trace } from "@opentelemetry/api";
import { createLogger, definePlugin, log, type DrainContext, type TailSamplingContext } from "evlog";
import { createDefaultEnrichers } from "evlog/enrichers";
import { createFsDrain } from "evlog/fs";
import { useLogger } from "evlog/next";
import { createOTLPDrain } from "evlog/otlp";
import { createDrainPipeline } from "evlog/pipeline";
import { createPostHogDrain } from "evlog/posthog";

const posthogApiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? process.env.POSTHOG_API_KEY;

const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";

const otlpEndpoint =
	process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ??
	process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
	process.env.OTLP_ENDPOINT;

const environment = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";

const readActiveSpanContext = () => {
	const spanContext = trace.getActiveSpan()?.spanContext();

	return spanContext && isSpanContextValid(spanContext)
		? { spanId: spanContext.spanId, traceId: spanContext.traceId }
		: undefined;
};

const otelTraceContextPlugin = definePlugin({
	enrich: ({ event }) => {
		if (event.traceId === undefined) {
			Object.assign(event, readActiveSpanContext());
		}
	},
	name: "otel-trace-context",
	onRequestStart: ({ logger }) => {
		const spanContext = readActiveSpanContext();

		if (spanContext) {
			logger.set(spanContext);
		}
	},
});

const posthogTracingPlugin = definePlugin({
	enrich: ({ event, headers }) => {
		const distinctId = event.userId ?? headers?.["x-posthog-distinct-id"];
		const sessionId = headers?.["x-posthog-session-id"];

		if (distinctId || sessionId) {
			event.posthog = { distinctId, sessionId };
		}
	},
	name: "posthog-tracing",
});

const createEvlogDrain = () => {
	const drains = [
		environment === "development" ? createFsDrain({ maxFiles: 7 }) : undefined,
		posthogApiKey
			? createPostHogDrain({
					apiKey: posthogApiKey,
					distinctIdField: "posthog.distinctId",
					host: posthogHost,
					// oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- evlog adapter option name
					recordShape: "compact",
					sessionIdField: "posthog.sessionId",
				})
			: undefined,
		// oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- evlog adapter option name
		otlpEndpoint ? createOTLPDrain({ recordShape: "compact", semanticConventions: true }) : undefined,
	].filter((drain) => drain !== undefined);

	if (drains.length === 0) {
		return undefined;
	}

	return createDrainPipeline<DrainContext>({ batch: { intervalMs: 2000 } })(async (batch) => {
		await Promise.allSettled(drains.map((drain) => drain(batch)));
	});
};

const drain = createEvlogDrain();

export const createEvlogOptions = (service: string) => ({
	drain,
	enrich: createDefaultEnrichers(),
	env: { environment, service },
	keep: (context: TailSamplingContext) => {
		if ("cron" in context.context) {
			context.shouldKeep = true;
		}
	},
	plugins: [otelTraceContextPlugin, posthogTracingPlugin],
	sampling:
		environment === "preview" || environment === "production"
			? { keep: [{ duration: 2000 }, { status: 400 }], rates: { info: 10 } }
			: undefined,
	service,
});

export const getRequestLogger = () => {
	try {
		// oxlint-disable-next-line react/rules-of-hooks -- evlog useLogger is request-local, not a React Hook
		return useLogger();
	} catch {
		return undefined;
	}
};

export { createLogger, log };

/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof -- serializes arbitrary thrown values at the log boundary */
type SerializedLogError = {
	cause?: SerializedLogError;
	code?: number | string;
	message: string;
	name: string;
	stack?: string;
};

export const serializeLogError = (error: unknown, depth = 0): SerializedLogError => {
	if (error instanceof Error) {
		return {
			cause: error.cause === undefined || depth >= 3 ? undefined : serializeLogError(error.cause, depth + 1),
			code:
				"code" in error && (typeof error.code === "string" || typeof error.code === "number")
					? error.code
					: undefined,
			message: error.message,
			name: error.name,
			stack: error.stack,
		};
	}

	if (typeof error !== "object" || error === null) {
		return { message: String(error), name: "NonError" };
	}

	return {
		message: "message" in error && typeof error.message === "string" ? error.message : String(error),
		name: "name" in error && typeof error.name === "string" ? error.name : "NonError",
	};
};
/* oxlint-enable anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof */
