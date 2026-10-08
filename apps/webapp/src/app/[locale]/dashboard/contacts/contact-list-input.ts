import { z } from "zod";

import type { DataTableFilterState } from "@/hooks/use-data-table-state";
import { contactFieldFiltersSchema } from "@starter/server/contracts";

const sortKeys = ["createdAt", "email", "name", "phone"] as const;

export const contactTriageCategoryOptions = ["sales", "support", "booking", "feedback", "other", "unknown"] as const;

const contactFiltersSchema = contactFieldFiltersSchema.extend({
	spam: z
		.array(z.enum(["only"]))
		.max(1)
		.optional(),
	triageCategory: z.array(z.enum(contactTriageCategoryOptions)).max(6).optional(),
});

const toContactApiFilters = ({ spam, ...filters }: z.infer<typeof contactFiltersSchema>) =>
	spam?.length ? { ...filters, onlySpam: true } : filters;

export const defaultContactPageSize = 50;

export const defaultContactSorting = "createdAt:desc";

export const getContactListInput = ({
	cursor,
	filters,
	pageSize,
	search,
	sort,
}: {
	cursor: string | null;
	filters: DataTableFilterState;
	pageSize: number;
	search: string;
	sort: { desc: boolean; id: string } | undefined;
}) => {
	const parsedFilters = contactFiltersSchema.safeParse(filters);

	return {
		cursor,
		filters: parsedFilters.success ? toContactApiFilters(parsedFilters.data) : {},
		order: sort?.desc === false ? ("asc" as const) : ("desc" as const),
		pageSize,
		search,
		sort: sortKeys.find((key) => key === sort?.id) ?? "createdAt",
	};
};

export const parseContactFilters = (value: string | undefined): DataTableFilterState => {
	if (!value) {
		return {};
	}

	try {
		const filters: DataTableFilterState = {};

		for (const [id, values] of Object.entries(contactFiltersSchema.parse(JSON.parse(value)))) {
			if (values) {
				filters[id] = values;
			}
		}

		return filters;
	} catch {
		return {};
	}
};

export const parseContactSorting = (value: string | undefined) => {
	const [id, direction] = (value || defaultContactSorting).split(":");

	return id ? { desc: direction === "desc", id } : undefined;
};
