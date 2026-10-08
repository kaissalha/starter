"use client";

import type { ReactNode } from "react";

import { Contact01Icon, News01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery } from "@tanstack/react-query";
import { useFormatter, useLocale, useNow, useTranslations } from "next-intl";

import {
	DashboardFrame,
	DashboardFrameAction,
	DashboardFrameEmpty,
	DashboardFrameHeader,
	DashboardFramePanel,
	DashboardFrameRow,
} from "@/app/[locale]/dashboard/components/dashboard-frame";
import { apiClient } from "@/lib/api-client";
import { Badge } from "@starter/ui/components/badge";
import { Skeleton } from "@starter/ui/components/skeleton";

import { DashboardHistory } from "./dashboard-history";

export const DashboardActivity = ({
	linksPreview,
	websitePreview,
}: {
	linksPreview: ReactNode;
	websitePreview: ReactNode;
}) => {
	const t = useTranslations("dashboard.home.overview");
	const locale = useLocale() === "ar" ? "ar" : "en";
	const format = useFormatter();
	const now = useNow();
	const contacts = useQuery(apiClient.contacts.list.queryOptions({ input: { pageSize: 3 } }));
	const posts = useQuery(apiClient.blogPosts.list.queryOptions({ input: { pageSize: 3 } }));

	const sections = [
		{
			empty: contacts.data?.data.length === 0,
			entries: contacts.data?.data.map((contact) => ({
				href: `/dashboard/contacts?contact=${contact.id}`,
				id: contact.id,
				label: contact.name || contact.email || contact.phone || t("contacts.title"),
				leading: (
					<span
						aria-hidden
						className='flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary'
					>
						{Array.from(contact.name || contact.email || contact.phone || "?")[0]?.toLocaleUpperCase()}
					</span>
				),
				secondary: contact.email || contact.phone,
				trailing: format.relativeTime(new Date(contact.createdAt), now),
			})),
			href: "/dashboard/contacts",
			icon: Contact01Icon,
			key: "contacts",
			query: contacts,
		},
		{
			empty: posts.data?.data.length === 0,
			entries: posts.data?.data.map((post) => ({
				href: `/dashboard/blog/${post.id}`,
				id: post.id,
				label: post.document[locale].title || post.document.en.title || t("untitled"),
				leading: (
					<HugeiconsIcon
						aria-hidden
						className='size-4 shrink-0 scale-110 text-muted-foreground'
						icon={News01Icon}
						strokeWidth={1.75}
					/>
				),
				secondary: undefined,
				trailing: (
					<Badge variant={post.publishedAt ? "optimal" : "default"}>
						{t(post.publishedAt ? "published" : "draft")}
					</Badge>
				),
			})),
			href: "/dashboard/blog",
			icon: News01Icon,
			key: "blog",
			query: posts,
		},
	] as const;

	const renderSection = ({ empty, entries, href, icon, key, query }: (typeof sections)[number]) => (
		<DashboardFrame className='min-h-64' key={key} label={t(`${key}.title`)}>
			<DashboardFrameHeader
				action={<DashboardFrameAction href={href}>{t(`${key}.action`)}</DashboardFrameAction>}
				icon={icon}
				title={t(`${key}.title`)}
			/>
			<DashboardFramePanel>
				{query.isError && (
					<DashboardFrameEmpty icon={icon}>
						<p role='alert'>{t("loadError")}</p>
					</DashboardFrameEmpty>
				)}
				{query.isPending && (
					<div aria-label={t("loadingRecords")} className='grid gap-1' role='status'>
						<Skeleton className='h-12 w-full' />
						<Skeleton className='h-12 w-full' />
						<Skeleton className='h-12 w-full' />
					</div>
				)}
				{query.isSuccess && empty && <DashboardFrameEmpty icon={icon}>{t(`${key}.empty`)}</DashboardFrameEmpty>}
				<ul className='grid gap-0.5'>
					{entries?.map((entry) => (
						<DashboardFrameRow
							href={entry.href}
							key={entry.id}
							leading={entry.leading}
							secondary={entry.secondary}
							title={entry.label}
							trailing={entry.trailing}
						/>
					))}
				</ul>
			</DashboardFramePanel>
		</DashboardFrame>
	);

	return (
		<div className='grid items-start gap-4 lg:grid-cols-3'>
			<div className='grid min-w-0 gap-4'>
				{websitePreview}
				{sections.flatMap((section) => (section.key === "contacts" ? [renderSection(section)] : []))}
			</div>
			<DashboardHistory />
			<div className='grid min-w-0 gap-4'>
				{linksPreview}
				{sections.flatMap((section) => (section.key === "blog" ? [renderSection(section)] : []))}
			</div>
		</div>
	);
};
