import { Suspense } from "react";

import { connection } from "next/server";

import { Header } from "@/app/[locale]/dashboard/components/layout/header/header";
import { getTranslations } from "@/lib/i18n";
import { serverApiClient } from "@/lib/server/api-client";
import { getQueryClient, prefetch } from "@/lib/server/query-client";
import { HydrateClient } from "@/lib/server/react-query";
import { Skeleton } from "@starter/ui/components/skeleton";

import { SeoGeoPage } from "./seo-geo-page";

export const instant = false;

export const generateMetadata = async () => ({ title: (await getTranslations("seoGeo"))("title") });

const SeoGeoContent = async () => {
	await connection();
	prefetch(getQueryClient().query(serverApiClient.seo.overview.queryOptions(undefined)));

	return (
		<HydrateClient>
			<SeoGeoPage />
		</HydrateClient>
	);
};

export default function Page() {
	return (
		<Suspense
			fallback={
				<>
					<Header item={{ labelTx: "seoGeo" }} />
					<Skeleton className='m-5 h-96' />
				</>
			}
		>
			<SeoGeoContent />
		</Suspense>
	);
}
