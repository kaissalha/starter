"use client";

import {
	CloudIcon,
	CloudRainIcon,
	CloudAngledZapIcon,
	SnowIcon,
	Moon02Icon,
	Sun03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery } from "@tanstack/react-query";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { z } from "zod";

import { apiClient } from "@/lib/api-client";
import { Empty } from "@starter/ui/components/empty";
import { Skeleton } from "@starter/ui/components/skeleton";

const locationsSchema = z.object({
	results: z.array(z.object({ latitude: z.number(), longitude: z.number(), name: z.string() })).optional(),
});

const weatherSchema = z.object({
	current: z.object({ is_day: z.number(), temperature_2m: z.number(), weather_code: z.number() }),
});

const resolveWeatherIcon = ({ is_day: isDay, weather_code: code }: { is_day: number; weather_code: number }) => {
	if (code >= 95) {
		return CloudAngledZapIcon;
	}

	if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
		return SnowIcon;
	}

	if (code >= 51) {
		return CloudRainIcon;
	}

	if (code >= 2) {
		return CloudIcon;
	}

	return isDay ? Sun03Icon : Moon02Icon;
};

export const DashboardWeather = () => {
	const t = useTranslations("dashboard.home.weather");
	const format = useFormatter();
	const locale = useLocale();
	const website = useQuery(apiClient.websites.get.queryOptions());
	const city = website.data?.brief.location.split(",")[0]?.trim();

	const weather = useQuery({
		enabled: Boolean(city),
		queryFn: async ({ signal }) => {
			const locationResponse = await fetch(
				`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ count: "1", language: locale, name: city ?? "" })}`,
				{ signal }
			);

			if (!locationResponse.ok) {
				throw new Error("Weather location unavailable");
			}

			const location = locationsSchema.parse(await locationResponse.json()).results?.[0];

			if (!location) {
				throw new Error("Weather location not found");
			}

			const response = await fetch(
				`https://api.open-meteo.com/v1/forecast?${new URLSearchParams({ current: "temperature_2m,weather_code,is_day", latitude: String(location.latitude), longitude: String(location.longitude) })}`,
				{ signal }
			);

			if (!response.ok) {
				throw new Error("Weather unavailable");
			}

			return { ...weatherSchema.parse(await response.json()).current, name: location.name };
		},
		queryKey: ["dashboard-weather", city, locale],
		retry: 1,
		staleTime: 900_000,
	});

	if (!city) {
		return null;
	}

	if (weather.isPending) {
		return (
			<div aria-label={t("loading")} className='flex items-center gap-3' role='status'>
				<Skeleton className='size-8' corners='circle' />
				<div className='space-y-2'>
					<Skeleton className='h-7 w-16' />
					<Skeleton className='h-3 w-20' />
				</div>
			</div>
		);
	}

	if (!weather.data) {
		return (
			<Empty className='flex-none' role='status' variant='inline'>
				{t("unavailable")}
			</Empty>
		);
	}

	return (
		<div className='flex shrink-0 items-center gap-3' title={t("source")}>
			<HugeiconsIcon
				aria-hidden='true'
				className='size-8 text-muted-foreground scale-110'
				icon={resolveWeatherIcon(weather.data)}
				strokeWidth={1.75}
			/>
			<div className='text-end'>
				<p className='text-2xl tabular-nums' dir='ltr'>
					{format.number(Math.round(weather.data.temperature_2m), {
						numberingSystem: locale === "ar" ? "arab" : "latn",
					})}
					°C
				</p>
				<p className='text-xs text-muted-foreground'>{weather.data.name}</p>
			</div>
		</div>
	);
};
