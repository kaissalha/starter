"use client";

import { useFormatter, useTranslations } from "next-intl";

import { cn } from "@starter/ui/lib/utils";

import type { SeoGeoBand } from "./use-seo-geo-controller";

const arc = "M13.63 71A42 42 0 1 1 86.37 71";

const bandColors = {
	gettingFound: "text-warning",
	highlyVisible: "text-success",
	low: "text-warning",
	notVisible: "text-destructive",
	visible: "text-chart-1",
} as const;

export const SeoGeoScore = ({ band, score }: { band: SeoGeoBand; score: number }) => {
	const t = useTranslations("seoGeo.score");
	const format = useFormatter();
	const label = t(`bands.${band}`);

	return (
		<div
			aria-label={t("label", { band: label, score })}
			className='relative grid size-44 shrink-0 place-items-center'
			role='img'
		>
			<svg aria-hidden className='absolute inset-0 size-full rtl:-scale-x-100' fill='none' viewBox='0 0 100 100'>
				<path className='stroke-muted' d={arc} strokeLinecap='round' strokeWidth={7} />
				<path
					className={cn(
						"stroke-current transition-[stroke-dasharray] duration-1000 ease-out",
						bandColors[band]
					)}
					d={arc}
					pathLength={100}
					strokeDasharray={`${score} 100`}
					strokeLinecap='round'
					strokeWidth={7}
				/>
			</svg>
			<div className='grid justify-items-center pb-3'>
				<span className='text-xs text-muted-foreground'>{t("title")}</span>
				<span className='text-4xl font-semibold tracking-tight tabular-nums'>{format.number(score)}</span>
				<span className='text-xs text-muted-foreground'>{t("outOf")}</span>
			</div>
			<span className='absolute inset-x-0 bottom-2 text-center text-sm font-medium'>{label}</span>
		</div>
	);
};
