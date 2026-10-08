import { createOnRequestError } from "@posthog/next";
import { registerOTel } from "@vercel/otel";
import { defineNodeInstrumentation } from "evlog/next/instrumentation";

import { assertRequiredConfig, createEvlogOptions } from "@starter/observability";

import "zod/compile";

const posthogOnRequestError = createOnRequestError({
	disabled: !process.env.NEXT_PUBLIC_CAPTURE_ERRORS,
});

export const { onRequestError, register } = defineNodeInstrumentation(async () => {
	const { createInstrumentation } = await import("evlog/next/instrumentation/create");

	const { onRequestError: evlogOnRequestError, register: evlogRegister } = createInstrumentation({
		...createEvlogOptions("webapp"),
		captureOutput: process.env.NODE_ENV === "development",
	});

	return {
		onRequestError: async (error, request, context) => {
			await evlogOnRequestError(error, request, context);
			await posthogOnRequestError(error, request, { ...context });
		},
		register: async () => {
			registerOTel({ serviceName: "webapp" });

			if (process.env.NODE_ENV === "development") {
				const [{ registerTelemetry }, { DevToolsTelemetry }] = await Promise.all([
					import("ai"),
					import("@ai-sdk/devtools"),
				]);

				registerTelemetry(DevToolsTelemetry());
			}

			await evlogRegister();
			await assertRequiredConfig({
				app: "webapp",
				enforce: false,
				names: ["BETTER_AUTH_SECRET", "CRON_SECRET", "DATABASE_URL", "REDIS_URL"],
			});
		},
	};
});
