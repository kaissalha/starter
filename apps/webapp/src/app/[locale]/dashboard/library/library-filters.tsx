"use client";

import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";

import { FiltersPopover } from "@/components/filters-popover";
import { Label } from "@starter/ui/components/label";
import { Radio, RadioGroup } from "@starter/ui/components/radio-group";

import { librarySearchParams, librarySorts, librarySources, libraryVersionModes } from "./library-search-params";

export const LibraryFilters = () => {
	const t = useTranslations("library");
	const [params, setParams] = useQueryStates(librarySearchParams);

	const filterCount =
		Number(params.source !== "all") + Number(params.sort !== "newest") + Number(params.versions !== "latest");

	const groups = [
		{
			id: "source",
			label: t("source"),
			onChange: (value: string) =>
				setParams({ source: librarySources.find((source) => source === value) ?? "all" }),
			options: librarySources.map((value) => ({ label: t(`sources.${value}`), value })),
			value: params.source,
		},
		{
			id: "versions",
			label: t("versions"),
			onChange: (value: string) =>
				setParams({ versions: libraryVersionModes.find((mode) => mode === value) ?? "latest" }),
			options: libraryVersionModes.map((value) => ({ label: t(`versionModes.${value}`), value })),
			value: params.versions,
		},
		{
			id: "sort",
			label: t("sort"),
			onChange: (value: string) => setParams({ sort: librarySorts.find((sort) => sort === value) ?? "newest" }),
			options: librarySorts.map((value) => ({ label: t(`sorts.${value}`), value })),
			value: params.sort,
		},
	];

	return (
		<FiltersPopover
			clearLabel={t("clearFilters")}
			count={filterCount}
			groups={groups.map((group) => ({
				content: (
					<RadioGroup
						aria-label={group.label}
						onValueChange={(value) => group.onChange(String(value))}
						value={group.value}
					>
						{group.options.map((option) => (
							<Label key={option.value} variant='option'>
								<Radio value={option.value} />
								<span>{option.label}</span>
							</Label>
						))}
					</RadioGroup>
				),
				id: group.id,
				label: group.label,
			}))}
			label={t("filters")}
			onClear={() => setParams({ sort: "newest", source: "all", versions: "latest" })}
			title={t("filters")}
			triggerLabel={t("filtersLabel", { count: filterCount })}
		/>
	);
};
