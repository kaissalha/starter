"use client";

import { Children, type CSSProperties, memo, useLayoutEffect, useRef } from "react";

import { cn } from "@starter/ui/lib/utils";

type MasonryProps = {
	children: React.ReactNode;

	className?: string;

	gap?: number;

	minColumnWidth?: number;
};

const Masonry = memo(({ children, className, gap = 16, minColumnWidth = 320 }: MasonryProps) => {
	const containerRef = useRef<HTMLDivElement | null>(null);

	useLayoutEffect(() => {
		const container = containerRef.current;

		if (!container) {
			return;
		}

		const items = container.querySelectorAll<HTMLElement>(":scope > [data-masonry-item]");

		const resizeItems = () => {
			const heights = Array.from(items, (item) => item.getBoundingClientRect().height);
			items.forEach((item, index) => {
				item.style.gridRowEnd = `span ${Math.max(1, Math.ceil(heights[index]!))}`;
			});
		};

		const animationFrame = { value: 0 };

		const observer = new ResizeObserver(() => {
			cancelAnimationFrame(animationFrame.value);
			animationFrame.value = requestAnimationFrame(resizeItems);
		});

		observer.observe(container);
		items.forEach((item) => observer.observe(item));
		resizeItems();

		return () => {
			observer.disconnect();
			cancelAnimationFrame(animationFrame.value);
		};
	}, [children]);

	const style: CSSProperties & { "--masonry-column-width": string; "--masonry-gap": string } = {
		"--masonry-column-width": `${minColumnWidth}px`,
		"--masonry-gap": `${gap}px`,
	};

	return (
		<div
			className={cn(
				"grid min-w-0 auto-rows-[1px] grid-flow-dense grid-cols-[repeat(auto-fit,minmax(min(var(--masonry-column-width),100%),1fr))] items-start gap-x-(--masonry-gap)",
				className
			)}
			ref={containerRef}
			style={style}
		>
			{Children.map(children, (child) =>
				child !== null && child !== undefined ? (
					<div className='min-w-0 pb-(--masonry-gap)' data-masonry-item>
						{child}
					</div>
				) : null
			)}
		</div>
	);
});

Masonry.displayName = "Masonry";

export { Masonry };
