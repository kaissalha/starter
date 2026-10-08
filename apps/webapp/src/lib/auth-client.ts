import { apiKeyClient } from "@better-auth/api-key/client";
import { i18nClient } from "@better-auth/i18n/client";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import {
	customSessionClient,
	emailOTPClient,
	lastLoginMethodClient,
	organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { auth } from "@starter/server/auth";
import { organizationAccessControl, organizationRoles } from "@starter/server/permissions";
import { getBaseURL } from "@starter/utils";

import { clearApiCache } from "./api-query-client";

export const authClient = createAuthClient({
	baseURL: getBaseURL().toString(),
	plugins: [
		apiKeyClient(),
		{
			...customSessionClient<typeof auth>(),
			atomListeners: [
				{ matcher: (path) => path === "/organization/update-member-role", signal: "$sessionSignal" },
			],
		},
		oauthProviderClient(),
		emailOTPClient(),
		lastLoginMethodClient(),
		organizationClient({ ac: organizationAccessControl, roles: organizationRoles }),
		i18nClient(),
	],
});

export const setActiveOrganization = async ({ organizationId }: { organizationId: string }) => {
	const result = await authClient.organization.setActive({ organizationId });

	if (!result.error) {
		clearApiCache();
	}

	return result;
};

export const signOut = async () => {
	try {
		return await authClient.signOut();
	} finally {
		clearApiCache();
	}
};
