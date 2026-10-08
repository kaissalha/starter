import { act, renderHook, waitFor } from "@testing-library/react";
import { withNuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import { parseDataTableFilters, serializeDataTableFilters, useDataTableState } from "@/hooks/use-data-table-state";

describe("data table filter state", () => {
	it("normalizes filter URLs and rejects invalid state", () => {
		expect(parseDataTableFilters('{"missing":["phone","email","phone"],"contactMethod":[]}')).toEqual({
			missing: ["email", "phone"],
		});
		expect(parseDataTableFilters('{"missing":"phone"}')).toEqual({});
		expect(serializeDataTableFilters({ contactMethod: [], missing: ["phone", "email", "phone"] })).toBe(
			'{"missing":["email","phone"]}'
		);
	});

	it("updates search without coupling it to filter state", async () => {
		const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();

		const { result } = renderHook(() => useDataTableState(), {
			wrapper: withNuqsTestingAdapter({ hasMemory: true, onUrlUpdate }),
		});

		act(() => {
			result.current.search.onSearchChange("Ada");
		});

		await waitFor(() => expect(result.current.search.search).toBe("Ada"));
		expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get("q")).toBe("Ada");
	});

	it("toggles URL-backed filters and resets pagination", async () => {
		const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();

		const { result } = renderHook(() => useDataTableState(), {
			wrapper: withNuqsTestingAdapter({ hasMemory: true, onUrlUpdate, searchParams: "?page=4" }),
		});

		act(() => result.current.filters.toggleFilter("contactMethod", "email"));

		await waitFor(() => expect(result.current.filters.apiFilters).toEqual({ contactMethod: ["email"] }));
		expect(result.current.filters.filterCount).toBe(1);
		expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get("page")).toBeNull();

		act(() => result.current.filters.clearFilters());

		await waitFor(() => expect(result.current.filters.apiFilters).toEqual({}));
		expect(result.current.filters.filterCount).toBe(0);
	});
});
