"use client";

import { useState } from "react";

import { CheckmarkCircle02Icon, CircleIcon, File01Icon, Task01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useFormatter, useTranslations } from "next-intl";

import { DashboardDrawer, DashboardDrawerHeader } from "@/app/[locale]/dashboard/components/dashboard-drawer";
import {
	DashboardFrame,
	DashboardFrameEmpty,
	DashboardFrameHeader,
	DashboardFramePanel,
	ForwardIcon,
} from "@/app/[locale]/dashboard/components/dashboard-frame";
import { Link } from "@/i18n/navigation";
import type { SeoOverview } from "@starter/server/api";
import { Button } from "@starter/ui/components/button";
import { DrawerPanel } from "@starter/ui/components/drawer";
import { ToggleGroup, ToggleGroupItem } from "@starter/ui/components/toggle-group";
import { cn } from "@starter/ui/lib/utils";

import type { SeoGeoController, SeoGeoStep } from "./use-seo-geo-controller";

const tabs = ["todo", "done"] as const;

const stepHrefs = {
	domain: "/dashboard/website?websiteSettings=domains",
	publish: "/dashboard/website",
} as const;

const majorIssues = new Set(["missingTitle", "missingH1"]);

const searchNotes = {
	noDomain: "searchConsole.noDomain",
	propertyMissing: "searchConsole.propertyMissing",
	unavailable: "searchConsole.unavailable",
} as const;

const metadataIssues = new Set(["missingTitle", "missingDescription", "duplicateTitle"]);

const issueHref = (issue: SeoOverview["issues"][number]) =>
	metadataIssues.has(issue.code)
		? `/dashboard/website?websiteSettings=pages&seoFocus=${encodeURIComponent(issue.pageId)}`
		: `/dashboard/website?seoPage=${encodeURIComponent(issue.pageId)}&seoLocale=${encodeURIComponent(issue.locale)}`;

const PageIssues = ({ overview }: { overview: SeoOverview }) => {
	const t = useTranslations("seoGeo");

	if (overview.publishedAt === null) {
		return <DashboardFrameEmpty>{t("publishToCheck")}</DashboardFrameEmpty>;
	}

	if (overview.issues.length === 0) {
		return <DashboardFrameEmpty>{t("noMetadataIssues")}</DashboardFrameEmpty>;
	}

	return (
		<ul className='grid gap-1'>
			{overview.issues.map((issue) => (
				<li
					className='flex min-h-14 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted'
					key={`${issue.pageId}:${issue.locale}:${issue.code}`}
				>
					<span
						aria-hidden
						className={cn(
							"size-2 shrink-0 rounded-full",
							majorIssues.has(issue.code) ? "bg-destructive" : "bg-warning"
						)}
					/>
					<div className='grid min-w-0 flex-1 gap-0.5'>
						<p>{t(`issue.${issue.code}`)}</p>
						<p className='truncate text-xs text-muted-foreground' dir='ltr'>
							{issue.path}
							{issue.code === "duplicateTitle" ? ` · ${issue.observed}` : ""}
						</p>
					</div>
					<Button
						nativeButton={false}
						render={<Link aria-label={`${t("fixPage")}: ${issue.path}`} href={issueHref(issue)} />}
						size='sm'
						variant='secondary'
					>
						{t("fixPage")}
					</Button>
				</li>
			))}
		</ul>
	);
};

const blogTopic = (controller: SeoGeoController) => {
	const sample = controller.geo.data?.samples.find((entry) =>
		entry.result?.results.some((result) => result.status === "success" && !result.brandMentioned)
	);

	return sample ? `/dashboard/blog?topic=${encodeURIComponent(sample.question)}` : "/dashboard/blog";
};

const StepAction = ({
	controller,
	onReviewPages,
	step,
}: {
	controller: SeoGeoController;
	onReviewPages: () => void;
	step: SeoGeoStep;
}) => {
	const t = useTranslations("seoGeo.steps");
	const label = t(`${step.id}.action`);

	if (step.id === "pages") {
		return (
			<Button onClick={onReviewPages} size='sm' variant='secondary'>
				{label}
				<ForwardIcon data-icon='inline-end' />
			</Button>
		);
	}

	if (step.id === "search") {
		return controller.search.data?.status === "notConnected" ? (
			<Button
				loading={controller.connect === "pending"}
				onClick={() => controller.connectGoogle()}
				size='sm'
				variant='secondary'
			>
				{label}
				<ForwardIcon data-icon='inline-end' />
			</Button>
		) : null;
	}

	return (
		<Button
			nativeButton={false}
			render={
				<Link
					href={step.id === "domain" || step.id === "publish" ? stepHrefs[step.id] : blogTopic(controller)}
				/>
			}
			size='sm'
			variant='secondary'
		>
			{label}
			<ForwardIcon data-icon='inline-end' />
		</Button>
	);
};

const useStepNote = (controller: SeoGeoController) => {
	const t = useTranslations("seoGeo");

	return (step: SeoGeoStep) => {
		if (step.done) {
			return t(`steps.${step.id}.done`);
		}

		const status = controller.search.data?.status;

		if (step.id === "search" && (controller.connect === "error" || controller.search.isError)) {
			return t(searchNotes.unavailable);
		}

		if (
			step.id === "search" &&
			(status === "noDomain" || status === "propertyMissing" || status === "unavailable")
		) {
			return t(searchNotes[status]);
		}

		return t(`steps.${step.id}.description`);
	};
};

const StepRow = ({
	controller,
	onReviewPages,
	step,
}: {
	controller: SeoGeoController;
	onReviewPages: () => void;
	step: SeoGeoStep;
}) => {
	const t = useTranslations("seoGeo.steps");
	const note = useStepNote(controller);

	return (
		<li className='grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-3 rounded-lg px-3 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center'>
			<HugeiconsIcon
				aria-hidden
				className={cn(
					"mt-0.5 size-5 scale-110 sm:mt-0",
					step.done ? "text-success-foreground" : "text-muted-foreground/50"
				)}
				icon={step.done ? CheckmarkCircle02Icon : CircleIcon}
				strokeWidth={1.75}
			/>
			<div className='grid gap-1'>
				<p className='flex flex-wrap items-baseline gap-x-2 text-sm font-medium'>
					{t(`${step.id}.title`)}
					{!step.done && (
						<span className='text-xs font-normal text-muted-foreground'>
							{t("minutes", { count: step.minutes })}
						</span>
					)}
				</p>
				<p className='text-sm text-muted-foreground'>{note(step)}</p>
			</div>
			<div className='col-start-2 flex items-center gap-3 sm:col-start-3'>
				<span className='text-xs font-medium whitespace-nowrap text-success-foreground tabular-nums'>
					{t("points", { count: step.done ? step.earned : step.points - step.earned })}
				</span>
				{!step.done && <StepAction controller={controller} onReviewPages={onReviewPages} step={step} />}
			</div>
		</li>
	);
};

export const SeoGeoSteps = ({ controller, overview }: { controller: SeoGeoController; overview: SeoOverview }) => {
	const t = useTranslations("seoGeo");
	const format = useFormatter();
	const [tab, setTab] = useState<(typeof tabs)[number]>("todo");
	const [pagesOpen, setPagesOpen] = useState(false);
	const visible = controller.steps.filter((step) => step.done === (tab === "done"));

	return (
		<DashboardFrame label={t("steps.title")}>
			<DashboardFrameHeader
				action={
					<ToggleGroup
						aria-label={t("steps.title")}
						onValueChange={(value) => setTab(tabs.find((entry) => value.includes(entry)) ?? tab)}
						size='sm'
						value={[tab]}
					>
						{tabs.map((entry) => (
							<ToggleGroupItem key={entry} value={entry}>
								{t(`steps.${entry}`)}
								<span className='text-muted-foreground tabular-nums'>
									{format.number(
										controller.steps.filter((step) => step.done === (entry === "done")).length
									)}
								</span>
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				}
				icon={Task01Icon}
				title={t("steps.title")}
			/>
			<DashboardFramePanel>
				{visible.length ? (
					<ul className='grid gap-0.5'>
						{visible.map((step) => (
							<StepRow
								controller={controller}
								key={step.id}
								onReviewPages={() => setPagesOpen(true)}
								step={step}
							/>
						))}
					</ul>
				) : (
					<DashboardFrameEmpty>{t(tab === "todo" ? "steps.allDone" : "steps.noneDone")}</DashboardFrameEmpty>
				)}
			</DashboardFramePanel>
			<DashboardDrawer closeLabel={t("close")} onOpenChange={setPagesOpen} open={pagesOpen}>
				<DashboardDrawerHeader
					description={t("pageChecksDescription", { count: overview.pageCount })}
					leading={<HugeiconsIcon className='size-6 scale-110' icon={File01Icon} strokeWidth={1.75} />}
					title={t("pageChecks")}
				/>
				<DrawerPanel padding='spacious'>
					<div className='pb-10'>
						<PageIssues overview={overview} />
					</div>
				</DrawerPanel>
			</DashboardDrawer>
		</DashboardFrame>
	);
};
