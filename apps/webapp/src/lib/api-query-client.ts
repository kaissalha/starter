import { environmentManager, type QueryClient } from "@tanstack/react-query";

import { getQueryClient, makeQueryClient } from "./server/query-client";

type MutableReference<Value> = { value: Value };

const browserQueryClientReference: MutableReference<QueryClient | undefined | undefined> = { value: undefined };

export const clearApiCache = () => {
	browserQueryClientReference.value?.getQueryCache().clear();
};

export const createApiQueryClient = () => {
	if (environmentManager.isServer()) {
		return getQueryClient();
	}

	if (!browserQueryClientReference.value) {
		browserQueryClientReference.value = makeQueryClient();
	}

	return browserQueryClientReference.value;
};
