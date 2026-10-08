"use client";

import { useReducer } from "react";

import { useQuery } from "@tanstack/react-query";
import { format, subDays, subMonths } from "date-fns";

import { apiClient } from "@/lib/api-client";
import { analyticsSurfaceSchema, type AnalyticsFilters } from "@starter/analytics";
import type { DateRangePickerProps } from "@starter/ui/components/date-picker";

export const analyticsPeriods = ["today", "yesterday", "7", "30", "90", "365", "custom"] as const;

type Period = (typeof analyticsPeriods)[number];

const localDate = (value: string) => new Date(`${value}T12:00:00`);

const day = (date: Date) => format(date, "yyyy-MM-dd");

type State = {
	filters: AnalyticsFilters;
	period: Period;
	range: DateRangePickerProps["value"];
};

const periodRange = (period: Exclude<Period, "custom">, lastDay: Date) => {
	if (period === "today" || period === "yesterday") {
		const date = period === "today" ? lastDay : subDays(lastDay, 1);

		return { from: date, to: date };
	}

	return { from: subDays(lastDay, Number(period) - 1), to: lastDay };
};

export const useAnalyticsController = (initial: { from: string; to: string }) => {
	const [state, update] = useReducer((current: State, patch: Partial<State>): State => ({ ...current, ...patch }), {
		filters: initial,
		period: "30",
		range: { from: localDate(initial.from), to: localDate(initial.to) },
	});

	const lastDay = localDate(initial.to);
	const firstDay = subMonths(lastDay, 13);

	const validRange =
		!state.filters.from ||
		(state.filters.from >= day(firstDay) &&
			state.filters.from <= (state.filters.to ?? initial.to) &&
			(state.filters.to ?? initial.to) <= initial.to);

	const options = { enabled: validRange, refetchInterval: 60_000, retry: false };
	const scope = { ...state.filters, domain: "", locale: "" };
	const overview = useQuery({ ...apiClient.analytics.overview.queryOptions({ input: state.filters }), ...options });
	const vitals = useQuery({ ...apiClient.analytics.webVitals.queryOptions({ input: state.filters }), ...options });

	const domains = useQuery({
		...apiClient.analytics.breakdown.queryOptions({ input: { ...scope, dimension: "domains", limit: 20 } }),
		...options,
	});

	const locales = useQuery({
		...apiClient.analytics.breakdown.queryOptions({ input: { ...scope, dimension: "locales", limit: 20 } }),
		...options,
	});

	const realtime = useQuery({
		...apiClient.analytics.realtime.queryOptions({ input: { ...state.filters, from: undefined, to: undefined } }),
		refetchInterval: 30_000,
		retry: false,
	});

	return {
		...state,
		domains: domains.data?.data.map(({ key }) => key).filter(Boolean) ?? [],
		firstDay,
		lastDay,
		locales: locales.data?.data.map(({ key }) => key).filter(Boolean) ?? [],
		overview,
		realtime,
		setDomain: (domain: string | null) => update({ filters: { ...state.filters, domain: domain ?? "" } }),
		setLocale: (locale: string | null) => update({ filters: { ...state.filters, locale: locale ?? "" } }),
		setPeriod: (period: Period | null) => {
			if (!period) {
				return;
			}

			if (period === "custom") {
				update({ period });

				return;
			}

			const range = periodRange(period, lastDay);
			update({
				filters: { ...state.filters, from: day(range.from), to: day(range.to) },
				period,
				range,
			});
		},
		setRange: (range: DateRangePickerProps["value"]) => {
			if (!range?.from || !range.to) {
				update({ range });

				return;
			}

			update({ filters: { ...state.filters, from: day(range.from), to: day(range.to) }, range });
		},
		setSurface: (value: string | null) =>
			update({ filters: { ...state.filters, surface: analyticsSurfaceSchema.safeParse(value).data } }),
		validRange,
		vitals,
	};
};
