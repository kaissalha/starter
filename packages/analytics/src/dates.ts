import type { AnalyticsFilters } from "./contracts";

export const toAnalyticsDate = (date: Date) => date.toISOString().slice(0, 10);

export const resolveAnalyticsDates = (input: AnalyticsFilters, now = new Date()) => {
	const today = new Date(`${toAnalyticsDate(now)}T00:00:00Z`);
	const oldest = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 12, 0));
	oldest.setUTCDate(Math.min(today.getUTCDate(), oldest.getUTCDate()));
	const to = input.to ?? toAnalyticsDate(today);
	const end = new Date(`${to}T00:00:00Z`);
	const from = input.from ?? toAnalyticsDate(new Date(end.getTime() - 29 * 86_400_000));
	const start = new Date(`${from}T00:00:00Z`);

	if (start < oldest || start > end || end > today || !Number.isFinite(start.getTime() + end.getTime())) {
		throw new RangeError("Choose a valid date range within the last 13 months.");
	}

	const days = (end.getTime() - start.getTime()) / 86_400_000 + 1;
	const previousFrom = toAnalyticsDate(new Date(start.getTime() - days * 86_400_000));

	return {
		days,
		from,
		previousAvailable: previousFrom >= toAnalyticsDate(oldest),
		previousFrom,
		previousTo: toAnalyticsDate(new Date(start.getTime() - 86_400_000)),
		to,
	};
};
