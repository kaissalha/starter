import { Suspense } from "react";

import type { Metadata } from "next";
import { connection } from "next/server";

import { getTranslations } from "@/lib/i18n";
import { serverApiClient } from "@/lib/server/api-client";
import { getQueryClient, prefetch } from "@/lib/server/query-client";
import { HydrateClient } from "@/lib/server/react-query";
import "@starter/infinite-website/styles.css";
import "@starter/infinite-brand/fonts.css";

import { WebsitePage as WebsitePageContent, WebsiteLoadingState } from "./website-page";

export const instant = false;

export const generateMetadata = async (): Promise<Metadata> => {
	const t = await getTranslations("website");

	return { title: t("title") };
};

const WebsiteRouteContent = async () => {
	await connection();

	const queryClient = getQueryClient();
	prefetch(queryClient.query(serverApiClient.websites.get.queryOptions()));
	prefetch(queryClient.query(serverApiClient.websites.agentChat.queryOptions()));

	return (
		<HydrateClient>
			<WebsitePageContent websitesUrl={process.env.WEBSITES_URL} />
		</HydrateClient>
	);
};

export default function WebsitePage() {
	return (
		<Suspense fallback={<WebsiteLoadingState />}>
			<WebsiteRouteContent />
		</Suspense>
	);
}
