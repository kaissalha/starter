import { Suspense } from "react";

import type { Metadata } from "next";
import { connection } from "next/server";

import { getTranslations } from "@/lib/i18n";
import { serverApiClient } from "@/lib/server/api-client";
import { getQueryClient, prefetch } from "@/lib/server/query-client";
import { HydrateClient } from "@/lib/server/react-query";
import "@starter/infinite-brand/fonts.css";
import { httpUrlSchema } from "@starter/infinite-links";

import { LinksPage as LinksPageContent, LinksPageLoading } from "./links-page";

export const instant = false;

export const generateMetadata = async (): Promise<Metadata> => {
	const t = await getTranslations("links");

	return { title: t("title") };
};

const getLinksUrl = () => {
	const websitesUrl = process.env.WEBSITES_URL;

	const parsed = httpUrlSchema.safeParse(websitesUrl);

	if (!parsed.success) {
		return undefined;
	}

	return new URL("/links", parsed.data).href;
};

const LinksRouteContent = async () => {
	await connection();

	const queryClient = getQueryClient();
	prefetch(queryClient.query(serverApiClient.linkPages.get.queryOptions()));

	return (
		<HydrateClient>
			<LinksPageContent linksUrl={getLinksUrl()} />
		</HydrateClient>
	);
};

export default function LinksPage() {
	return (
		<Suspense fallback={<LinksPageLoading />}>
			<LinksRouteContent />
		</Suspense>
	);
}
