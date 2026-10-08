import { NextResponse } from "next/server";

import { COMMON_ERROR_STATUS_MAP, ORPCError } from "@orpc/client";
import { z } from "zod";

import { useLogger } from "@/lib/evlog";

export const withErrorHandler =
	<T extends Request, A extends Array<unknown>>(
		handler: (req: T, ...args: A) => Promise<Response>
	): ((req: T, ...args: A) => Promise<Response>) =>
	async (req: T, ...args: A) => {
		// oxlint-disable-next-line react/rules-of-hooks -- evlog useLogger is request-local, not a React Hook
		const requestLog = useLogger();

		requestLog.set({
			http: {
				method: req.method,
				path: new URL(req.url).pathname,
			},
		});

		try {
			if (
				!["GET", "HEAD", "OPTIONS"].includes(req.method) &&
				req.headers.has("cookie") &&
				![null, "none", "same-origin"].includes(req.headers.get("sec-fetch-site"))
			) {
				throw new ORPCError("FORBIDDEN", { message: "Cross-site requests are not allowed." });
			}

			return await handler(req, ...args);
		} catch (error) {
			const status =
				error instanceof ORPCError
					? (Object.entries(COMMON_ERROR_STATUS_MAP).find(([code]) => code === error.code)?.[1] ?? 500)
					: 500;

			if (status >= 500) {
				requestLog.error(error instanceof Error ? error : new Error(String(error)));
			}

			const requestId = z.string().safeParse(requestLog.getContext().requestId).data;

			return NextResponse.json(
				{
					error: {
						message:
							error instanceof ORPCError && status < 500
								? error.message
								: "An unexpected error occurred.",
						requestId,
					},
				},
				{ headers: requestId ? { "x-request-id": requestId } : undefined, status }
			);
		}
	};
