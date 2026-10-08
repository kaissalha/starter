import { Suspense } from "react";

import { connection } from "next/server";

import { Header } from "@/app/[locale]/dashboard/components/layout/header/header";
import { getTranslations } from "@/lib/i18n";
import { resolveAnalyticsDates } from "@starter/analytics";
import { Skeleton } from "@starter/ui/components/skeleton";

import { AnalyticsPage } from "./analytics-page";

export const instant = false;

export const generateMetadata = async () => ({ title: (await getTranslations("analytics"))("title") });

const AnalyticsContent = async () => {
	await connection();
	const { from, to } = resolveAnalyticsDates({});

	return <AnalyticsPage initial={{ from, to }} />;
};

export default function Page() {
	return (
		<Suspense
			fallback={
				<>
					<Header item={{ labelTx: "analytics" }} />
					<Skeleton className='m-5 h-96' />
				</>
			}
		>
			<AnalyticsContent />
		</Suspense>
	);
}
