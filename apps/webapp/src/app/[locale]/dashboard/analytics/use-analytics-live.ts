"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type { AnalyticsFilters } from "@starter/analytics";

import type { GlobePoint } from "./analytics-globe";

export const useAnalyticsLive = (filters: AnalyticsFilters) => {
	const query = useQuery({
		...apiClient.analytics.live.queryOptions({ input: { ...filters, from: undefined, to: undefined } }),
		refetchInterval: 10_000,
		retry: false,
	});

	const visitors = query.data?.data ?? [];

	const places = Map.groupBy(
		visitors.filter(({ latitude, longitude }) => latitude !== 0 || longitude !== 0),
		({ city, country, latitude, longitude }) => (city ? `${country}|${city}` : `${latitude},${longitude}`)
	);

	const points: Array<GlobePoint> = [...places.values()].flatMap((group) => {
		const [first] = group;

		return first
			? [
					{
						count: group.length,
						id: `p${first.key}`,
						label: first.city || first.country,
						latitude: first.latitude,
						longitude: first.longitude,
					},
				]
			: [];
	});

	return { points, query, visitors };
};
