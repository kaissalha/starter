import { COMMON_ERROR_STATUS_MAP, ORPCError } from "@orpc/client";
import { createEvlog } from "evlog/next";
import { z } from "zod";

import { createEvlogOptions } from "@starter/observability";

export const { createError, log, useLogger, withEvlog } = createEvlog(createEvlogOptions("webapp"));

export const logProcedureErrors = async <TResult>({ next }: { next: () => Promise<TResult> }): Promise<TResult> => {
	try {
		return await next();
	} catch (error) {
		// oxlint-disable-next-line react-hooks/rules-of-hooks -- evlog's useLogger is not a React hook
		const requestLog = useLogger();

		if (
			error instanceof ORPCError &&
			(Object.entries(COMMON_ERROR_STATUS_MAP).find(([code]) => code === error.code)?.[1] ?? 500) < 500
		) {
			requestLog.set({ rpc: { errorCode: error.code } });
			throw error;
		}

		requestLog.error(error instanceof Error ? error : new Error("An unexpected error occurred"));
		throw error;
	}
};

const readCronResult = async (response: Response) => {
	try {
		return z.record(z.string(), z.number()).parse(await response.clone().json());
	} catch {
		return undefined;
	}
};

export const withCronLog =
	<T extends Request, A extends Array<unknown>>(handler: (req: T, ...args: A) => Promise<Response>) =>
	async (req: T, ...args: A) => {
		// oxlint-disable-next-line react/rules-of-hooks -- evlog useLogger is request-local, not a React Hook
		const requestLog = useLogger();
		const response = await handler(req, ...args);

		if (response.status === 401) {
			requestLog.warn("Cron request rejected as unauthorized", { cron: { status: response.status } });

			return response;
		}

		requestLog.set({ cron: { result: await readCronResult(response), status: response.status } });

		return response;
	};
