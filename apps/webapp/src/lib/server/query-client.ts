import { cache } from "react";

import { defaultShouldDehydrateQuery, environmentManager, QueryClient } from "@tanstack/react-query";
import superjson from "superjson";

export const makeQueryClient = () => {
	return new QueryClient({
		defaultOptions: {
			dehydrate: {
				serializeData: superjson.serialize,
				shouldDehydrateQuery: (query) => defaultShouldDehydrateQuery(query) || query.state.status === "pending",
				shouldRedactErrors: (_error) => {
					return false;
				},
			},
			hydrate: {
				deserializeData: superjson.deserialize,
			},
			queries: {
				gcTime: environmentManager.isServer() ? Infinity : 60 * 1000,
				staleTime: environmentManager.isServer() ? "static" : 60 * 1000,
			},
		},
	});
};

export const getQueryClient = cache(makeQueryClient);

export const prefetch = async <TData>(query: Promise<TData>) => {
	try {
		await query;
	} catch {
		return;
	}
};
