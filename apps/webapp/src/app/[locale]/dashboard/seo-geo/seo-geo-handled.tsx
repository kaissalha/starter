"use client";

import {
	AiBrain01Icon,
	Alert02Icon,
	CheckListIcon,
	CheckmarkCircle02Icon,
	Globe02Icon,
	HierarchySquare02Icon,
	SmartPhone01Icon,
	TranslateIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import {
	DashboardFrame,
	DashboardFrameHeader,
	DashboardFramePanel,
} from "@/app/[locale]/dashboard/components/dashboard-frame";
import type { SeoOverview } from "@starter/server/api";
import { cn } from "@starter/ui/lib/utils";

export const SeoGeoHandled = ({ overview }: { overview: SeoOverview }) => {
	const t = useTranslations("seoGeo.handled");
	const published = overview.publishedAt !== null;

	const items = [
		{ icon: SmartPhone01Icon, id: "mobile", ready: true },
		{ icon: HierarchySquare02Icon, id: "sitemap", ready: published },
		{ icon: AiBrain01Icon, id: "aiReadable", ready: published },
		{ icon: TranslateIcon, id: "languages", ready: published },
		{ icon: Globe02Icon, id: "indexing", ready: published && overview.primaryDomain?.connected === true },
	] as const;

	return (
		<DashboardFrame label={t("title")}>
			<DashboardFrameHeader icon={CheckListIcon} title={t("title")} />
			<DashboardFramePanel>
				<ul className='grid gap-0.5'>
					{items.map((item) => (
						<li className='flex min-h-14 items-center gap-3 rounded-lg px-3 py-2' key={item.id}>
							<HugeiconsIcon
								aria-hidden
								className='size-4 shrink-0 scale-110 text-muted-foreground'
								icon={item.icon}
								strokeWidth={1.75}
							/>
							<div className='grid min-w-0 flex-1 gap-0.5'>
								<p className='text-sm'>{t(`${item.id}.title`)}</p>
								<p className='text-xs text-muted-foreground'>
									{item.ready
										? t(`${item.id}.description`)
										: t(published ? "needsDomain" : "needsPublish")}
								</p>
							</div>
							<HugeiconsIcon
								aria-label={t(item.ready ? "ready" : "pending")}
								className={cn(
									"size-4 shrink-0 scale-110",
									item.ready ? "text-success-foreground" : "text-warning-foreground"
								)}
								icon={item.ready ? CheckmarkCircle02Icon : Alert02Icon}
								role='img'
								strokeWidth={1.75}
							/>
						</li>
					))}
				</ul>
			</DashboardFramePanel>
		</DashboardFrame>
	);
};
