import { Suspense } from "react";

import type { Metadata } from "next";

import { getTranslations } from "next-intl/server";

import { ConsentPageClient } from "./consent-page-client";
import { ConsentPageFallback } from "./consent-page-fallback";

export const generateMetadata = async (): Promise<Metadata> => {
	const t = await getTranslations("account.oauthConsent");

	return {
		robots: { follow: false, index: false },
		title: t("pageTitle"),
	};
};

const ConsentPageContent = async ({
	searchParams,
}: {
	searchParams: Promise<{ client_id?: string; redirect_uri?: string; scope?: string }>;
}) => {
	const { client_id: clientId, redirect_uri: redirectUri = "", scope = "" } = await searchParams;
	const redirectUrl = URL.parse(redirectUri);

	return (
		<ConsentPageClient
			clientId={clientId}
			redirectHost={redirectUrl ? redirectUrl.host || redirectUrl.protocol : undefined}
			requestedScopes={scope.split(" ").filter(Boolean)}
		/>
	);
};

export default function ConsentPage({
	searchParams,
}: {
	searchParams: Promise<{ client_id?: string; redirect_uri?: string; scope?: string }>;
}) {
	return (
		<Suspense fallback={<ConsentPageFallback />}>
			<ConsentPageContent searchParams={searchParams} />
		</Suspense>
	);
}
