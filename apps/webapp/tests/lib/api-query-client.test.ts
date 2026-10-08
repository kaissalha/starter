import { dehydrate, hydrate } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clearApiCache, createApiQueryClient } from "@/lib/api-query-client";
import { makeQueryClient } from "@/lib/server/query-client";

type MutableReference<Value> = { value: Value };

describe("API query client", () => {
	afterEach(() => {
		clearApiCache();
	});

	it("clears cached API data without clearing the client instance", () => {
		const queryClient = createApiQueryClient();
		queryClient.setQueryData(["organization", "details"], { id: "organization-1" });

		clearApiCache();

		expect(queryClient.getQueryData(["organization", "details"])).toBeUndefined();
		expect(createApiQueryClient()).toBe(queryClient);
	});
});

describe("query client hydration", () => {
	it("streams pending queries into a hydrated client without a duplicate fetch", async () => {
		const serverClient = makeQueryClient();

		const resolveQueryReference: MutableReference<
			((value: { generatedAt: Date }) => void) | undefined | undefined
		> = {
			value: undefined,
		};

		const pending = new Promise<{ generatedAt: Date }>((resolve) => {
			resolveQueryReference.value = resolve;
		});

		const serverQueryFn = vi.fn(() => pending);

		serverClient.query({ queryFn: serverQueryFn, queryKey: ["streamed-query"] });

		const dehydrated = dehydrate(serverClient);
		expect(dehydrated.queries).toHaveLength(1);
		expect(dehydrated.queries[0]?.state.status).toBe("pending");

		const browserClient = makeQueryClient();
		hydrate(browserClient, dehydrated);

		const browserQueryFn = vi.fn(async () => ({ generatedAt: new Date(0) }));
		const hydratedResult = browserClient.query({ queryFn: browserQueryFn, queryKey: ["streamed-query"] });
		const generatedAt = new Date("2026-08-25T12:00:00.000Z");
		resolveQueryReference.value?.({ generatedAt });

		await expect(hydratedResult).resolves.toEqual({ generatedAt });
		expect(serverQueryFn).toHaveBeenCalledOnce();
		expect(browserQueryFn).not.toHaveBeenCalled();
		expect(browserClient.getQueryData(["streamed-query"])).toEqual({ generatedAt });
	});
});
