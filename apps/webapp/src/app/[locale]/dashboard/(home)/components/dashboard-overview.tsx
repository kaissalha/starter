"use client";

import { lazy, Suspense } from "react";

import { Globe02Icon, Link01Icon } from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import {
	DashboardFrame,
	DashboardFrameAction,
	DashboardFrameEmpty,
	DashboardFrameHeader,
	DashboardFramePanel,
} from "@/app/[locale]/dashboard/components/dashboard-frame";
import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { Link } from "@/i18n/navigation";
import { apiClient } from "@/lib/api-client";
import { resolveLinkPageBrand } from "@starter/infinite-links/document";
import { Badge } from "@starter/ui/components/badge";
import { Button } from "@starter/ui/components/button";
import { FramePanel } from "@starter/ui/components/frame";
import { Skeleton } from "@starter/ui/components/skeleton";
import "@starter/infinite-website/styles.css";
import "@starter/infinite-brand/fonts.css";

import { DashboardActivity } from "./dashboard-activity";

const SiteRenderer = lazy(async () => {
	const renderer = await import("@starter/infinite-website");

	return { default: renderer.SiteRenderer };
});

const LinkPageRenderer = lazy(async () => {
	const renderer = await import("@starter/infinite-links");

	return { default: renderer.LinkPageRenderer };
});

export const DashboardOverview = () => {
	const { can } = useOrganizationPermissions();
	const tPermissions = useTranslations("permissions");
	const locale = useLocale() === "ar" ? "ar" : "en";
	const t = useTranslations("dashboard.home.overview");
	const website = useQuery(apiClient.websites.get.queryOptions());
	const links = useQuery(apiClient.linkPages.get.queryOptions());
	const snapshot = website.data?.snapshot;

	const previews = [
		{
			action: can("workspace.write") ? t(website.data ? "editWebsite" : "createWebsite") : tPermissions("view"),
			canOpen: can("workspace.write") || Boolean(website.data),
			content: snapshot && (
				<SiteRenderer
					assets={snapshot.assets}
					brand={snapshot.brand}
					document={snapshot.document}
					locale={locale}
					preview
				/>
			),
			emptyDescription: t("emptyDescription"),
			emptyTitle: t((website.isError && "error") || (website.data && "inProgress") || "emptyTitle"),
			href: "/dashboard/website",
			icon: Globe02Icon,
			label: t("website"),
			loading: t("loading"),
			publication: snapshot ? website.data?.publication : undefined,
			query: website,
			title: website.data?.brief.name ?? t("website"),
		},
		{
			action: can("workspace.write") ? t("links.action") : tPermissions("view"),
			canOpen: can("workspace.write") || Boolean(links.data),
			content: links.data && (
				<LinkPageRenderer
					brand={resolveLinkPageBrand({
						brandOverride: links.data.document.appearance.brandOverride,
						inheritedBrand: links.data.inheritedBrand,
					})}
					document={links.data.document}
					locale={locale}
					preview
				/>
			),
			emptyDescription: undefined,
			emptyTitle: t(links.isError ? "loadError" : "links.empty"),
			href: "/dashboard/links",
			icon: Link01Icon,
			label: t("links.title"),
			loading: t("loadingRecords"),
			publication: links.data?.publication,
			query: links,
			title: t("links.title"),
		},
	];

	const [websitePreview, linksPreview] = previews.map((preview) => {
		const publishedStatus = preview.publication?.hasUnpublishedChanges ? "unpublished" : "published";
		const status = preview.publication?.publishedAt ? publishedStatus : "draft";

		return (
			<DashboardFrame key={preview.href} label={preview.label}>
				<DashboardFrameHeader
					action={
						preview.canOpen && (
							<DashboardFrameAction href={preview.href}>{preview.action}</DashboardFrameAction>
						)
					}
					badge={
						preview.publication && (
							<Badge className='shrink-0' variant={status === "published" ? "optimal" : "suboptimal"}>
								{t(status)}
							</Badge>
						)
					}
					icon={preview.icon}
					title={preview.title}
				/>
				{preview.content || preview.query.isPending ? (
					<FramePanel className='overflow-hidden' padding='none'>
						{preview.query.isPending && (
							<Skeleton
								aria-label={preview.loading}
								className='h-80 w-full sm:h-[24rem]'
								corners='square'
								role='status'
							/>
						)}
						{preview.content && (
							<div className='relative'>
								<div
									aria-hidden='true'
									className='pointer-events-none h-80 overflow-hidden bg-background sm:h-[24rem]'
									dir='ltr'
									inert
								>
									<div className='h-[40rem] w-[200%] origin-top-left scale-50 sm:h-[48rem]'>
										<Suspense fallback={<Skeleton className='h-[48rem]' corners='square' />}>
											{preview.content}
										</Suspense>
									</div>
								</div>
								<Link
									aria-label={preview.action}
									className='absolute inset-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring'
									href={preview.href}
									prefetch={true}
								/>
							</div>
						)}
					</FramePanel>
				) : (
					<DashboardFramePanel>
						<DashboardFrameEmpty className='h-76 sm:h-92' icon={preview.icon}>
							{preview.emptyTitle}
							{preview.emptyDescription && (
								<p className='max-w-xs font-normal text-muted-foreground'>{preview.emptyDescription}</p>
							)}
							{preview.query.isError && (
								<Button onClick={() => preview.query.refetch()} size='sm' variant='secondary'>
									{t("retry")}
								</Button>
							)}
						</DashboardFrameEmpty>
					</DashboardFramePanel>
				)}
			</DashboardFrame>
		);
	});

	return <DashboardActivity linksPreview={linksPreview} websitePreview={websitePreview} />;
};
