"use client";

import { useState, type FormEvent } from "react";

import { AiBrain01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import {
	DashboardFrame,
	DashboardFrameHeader,
	DashboardFramePanel,
	ForwardIcon,
} from "@/app/[locale]/dashboard/components/dashboard-frame";
import { apiClient } from "@/lib/api-client";
import { Badge } from "@starter/ui/components/badge";
import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Label } from "@starter/ui/components/label";
import { Skeleton } from "@starter/ui/components/skeleton";
import { cn } from "@starter/ui/lib/utils";

import { geoProviderIcons, SeoGeoAnswerDrawer } from "./seo-geo-answer-drawer";
import { countMentions, type SeoGeoController, type SeoGeoSample } from "./use-seo-geo-controller";

const ProviderMarks = ({ sample }: { sample: SeoGeoSample }) => {
	const t = useTranslations("seoGeo.answers");
	const mentions = countMentions([sample]);

	return (
		<span className='flex shrink-0 items-center gap-1.5'>
			<span className='sr-only'>{t("ratioLabel", { mentioned: mentions.mentioned, total: mentions.total })}</span>
			{(sample.result?.results ?? []).map((entry) => (
				<HugeiconsIcon
					aria-hidden
					className={cn(
						"size-4",
						entry.status === "success" && entry.brandMentioned
							? "text-success-foreground"
							: "text-muted-foreground/40"
					)}
					icon={geoProviderIcons[entry.model]}
					key={entry.model}
					strokeWidth={1.75}
				/>
			))}
		</span>
	);
};

const AskForm = ({ controller }: { controller: SeoGeoController }) => {
	const t = useTranslations("seoGeo.promptExplorer");
	const queryClient = useQueryClient();
	const [prompt, setPrompt] = useState("");

	const explore = useMutation({
		...apiClient.seo.explorePrompt.mutationOptions(),
		onSuccess: () => {
			setPrompt("");
			queryClient.invalidateQueries({ queryKey: controller.geoOptions.queryKey });
		},
	});

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (prompt.trim()) {
			explore.mutate({ locale: controller.locale, prompt: prompt.trim() });
		}
	};

	return (
		<div className='mt-auto grid gap-2 border-t border-border px-1 pt-3 pb-1'>
			<form className='flex flex-wrap items-center gap-2' onSubmit={submit}>
				<Label className='sr-only' htmlFor='seo-prompt'>
					{t("question")}
				</Label>
				<Input
					className='min-w-48 flex-1'
					disabled={!controller.canWrite}
					id='seo-prompt'
					maxLength={500}
					onChange={(event) => setPrompt(event.target.value)}
					placeholder={t("placeholder")}
					value={prompt}
				/>
				<Button disabled={!controller.canWrite || !prompt.trim()} loading={explore.isPending} type='submit'>
					{t("run")}
				</Button>
			</form>
			{explore.isError && (
				<p className='text-sm text-destructive' role='alert'>
					{t("error")}
				</p>
			)}
		</div>
	);
};

export const SeoGeoAnswers = ({ controller }: { controller: SeoGeoController }) => {
	const t = useTranslations("seoGeo");
	const [open, setOpen] = useState(false);
	const [selected, setSelected] = useState<string>();
	const { geo } = controller;
	const mentions = countMentions(geo.data?.samples ?? []);

	return (
		<DashboardFrame label={t("promptExplorer.title")}>
			<DashboardFrameHeader
				badge={
					mentions.total > 0 && (
						<Badge variant={mentions.mentioned ? "optimal" : "default"}>
							{t("answers.ratioLabel", { mentioned: mentions.mentioned, total: mentions.total })}
						</Badge>
					)
				}
				description={
					geo.data?.business
						? t("promptExplorer.description", { location: geo.data.business.location })
						: t("promptExplorer.loadingDescription")
				}
				icon={AiBrain01Icon}
				title={t("promptExplorer.title")}
			/>
			<DashboardFramePanel>
				{geo.isPending && (
					<div aria-label={t("promptExplorer.loading")} className='grid gap-2 p-1' role='status'>
						{["a", "b", "c"].map((key) => (
							<Skeleton className='h-12 w-full' key={key} />
						))}
					</div>
				)}
				{geo.isError && (
					<p className='p-3 text-sm text-muted-foreground' role='alert'>
						{t("promptExplorer.error")}
					</p>
				)}
				{geo.data && (
					<ul className='grid gap-0.5 pb-2'>
						{geo.data.samples.map((sample) => (
							<li key={sample.id}>
								<button
									className='flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2 text-start text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring'
									onClick={() => {
										setSelected(sample.id);
										setOpen(true);
									}}
									type='button'
								>
									<span className='min-w-0 flex-1'>{sample.question}</span>
									<ProviderMarks sample={sample} />
									<span className='text-muted-foreground'>
										<ForwardIcon data-icon='inline-end' />
									</span>
								</button>
							</li>
						))}
					</ul>
				)}
				<AskForm controller={controller} />
			</DashboardFramePanel>
			<SeoGeoAnswerDrawer
				onOpenChange={setOpen}
				open={open}
				sample={geo.data?.samples.find((sample) => sample.id === selected)}
			/>
		</DashboardFrame>
	);
};
