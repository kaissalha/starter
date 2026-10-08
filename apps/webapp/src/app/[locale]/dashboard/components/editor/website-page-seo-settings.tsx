"use client";

import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";

import { apiClient } from "@/lib/api-client";
import type { Iso6391LanguageCode } from "@starter/infinite-website";
import type { WebsiteSnapshotV1 } from "@starter/infinite-website/contracts";
import type { SeoOverview } from "@starter/server/api";
import { Badge } from "@starter/ui/components/badge";
import { Button } from "@starter/ui/components/button";
import { Field, FieldControl, FieldLabel } from "@starter/ui/components/field";
import { Frame, FramePanel } from "@starter/ui/components/frame";
import { ScrollArea } from "@starter/ui/components/scroll-area";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@starter/ui/components/select";
import { Textarea } from "@starter/ui/components/textarea";
import { cn } from "@starter/ui/lib/utils";

import { getPageTitle } from "../../website/website-page-select";
import type { useWebsiteLanguages } from "./use-website-languages";

const limits = { description: 160, title: 60 } as const;

const PageSeoForm = ({
	controller,
	focused,
	issues,
	locale,
	page,
	snapshot,
}: {
	controller: ReturnType<typeof useWebsiteLanguages>;
	focused: boolean;
	issues: Array<SeoOverview["issues"][number]["code"]>;
	locale: Iso6391LanguageCode;
	page: WebsiteSnapshotV1["document"]["structure"]["pages"][number];
	snapshot: WebsiteSnapshotV1;
}) => {
	const t = useTranslations("website.settings.pagesForm");
	const tIssues = useTranslations("seoGeo.issue");
	const content = snapshot.document.content;
	const seo = content[locale]?.pages[page.id]?.seo ?? content[snapshot.document.defaultLocale]?.pages[page.id]?.seo;
	const initial = { description: seo?.description ?? "", title: seo?.title ?? "" };
	const [value, setValue] = useState(initial);
	const changed = value.title !== initial.title || value.description !== initial.description;
	const name = page.home ? t("home") : getPageTitle({ locale, pageId: page.id, snapshot });

	const fields = [
		{ key: "title", multiline: false },
		{ key: "description", multiline: true },
	] as const;

	return (
		<div className={cn("rounded-2xl", focused && "ring-2 ring-ring")}>
			<Frame>
				<div className='flex min-h-11 flex-wrap items-center gap-2 px-3 py-1.5'>
					<p className='text-sm font-medium'>{name}</p>
					{issues.map((code) => (
						<Badge key={code} variant='suboptimal'>
							{tIssues(code)}
						</Badge>
					))}
				</div>
				<FramePanel>
					<form
						className='grid gap-4'
						onSubmit={(event) => {
							event.preventDefault();
							controller.edit({
								description: value.description.trim(),
								locale,
								operation: "update-page-seo",
								pageId: page.id,
								title: value.title.trim(),
							});
						}}
					>
						{fields.map(({ key, multiline }) => (
							<Field key={key}>
								<FieldLabel>{t(key)}</FieldLabel>
								{multiline ? (
									<Textarea
										maxLength={320}
										onChange={(event) => setValue({ ...value, [key]: event.target.value })}
										rows={2}
										value={value[key]}
									/>
								) : (
									<FieldControl
										maxLength={120}
										onChange={(event) => setValue({ ...value, [key]: event.target.value })}
										required
										value={value[key]}
									/>
								)}
								<p
									className={cn(
										"text-xs text-muted-foreground tabular-nums",
										value[key].length > limits[key] && "text-warning-foreground"
									)}
								>
									{t("length", { count: value[key].length, limit: limits[key] })}
								</p>
							</Field>
						))}
						<Button
							className='justify-self-end'
							disabled={!changed || !value.title.trim() || !controller.enabled}
							loading={controller.pending}
							size='sm'
							type='submit'
						>
							{t("save")}
						</Button>
					</form>
				</FramePanel>
			</Frame>
		</div>
	);
};

export const WebsitePageSeoSettings = ({ controller }: { controller: ReturnType<typeof useWebsiteLanguages> }) => {
	const t = useTranslations("website.settings");
	const tLanguage = useTranslations("language.options");
	const snapshot = controller.website?.snapshot;
	const [focus] = useQueryState("seoFocus");
	const [locale, setLocale] = useState<Iso6391LanguageCode | null>(null);
	const overview = useQuery({ ...apiClient.seo.overview.queryOptions(undefined), staleTime: 60_000 });

	if (!snapshot) {
		return null;
	}

	const current = locale ?? snapshot.document.defaultLocale;
	const languageName = (code: string) => (code === "en" || code === "ar" ? tLanguage(code) : code);

	return (
		<ScrollArea className='flex-1'>
			<div className='grid gap-6 p-4 md:p-10'>
				<div className='flex flex-wrap items-center justify-between gap-3'>
					<h2 className='text-xl font-semibold'>{t("pagesTitle")}</h2>
					{snapshot.document.locales.length > 1 && (
						<Select
							items={snapshot.document.locales.map((code) => ({
								label: languageName(code),
								value: code,
							}))}
							onValueChange={(value) =>
								setLocale(snapshot.document.locales.find((code) => code === value) ?? null)
							}
							value={current}
						>
							<SelectTrigger aria-label={t("languages")} className='w-auto' size='sm'>
								<SelectValue />
							</SelectTrigger>
							<SelectPopup>
								{snapshot.document.locales.map((code) => (
									<SelectItem key={code} value={code}>
										{languageName(code)}
									</SelectItem>
								))}
							</SelectPopup>
						</Select>
					)}
				</div>
				<div className='grid gap-4'>
					{snapshot.document.structure.pages.map((page) => (
						<PageSeoForm
							controller={controller}
							focused={focus === page.id}
							issues={[
								...new Set(
									(overview.data?.issues ?? [])
										.filter((issue) => issue.pageId === page.id && issue.locale === current)
										.map((issue) => issue.code)
								),
							]}
							key={`${page.id}:${current}:${snapshot.document.content[current]?.pages[page.id]?.seo?.title ?? ""}`}
							locale={current}
							page={page}
							snapshot={snapshot}
						/>
					))}
				</div>
			</div>
		</ScrollArea>
	);
};
