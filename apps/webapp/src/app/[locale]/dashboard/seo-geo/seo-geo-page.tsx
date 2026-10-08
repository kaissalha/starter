"use client";

import { AnalyticsUpIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { DashboardFrame } from "@/app/[locale]/dashboard/components/dashboard-frame";
import { Header } from "@/app/[locale]/dashboard/components/layout/header/header";
import { Link } from "@/i18n/navigation";
import { Button } from "@starter/ui/components/button";
import { Empty } from "@starter/ui/components/empty";
import { FramePanel } from "@starter/ui/components/frame";
import { Skeleton } from "@starter/ui/components/skeleton";

import { SeoGeoAnswers } from "./seo-geo-answers";
import { SeoGeoHandled } from "./seo-geo-handled";
import { SeoGeoScore } from "./seo-geo-score";
import { SeoGeoSearch } from "./seo-geo-search";
import { SeoGeoSteps } from "./seo-geo-steps";
import { useSeoGeoController, type SeoGeoController } from "./use-seo-geo-controller";

const SeoGeoHero = ({ controller }: { controller: SeoGeoController }) => {
	const t = useTranslations("seoGeo");

	return (
		<DashboardFrame label={t("headline")}>
			<FramePanel>
				<div className='grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:px-2'>
					<div className='grid justify-items-center gap-3 text-center md:justify-items-start md:text-start'>
						<h2 className='text-xl font-semibold tracking-tight text-balance md:text-2xl'>
							{t("headline")}
						</h2>
						<p className='max-w-prose text-sm text-pretty text-muted-foreground'>{t("description")}</p>
						<Button
							className='mt-1'
							nativeButton={false}
							render={<Link href='/dashboard/analytics' />}
							variant='outline'
						>
							<HugeiconsIcon
								aria-hidden
								className='scale-110'
								data-icon='inline-start'
								icon={AnalyticsUpIcon}
								strokeWidth={1.75}
							/>
							{t("viewTraffic")}
						</Button>
					</div>
					<div className='justify-self-center'>
						<SeoGeoScore band={controller.band} score={controller.score} />
					</div>
				</div>
			</FramePanel>
		</DashboardFrame>
	);
};

export const SeoGeoPage = () => {
	const t = useTranslations("seoGeo");
	const controller = useSeoGeoController();
	const data = controller.overview.data;

	return (
		<div className='flex min-h-0 flex-1 flex-col'>
			<Header
				actions={
					data &&
					!data.websiteId && (
						<Button
							nativeButton={false}
							render={<Link href='/dashboard/website' />}
							size='sm'
							variant='secondary'
						>
							{t("createWebsite")}
						</Button>
					)
				}
				item={{ labelTx: "seoGeo" }}
				leading={
					<>
						<HugeiconsIcon
							aria-hidden
							className='hidden size-4 scale-110 text-muted-foreground sm:block'
							icon={Search01Icon}
							strokeWidth={1.75}
						/>
						<h1 className='text-base'>{t("title")}</h1>
					</>
				}
			/>
			<main className='min-h-0 flex-1 overflow-y-auto p-4 md:p-6'>
				<div className='mx-auto grid max-w-screen-xl gap-4'>
					{controller.overview.isPending && (
						<Skeleton aria-label={t("loading")} className='h-56 w-full' role='status' />
					)}
					{controller.overview.isError && <p role='alert'>{t("unavailable")}</p>}
					{data && !data.websiteId && (
						<Empty className='min-h-64'>
							<p>{t("noWebsite")}</p>
						</Empty>
					)}
					{data?.websiteId && (
						<>
							<SeoGeoHero controller={controller} />
							<div className='grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]'>
								<div className='grid gap-4'>
									<SeoGeoSteps controller={controller} overview={data} />
									<SeoGeoAnswers controller={controller} />
								</div>
								<div className='grid gap-4'>
									<SeoGeoHandled overview={data} />
									<SeoGeoSearch controller={controller} />
								</div>
							</div>
						</>
					)}
				</div>
			</main>
		</div>
	);
};
