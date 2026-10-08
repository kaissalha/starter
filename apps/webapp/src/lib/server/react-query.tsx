import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient } from "./query-client";

export const HydrateClient = (props: { children: React.ReactNode }) => {
	const queryClient = getQueryClient();

	return <HydrationBoundary state={dehydrate(queryClient)}>{props.children}</HydrationBoundary>;
};
