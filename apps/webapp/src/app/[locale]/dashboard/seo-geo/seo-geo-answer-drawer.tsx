"use client";

import { useState } from "react";

import Image from "next/image";

import { AiBrain01Icon, ChatGptIcon, ClaudeIcon, GoogleGeminiIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useFormatter, useTranslations } from "next-intl";

import { DashboardDrawer, DashboardDrawerHeader } from "@/app/[locale]/dashboard/components/dashboard-drawer";
import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { Link } from "@/i18n/navigation";
import { Badge } from "@starter/ui/components/badge";
import { Button } from "@starter/ui/components/button";
import { DrawerFooter, DrawerPanel } from "@starter/ui/components/drawer";
import { Frame, FramePanel } from "@starter/ui/components/frame";
import type { CSSPropertiesWithVariables } from "@starter/ui/components/sidebar";
import { Tabs, TabsList, TabsTrigger } from "@starter/ui/components/tabs";

import { countMentions, type SeoGeoSample } from "./use-seo-geo-controller";

export const geoProviderIcons = { claude: ClaudeIcon, gemini: GoogleGeminiIcon, openai: ChatGptIcon } as const;

const providers = ["openai", "gemini", "claude"] as const;

const Answer = ({ mode, provider, sample }: { mode: "sample" | "web"; provider: string; sample: SeoGeoSample }) => {
	const t = useTranslations("seoGeo.promptExplorer");
	const format = useFormatter();
	const answer = sample.result?.results.find((entry) => entry.model === provider);

	if (answer?.status !== "success") {
		return <p className='text-sm text-muted-foreground'>{t(sample.result ? "modelError" : "sampleError")}</p>;
	}

	return (
		<div className='flex flex-col gap-5'>
			<div className='flex flex-wrap items-center gap-2'>
				<Badge variant={answer.brandMentioned ? "optimal" : "default"}>
					{t(answer.brandMentioned ? "mentioned" : "notMentioned")}
				</Badge>
				<span className='text-xs text-muted-foreground'>
					{t(mode === "web" ? "withSources" : "sample")} ·{" "}
					{format.dateTime(new Date(answer.fetchedAt), { dateStyle: "medium", timeStyle: "short" })}
				</span>
			</div>
			<Frame>
				<FramePanel>
					<p className='text-sm leading-relaxed whitespace-pre-wrap'>{answer.text || t("emptyAnswer")}</p>
				</FramePanel>
			</Frame>
			{answer.sources.length > 0 && (
				<div className='flex flex-col gap-2'>
					<p className='px-3 text-xs text-muted-foreground'>{t("sources")}</p>
					<ul className='flex flex-col gap-0.5'>
						{answer.sources.map((source) => (
							<li key={source.url}>
								<a
									className='flex min-h-11 min-w-0 items-center gap-3 rounded-lg px-3 text-sm transition-colors hover:bg-muted'
									href={source.url}
									rel='noreferrer'
									target='_blank'
								>
									<Image
										alt=''
										className='size-4 shrink-0'
										height={16}
										src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(source.domain)}&sz=32`}
										unoptimized
										width={16}
									/>
									<span className='min-w-0 flex-1 truncate'>{source.title}</span>
									<span className='shrink-0 text-xs text-muted-foreground'>{source.domain}</span>
								</a>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
};

const AnswerActions = ({ sample }: { sample: SeoGeoSample }) => {
	const t = useTranslations("seoGeo.promptExplorer");
	const { can } = useOrganizationPermissions();
	const missed = sample.result?.results.some((entry) => entry.status === "success" && !entry.brandMentioned);

	if (!can("workspace.write") || !missed) {
		return null;
	}

	return (
		<DrawerFooter>
			<Button
				nativeButton={false}
				render={<Link href={`/dashboard/blog?topic=${encodeURIComponent(sample.question)}`} />}
			>
				{t("draftPost")}
			</Button>
		</DrawerFooter>
	);
};

export const SeoGeoAnswerDrawer = ({
	onOpenChange,
	open,
	sample,
}: {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	sample: SeoGeoSample | undefined;
}) => {
	const t = useTranslations("seoGeo");
	const format = useFormatter();
	const [provider, setProvider] = useState<(typeof providers)[number]>("openai");
	const mentions = countMentions(sample ? [sample] : []);
	const checkedAt = sample?.history[0]?.checkedAt;

	return (
		<DashboardDrawer closeLabel={t("close")} onOpenChange={onOpenChange} open={open}>
			{sample && (
				<>
					<DashboardDrawerHeader
						description={
							checkedAt &&
							t("promptExplorer.lastChecked", {
								date: format.dateTime(new Date(checkedAt), { dateStyle: "medium" }),
							})
						}
						leading={<HugeiconsIcon className='size-6 scale-110' icon={AiBrain01Icon} strokeWidth={1.75} />}
						title={sample.question}
					>
						<dl className='flex justify-center gap-8 md:justify-start'>
							<div className='grid gap-1 text-center md:text-start'>
								<dt className='text-sm text-muted-foreground'>{t("answers.mentions")}</dt>
								<dd className='text-3xl tracking-tight tabular-nums'>
									{t("answers.ratio", { mentioned: mentions.mentioned, total: mentions.total })}
								</dd>
							</div>
							{sample.history.length > 1 && (
								<div className='grid gap-1 text-center md:text-start'>
									<dt className='text-sm text-muted-foreground'>
										{t("promptExplorer.recentChecks")}
									</dt>
									<dd className='flex h-9 items-end gap-1'>
										{sample.history.toReversed().map((run) => (
											<span
												aria-label={`${run.mentionedCount}/3`}
												className='h-(--height) w-2 rounded-full bg-chart-1'
												key={run.id}
												role='img'
												style={
													{
														"--height": `${Math.max(12, (run.mentionedCount / 3) * 100)}%`,
													} satisfies CSSPropertiesWithVariables
												}
											/>
										))}
									</dd>
								</div>
							)}
						</dl>
					</DashboardDrawerHeader>
					<Tabs
						onValueChange={(value) => setProvider(providers.find((entry) => entry === value) ?? provider)}
						spacing='none'
						value={provider}
					>
						<TabsList aria-label={t("promptExplorer.providers")} surface='panel'>
							{providers.map((entry) => (
								<TabsTrigger key={entry} size='lg' value={entry}>
									<HugeiconsIcon
										aria-hidden
										className='scale-110'
										icon={geoProviderIcons[entry]}
										strokeWidth={1.75}
									/>
									{t(`promptExplorer.model.${entry}`)}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
					<DrawerPanel padding='spacious'>
						<div className='pb-10'>
							<Answer mode={sample.mode ?? "sample"} provider={provider} sample={sample} />
						</div>
					</DrawerPanel>
					<AnswerActions sample={sample} />
				</>
			)}
		</DashboardDrawer>
	);
};
