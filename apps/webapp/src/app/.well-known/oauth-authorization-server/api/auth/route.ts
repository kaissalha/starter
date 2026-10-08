import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";

import { withEvlog } from "@/lib/evlog";
import { withErrorHandler } from "@/utils/with-error-handler";
import { auth } from "@starter/server/auth";

const corsHeaders = {
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Origin": "*",
};

export const GET = withEvlog(withErrorHandler(oauthProviderAuthServerMetadata(auth, { headers: corsHeaders })));

export const OPTIONS = () => {
	return new Response(null, { headers: corsHeaders });
};
