import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

import type { ApiRouterClient } from "@starter/server/api";
import { getBaseURL } from "@starter/utils";

const link = new RPCLink({
	fetch: (input, init) =>
		globalThis.fetch(input, {
			...init,
			credentials: "include",
		}),
	origin: getBaseURL().origin,
	url: "/api/rpc",
});

export const client: ApiRouterClient = createORPCClient(link);

export const apiClient = createTanstackQueryUtils(client);
