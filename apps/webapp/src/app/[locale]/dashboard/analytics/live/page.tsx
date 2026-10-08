import { Suspense } from "react";

import { connection } from "next/server";

import { getTranslations } from "@/lib/i18n";
import { Skeleton } from "@starter/ui/components/skeleton";

import { AnalyticsLivePage } from "./analytics-live-page";

export const instant = false;

export const generateMetadata = async () => ({ title: (await getTranslations("analytics"))("live.pageTitle") });

const LiveContent = async () => {
	await connection();

	return <AnalyticsLivePage />;
};

export default function Page() {
	return (
		<Suspense fallback={<Skeleton className='m-5 h-96' />}>
			<LiveContent />
		</Suspense>
	);
}
