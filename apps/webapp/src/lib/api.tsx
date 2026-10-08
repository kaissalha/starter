"use client";

import type { ReactNode } from "react";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { createApiQueryClient } from "./api-query-client";

export const ApiProvider = (props: Readonly<{ children: ReactNode }>) => {
	const queryClient = createApiQueryClient();

	return (
		<QueryClientProvider client={queryClient}>
			{props.children}
			{(process.env.NEXT_PUBLIC_ENABLE_QUERY_DEVTOOLS === "1" ||
				process.env.NEXT_PUBLIC_ENABLE_QUERY_DEVTOOLS === "true") && (
				<ReactQueryDevtools initialIsOpen={false} />
			)}
		</QueryClientProvider>
	);
};
