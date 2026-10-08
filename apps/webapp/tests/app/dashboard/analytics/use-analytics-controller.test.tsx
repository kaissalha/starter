import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAnalyticsBreakdownPages } from "@/app/[locale]/dashboard/analytics/use-analytics-breakdown";
import { useAnalyticsController } from "@/app/[locale]/dashboard/analytics/use-analytics-controller";

type PageOptions = {
	getNextPageParam: (page: { hasMore: boolean }, pages: Array<{ hasMore: boolean }>) => number | undefined;
	input: (offset: number) => {
		dimension: string;
		domain: string;
		from: string;
		limit: number;
		offset: number;
		to: string;
	};
};

const mocks = vi.hoisted(() => ({ breakdown: vi.fn(() => ({})), infinite: vi.fn((options: PageOptions) => options) }));

vi.mock("@tanstack/react-query", () => ({ useInfiniteQuery: (options: PageOptions) => options, useQuery: () => ({}) }));

vi.mock("@/lib/api-client", () => ({
	apiClient: {
		analytics: Object.fromEntries(
			["overview", "breakdown", "realtime", "webVitals"].map((name) => [
				name,
				name === "breakdown"
					? { infiniteOptions: mocks.infinite, queryOptions: mocks.breakdown }
					: { queryOptions: () => ({}) },
			])
		),
	},
}));

afterEach(cleanup);

describe("analytics filters", () => {
	it("uses inclusive preset ranges across year boundaries and preserves report filters", () => {
		const { result } = renderHook(() => useAnalyticsController({ from: "2025-12-10", to: "2026-01-08" }));
		act(() => result.current.setSurface("website"));
		act(() => result.current.setDomain("example.com"));
		act(() => result.current.setLocale("ar"));
		act(() => result.current.setPeriod("90"));
		expect(result.current.filters).toEqual({
			domain: "example.com",
			from: "2025-10-11",
			locale: "ar",
			surface: "website",
			to: "2026-01-08",
		});
		expect(result.current).toMatchObject({ period: "90", validRange: true });
		act(() => result.current.setPeriod("yesterday"));
		expect(result.current.filters).toMatchObject({ from: "2026-01-07", to: "2026-01-07" });
		act(() => result.current.setPeriod("today"));
		expect(result.current.filters).toMatchObject({ from: "2026-01-08", to: "2026-01-08" });
		act(() => result.current.setDomain(null));
		expect(result.current.filters).toMatchObject({ domain: "", locale: "ar", surface: "website" });
	});

	it("lists website and language options without applying the current website or language filter", () => {
		renderHook(() => useAnalyticsController({ from: "2026-09-01", to: "2026-09-21" }));
		expect(mocks.breakdown).toHaveBeenCalledWith({
			input: { dimension: "domains", domain: "", from: "2026-09-01", limit: 20, locale: "", to: "2026-09-21" },
		});
	});

	it("keeps the applied dates while choosing a custom range and rejects dates outside retention", () => {
		const initial = { from: "2026-08-23", to: "2026-09-21" };
		const { result } = renderHook(() => useAnalyticsController(initial));
		act(() => result.current.setPeriod("custom"));
		act(() => result.current.setRange({ from: new Date(2026, 8, 1) }));
		expect(result.current.filters).toEqual(initial);
		act(() => result.current.setRange({ from: new Date(2026, 8, 1), to: new Date(2026, 8, 4) }));
		expect(result.current.filters).toMatchObject({ from: "2026-09-01", to: "2026-09-04" });
		expect(result.current.validRange).toBe(true);
		act(() => result.current.setRange({ from: new Date(2024, 8, 1), to: new Date(2026, 8, 4) }));
		expect(result.current.validRange).toBe(false);
		act(() => result.current.setPeriod("30"));
		expect(result.current.filters).toEqual(initial);
		expect(result.current.validRange).toBe(true);
	});
});

it("pages drawer breakdowns in fixed pages with the shared filters", () => {
	const filters = { domain: "example.com", from: "2026-09-01", to: "2026-09-21" };
	renderHook(() => useAnalyticsBreakdownPages({ dimension: "cities", filters }));
	const options = mocks.infinite.mock.calls.at(-1)?.[0];

	if (!options) {
		throw new Error("Missing infinite query options");
	}

	const { getNextPageParam, input } = options;
	expect(input(50)).toEqual({ ...filters, dimension: "cities", limit: 50, offset: 50 });
	expect(getNextPageParam({ hasMore: true }, [{ hasMore: true }, { hasMore: true }])).toBe(100);
	expect(getNextPageParam({ hasMore: false }, [{ hasMore: false }])).toBeUndefined();
});
