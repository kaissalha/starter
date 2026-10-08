"use client";

import { ArrowDown02Icon, ArrowUp02Icon, ArrowUpDownIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { flexRender, rowSortingFeature, tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef, RowData, SortingState, Updater } from "@tanstack/react-table";

import { cn } from "../lib/utils";
import { Button } from "./button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

const dataTableFeatures = tableFeatures({ rowSortingFeature });

export type DataTableColumnDef<TData extends RowData> = ColumnDef<typeof dataTableFeatures, TData>;

export type DataTableProps<TData extends RowData> = {
	columnClassNames?: Record<string, string>;
	columns: Array<DataTableColumnDef<TData>>;
	data: Array<TData>;
	getRowId: (row: TData) => string;
	onRowClick?: (row: TData) => void;
	onSortingChange?: (updater: Updater<SortingState>) => void;
	sorting?: SortingState;
};

const ariaSort = { asc: "ascending", desc: "descending" } as const;

const sortIcons = { asc: ArrowUp02Icon, desc: ArrowDown02Icon } as const;

export const DataTable = <TData extends RowData>({
	columnClassNames = {},
	columns,
	data,
	getRowId,
	onRowClick,
	onSortingChange,
	sorting = [],
}: DataTableProps<TData>) => {
	const table = useTable({
		columns,
		data,
		enableMultiSort: false,
		enableSorting: onSortingChange !== undefined,
		enableSortingRemoval: false,
		features: dataTableFeatures,
		getRowId,
		manualSorting: true,
		onSortingChange,
		state: { sorting },
	});

	return (
		<Table>
			<TableHeader className='sticky top-0 z-10 bg-background'>
				{table.getHeaderGroups().map((headerGroup) => (
					<TableRow className='h-11 hover:bg-transparent' key={headerGroup.id}>
						{headerGroup.headers.map((header) => {
							const sorted = header.column.getIsSorted();

							const label = header.isPlaceholder
								? null
								: flexRender(header.column.columnDef.header, header.getContext());

							return (
								<TableHead
									aria-sort={sorted ? ariaSort[sorted] : undefined}
									className={cn("font-normal", columnClassNames[header.column.id])}
									key={header.id}
									scope='col'
								>
									{header.column.getCanSort() ? (
										<Button
											className='group -mx-1.5 max-w-full'
											onClick={header.column.getToggleSortingHandler()}
											size='sm'
											type='button'
											variant='ghost'
										>
											<span className='truncate'>{label}</span>
											<HugeiconsIcon
												aria-hidden
												className={cn(
													"shrink-0 scale-110",
													!sorted &&
														"[@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
												)}
												icon={sorted ? sortIcons[sorted] : ArrowUpDownIcon}
												strokeWidth={1.75}
											/>
										</Button>
									) : (
										label
									)}
								</TableHead>
							);
						})}
					</TableRow>
				))}
			</TableHeader>
			<TableBody>
				{table.getRowModel().rows.map((row) => (
					<TableRow
						className={cn("h-12 border-border/50", onRowClick && "cursor-pointer outline-none")}
						key={row.id}
						onClick={onRowClick ? () => onRowClick(row.original) : undefined}
						onKeyDown={
							onRowClick
								? (event) => {
										if (
											event.target === event.currentTarget &&
											(event.key === "Enter" || event.key === " ")
										) {
											event.preventDefault();
											onRowClick(row.original);
										}
									}
								: undefined
						}
						tabIndex={onRowClick ? 0 : undefined}
					>
						{row.getAllCells().map((cell) => (
							<TableCell className={columnClassNames[cell.column.id]} key={cell.id}>
								{flexRender(cell.column.columnDef.cell, cell.getContext())}
							</TableCell>
						))}
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
};
