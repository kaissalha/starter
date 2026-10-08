import { ORPCError } from "@orpc/client";
import { createRouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

import { requireDashboardSession } from "@/lib/server/dashboard-session";
import { apiRouter } from "@starter/server/api";

import "server-only";

export const serverClient = createRouterClient(apiRouter, {
	interceptors: [
		async ({ next }) => {
			try {
				return await next();
			} catch (error) {
				if (error instanceof ORPCError && (error.code === "UNAUTHORIZED" || error.code === "BAD_REQUEST")) {
					await requireDashboardSession();
				}

				throw error;
			}
		},
	],
});

export const serverApiClient = createTanstackQueryUtils(serverClient);
