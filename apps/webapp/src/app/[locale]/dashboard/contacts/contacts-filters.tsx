"use client";

import { useTranslations } from "next-intl";

import { FiltersPopover } from "@/components/filters-popover";
import type { DataTableFilterState } from "@/hooks/use-data-table-state";
import { Checkbox } from "@starter/ui/components/checkbox";
import { Label } from "@starter/ui/components/label";

import { contactTriageCategoryOptions } from "./contact-list-input";

type ContactsFiltersProps = {
	filterCount: number;
	filters: DataTableFilterState;
	onClear: () => void;
	onToggle: (filterId: string, value: string) => void;
};

export const ContactsFilters = ({ filterCount, filters, onClear, onToggle }: ContactsFiltersProps) => {
	const t = useTranslations("contacts");

	const groups = [
		{
			id: "contactMethod",
			label: t("filters.contactMethod"),
			options: [
				{ label: t("email"), value: "email" },
				{ label: t("phone"), value: "phone" },
			],
		},
		{
			id: "missing",
			label: t("filters.missing"),
			options: [
				{ label: t("name"), value: "name" },
				{ label: t("email"), value: "email" },
				{ label: t("phone"), value: "phone" },
			],
		},
		{
			id: "triageCategory",
			label: t("filters.triageCategory"),
			options: contactTriageCategoryOptions.map((value) => ({ label: t(`triageCategories.${value}`), value })),
		},
		{
			id: "spam",
			label: t("filters.spam"),
			options: [{ label: t("filters.onlySpam"), value: "only" }],
		},
	];

	return (
		<FiltersPopover
			clearLabel={t("filters.clear")}
			count={filterCount}
			description={t("filters.description")}
			groups={groups.map((group) => ({
				content: group.options.map((option) => (
					<Label key={option.value} variant='option'>
						<Checkbox
							checked={filters[group.id]?.includes(option.value) ?? false}
							onCheckedChange={() => onToggle(group.id, option.value)}
						/>
						<span>{option.label}</span>
					</Label>
				)),
				id: group.id,
				label: group.label,
			}))}
			label={t("filters.trigger")}
			onClear={onClear}
			title={t("filters.title")}
			triggerLabel={t("filters.triggerLabel", { count: filterCount })}
		/>
	);
};
