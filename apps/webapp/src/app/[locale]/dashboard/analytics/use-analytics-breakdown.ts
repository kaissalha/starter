"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type { AnalyticsFilters } from "@starter/analytics";

import type { AnalyticsDimension } from "./analytics-labels";

const pageSize = 50;

export const useAnalyticsBreakdown = ({
	dimension,
	filters,
}: {
	dimension: AnalyticsDimension;
	filters: AnalyticsFilters;
}) =>
	useQuery({
		...apiClient.analytics.breakdown.queryOptions({ input: { ...filters, dimension, limit: 6 } }),
		refetchInterval: 60_000,
		retry: false,
	});

export const useAnalyticsBreakdownPages = ({
	dimension,
	filters,
}: {
	dimension: AnalyticsDimension;
	filters: AnalyticsFilters;
}) =>
	useInfiniteQuery(
		apiClient.analytics.breakdown.infiniteOptions<number>({
			getNextPageParam: (page, pages) => (page.hasMore ? pages.length * pageSize : undefined),
			initialPageParam: 0,
			input: (offset) => ({ ...filters, dimension, limit: pageSize, offset }),
			retry: false,
		})
	);
