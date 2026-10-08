"use client";

import { useEffect, useRef } from "react";
import type { ComponentProps } from "react";

import type { RowData } from "@tanstack/react-table";

import { DataTable } from "@starter/ui/components/data-table";
import { Skeleton } from "@starter/ui/components/skeleton";

type InfiniteDataTableProps<TData extends RowData> = ComponentProps<typeof DataTable<TData>> & {
	hasNextPage?: boolean;
	isFetchingNextPage?: boolean;
	loadingLabel: string;
	loadMore: () => void;
};

export const InfiniteDataTable = <TData extends RowData>({
	hasNextPage = false,
	isFetchingNextPage = false,
	loadingLabel,
	loadMore,
	...dataTableProps
}: InfiniteDataTableProps<TData>) => {
	const sentinelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const sentinel = sentinelRef.current;

		if (!sentinel || !hasNextPage || isFetchingNextPage) {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					loadMore();
				}
			},
			{ rootMargin: "0px 0px 500px 0px" }
		);

		observer.observe(sentinel);

		return () => observer.disconnect();
	}, [hasNextPage, isFetchingNextPage, loadMore]);

	return (
		<>
			<DataTable {...dataTableProps} />
			{hasNextPage && (
				<div className='space-y-3 p-5' ref={sentinelRef}>
					<Skeleton aria-label={loadingLabel} className='h-9 w-full' role='status' />
				</div>
			)}
		</>
	);
};
