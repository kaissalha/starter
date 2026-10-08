import { useCallback, useMemo } from "react";

import { functionalUpdate } from "@tanstack/react-table";
import type { PaginationState, SortingState, Updater } from "@tanstack/react-table";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { z } from "zod";

type UseDataTableStateOptions = {
	defaultColumnVisibility?: Record<string, boolean>;
	defaultFilters?: DataTableFilterState;
	defaultPageIndex?: number;
	defaultPageSize?: number;
	defaultSearch?: string;
	defaultSorting?: string;
};

export type DataTableFilterState = Record<string, Array<string>>;

const emptyColumnVisibility: Record<string, boolean> = {};

const emptyFilters: DataTableFilterState = {};

const filterStateSchema = z.record(z.string().max(100), z.array(z.string().max(100)).max(20));

const columnVisibilitySchema = z.record(z.string(), z.boolean());

const parseJson = <T>({ fallback, schema, value }: { fallback: T; schema: z.ZodType<T>; value: string }) => {
	try {
		return schema.parse(JSON.parse(value));
	} catch {
		return fallback;
	}
};

const normalizeFilters = (filters: DataTableFilterState) =>
	Object.fromEntries(
		Object.entries(filters)
			.map(([columnId, values]) => [columnId, [...new Set(values)].toSorted()] as const)
			.filter(([, values]) => values.length > 0)
			.toSorted(([left], [right]) => left.localeCompare(right))
	);

export const parseDataTableFilters = (value: string | undefined, fallback: DataTableFilterState = emptyFilters) =>
	normalizeFilters(value ? parseJson({ fallback, schema: filterStateSchema, value }) : fallback);

export const serializeDataTableFilters = (filters: DataTableFilterState) => {
	const normalized = normalizeFilters(filters);

	return Object.keys(normalized).length > 0 ? JSON.stringify(normalized) : "";
};

export const useDataTableState = ({
	defaultColumnVisibility = emptyColumnVisibility,
	defaultFilters = emptyFilters,
	defaultPageIndex = 0,
	defaultPageSize = 10,
	defaultSearch = "",
	defaultSorting = "",
}: UseDataTableStateOptions = {}) => {
	const [pageIndex, setPageIndex] = useQueryState("page", parseAsInteger.withDefault(defaultPageIndex));
	const [pageSize, setPageSize] = useQueryState("size", parseAsInteger.withDefault(defaultPageSize));
	const [sortingString, setSortingString] = useQueryState("sort", parseAsString.withDefault(defaultSorting));
	const [search, setSearch] = useQueryState("q", parseAsString.withDefault(defaultSearch));

	const [filtersString, setFiltersString] = useQueryState(
		"filters",
		parseAsString.withDefault(serializeDataTableFilters(defaultFilters))
	);

	const [columnVisibilityString, setColumnVisibilityString] = useQueryState(
		"visibility",
		parseAsString.withDefault(JSON.stringify(defaultColumnVisibility))
	);

	const sorting = useMemo<SortingState>(() => {
		if (!sortingString) {
			return [];
		}

		const [id, direction] = sortingString.split(":");

		return id ? [{ desc: direction === "desc", id }] : [];
	}, [sortingString]);

	const filters = useMemo(
		() => parseDataTableFilters(filtersString, defaultFilters),
		[defaultFilters, filtersString]
	);

	const columnVisibility = useMemo(
		() =>
			columnVisibilityString
				? parseJson({
						fallback: defaultColumnVisibility,
						schema: columnVisibilitySchema,
						value: columnVisibilityString,
					})
				: defaultColumnVisibility,
		[columnVisibilityString, defaultColumnVisibility]
	);

	const filterCount = useMemo(
		() => Object.values(filters).reduce((count, values) => count + values.length, 0),
		[filters]
	);

	const setFilters = useCallback(
		(nextFilters: DataTableFilterState) => {
			setFiltersString(serializeDataTableFilters(nextFilters));
			setPageIndex(defaultPageIndex);
		},
		[defaultPageIndex, setFiltersString, setPageIndex]
	);

	const updateFilters = useCallback(
		(update: (current: DataTableFilterState) => DataTableFilterState) => {
			setFiltersString((current) =>
				serializeDataTableFilters(update(parseDataTableFilters(current, defaultFilters)))
			);
			setPageIndex(defaultPageIndex);
		},
		[defaultFilters, defaultPageIndex, setFiltersString, setPageIndex]
	);

	const toggleFilter = useCallback(
		(columnId: string, value: string) => {
			updateFilters((current) => {
				const selected = new Set(current[columnId]);

				if (selected.has(value)) {
					selected.delete(value);
				} else {
					selected.add(value);
				}

				return { ...current, [columnId]: [...selected] };
			});
		},
		[updateFilters]
	);

	const clearFilter = useCallback(
		(columnId: string) => {
			updateFilters((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== columnId)));
		},
		[updateFilters]
	);

	const clearFilters = useCallback(() => setFilters(defaultFilters), [defaultFilters, setFilters]);

	const onPaginationChange = useCallback(
		(updater: Updater<PaginationState>) => {
			const nextState = functionalUpdate(updater, { pageIndex, pageSize });
			setPageIndex(nextState.pageIndex);
			setPageSize(nextState.pageSize);
		},
		[pageIndex, pageSize, setPageIndex, setPageSize]
	);

	const onSortingChange = useCallback(
		(updater: Updater<SortingState>) => {
			const nextState = functionalUpdate(updater, sorting);
			const firstSort = nextState[0];
			setSortingString(firstSort ? `${firstSort.id}:${firstSort.desc ? "desc" : "asc"}` : "");
			setPageIndex(defaultPageIndex);
		},
		[defaultPageIndex, setPageIndex, setSortingString, sorting]
	);

	const onColumnVisibilityChange = useCallback(
		(updater: Updater<Record<string, boolean>>) => {
			const nextState = functionalUpdate(updater, columnVisibility);
			setColumnVisibilityString(JSON.stringify(nextState));
		},
		[columnVisibility, setColumnVisibilityString]
	);

	return {
		columnVisibility: { columnVisibility, onColumnVisibilityChange },
		filters: {
			apiFilters: filters,
			clearFilter,
			clearFilters,
			filterCount,
			filters,
			toggleFilter,
		},
		pagination: { onPaginationChange, pageIndex, pageSize },
		search: { onSearchChange: setSearch, search },
		sorting: { onSortingChange, sorting },
	};
};
