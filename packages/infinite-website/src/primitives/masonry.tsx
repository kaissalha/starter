"use client";

import {
	Children,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type ReactElement,
	type ReactNode,
} from "react";

import { z } from "zod";

import type { Layout, Length, Responsive } from "../document/structure-schema";
import { layoutStyle, lengthToCss } from "./layout";

const valueAtWidth = <T,>(value: Responsive<T>, width: number) => {
	const responsiveValue = z
		.strictObject({
			base: z.custom<T>(),
			compact: z.custom<T>().optional(),
			medium: z.custom<T>().optional(),
			wide: z.custom<T>().optional(),
		})
		.safeParse(value);

	if (!responsiveValue.success) {
		return z.custom<T>().parse(value);
	}

	if (width >= 1024 && responsiveValue.data.wide !== undefined) {
		return responsiveValue.data.wide;
	}

	if (width >= 672 && responsiveValue.data.medium !== undefined) {
		return responsiveValue.data.medium;
	}

	if (width >= 640 && responsiveValue.data.compact !== undefined) {
		return responsiveValue.data.compact;
	}

	return responsiveValue.data.base;
};

const packByShortestColumn = ({
	columnsCount,
	gutterPx,
	heights,
}: {
	columnsCount: number;
	gutterPx: number;
	heights: Array<number>;
}) => {
	const columns: Array<Array<number>> = Array.from({ length: columnsCount }, () => []);
	const columnHeights = Array.from({ length: columnsCount }, () => 0);

	heights.forEach((height, index) => {
		const shortest = columnHeights.reduce(
			(shortestIndex, columnHeight, columnIndex) =>
				columnHeight < columnHeights[shortestIndex]! ? columnIndex : shortestIndex,
			0
		);

		const gutter = columns[shortest]!.length > 0 ? gutterPx : 0;
		columns[shortest]!.push(index);
		columnHeights[shortest]! += height + gutter;
	});

	return columns;
};

const equalCountColumns = ({ columnsCount, count }: { columnsCount: number; count: number }) =>
	Array.from({ length: columnsCount }, (_, column) =>
		Array.from({ length: count }, (_, index) => index).filter((index) => index % columnsCount === column)
	);

const sameBuckets = (left: Array<Array<number>>, right: Array<Array<number>>) =>
	left.length === right.length &&
	left.every(
		(column, columnIndex) =>
			column.length === right[columnIndex]!.length &&
			column.every((itemIndex, index) => itemIndex === right[columnIndex]![index])
	);

export const Masonry = ({
	children,
	columns,
	gap = "1.5rem",
	layout,
}: {
	children: Array<ReactNode>;
	columns: Responsive<number>;
	gap?: Responsive<Length>;
	layout?: Layout;
}) => {
	const rootRef = useRef<HTMLDivElement>(null);
	const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
	const [activeColumns, setActiveColumns] = useState(1);
	const [activeGap, setActiveGap] = useState<Length>("1.5rem");

	const [measuredLayout, setMeasuredLayout] = useState<{
		buckets: Array<Array<number>>;
		columnsCount: number;
		itemCount: number;
	} | null>(null);

	const items = useMemo(
		() =>
			Children.toArray(children).filter((child): child is ReactElement => {
				return child !== null && child !== undefined;
			}),
		[children]
	);

	useEffect(() => {
		const root = rootRef.current;

		if (!root) {
			return;
		}

		const update = (width: number) => {
			setActiveColumns(Math.max(1, valueAtWidth(columns, width)));
			setActiveGap(valueAtWidth(gap, width));
		};

		update(root.getBoundingClientRect().width);

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];

			if (entry) {
				update(entry.contentRect.width);
			}
		});

		observer.observe(root);

		return () => observer.disconnect();
	}, [columns, gap]);

	useLayoutEffect(() => {
		const root = rootRef.current;

		const redistribute = () => {
			const heights = items.map((_, index) => itemRefs.current[index]?.getBoundingClientRect().height ?? 0);

			if (heights.some((height) => height <= 0)) {
				return;
			}

			const gutterPx = root ? Number.parseFloat(getComputedStyle(root).gap) || 0 : 0;
			const next = packByShortestColumn({ columnsCount: activeColumns, gutterPx, heights });

			setMeasuredLayout((previous) => {
				if (
					previous?.columnsCount === activeColumns &&
					previous.itemCount === items.length &&
					sameBuckets(previous.buckets, next)
				) {
					return previous;
				}

				return { buckets: next, columnsCount: activeColumns, itemCount: items.length };
			});
		};

		const observer = new ResizeObserver(redistribute);

		if (root && items.length > 0) {
			redistribute();
			observer.observe(root);
		}

		return () => observer.disconnect();
	}, [activeColumns, activeGap, items]);

	const columnsToRender =
		measuredLayout?.columnsCount === activeColumns && measuredLayout.itemCount === items.length
			? measuredLayout.buckets
			: equalCountColumns({ columnsCount: activeColumns, count: items.length });

	const gutter = lengthToCss(activeGap);

	return (
		<div
			className='iw-layout'
			ref={rootRef}
			style={{
				...layoutStyle(layout),
				"--iw-default-display": "flex",
				alignItems: "start",
				flexDirection: "row",
				gap: gutter,
			}}
		>
			{columnsToRender.map((column, columnIndex) => (
				<div className='flex w-0 flex-1 flex-col' key={`column-${columnIndex}`} style={{ gap: gutter }}>
					{column.map((itemIndex) => {
						const child = items[itemIndex];

						if (!child) {
							return null;
						}

						return (
							<div
								key={child.key ?? `item-${itemIndex}`}
								ref={(node) => {
									itemRefs.current[itemIndex] = node;
								}}
							>
								{child}
							</div>
						);
					})}
				</div>
			))}
		</div>
	);
};
