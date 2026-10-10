"use client";

import * as React from "react";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { ScrollBar } from "@starter/ui/components/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@starter/ui/components/tooltip";
import { cn } from "@starter/ui/lib/utils";

import { useDocumentViewerLabels } from "./context";
import { composeRefs } from "./viewer-utils";

export function useDelayedLoadingIndicator(isLoading: boolean, delayMs = 300) {
	const [showSpinner, setShowSpinner] = React.useState(false);
	const [previousIsLoading, setPreviousIsLoading] = React.useState(isLoading);
	if (previousIsLoading !== isLoading) {
		setPreviousIsLoading(isLoading);
		setShowSpinner(false);
	}
	React.useEffect(() => {
		if (!isLoading) return;
		const timeoutId = window.setTimeout(() => {
			setShowSpinner(true);
		}, delayMs);
		return () => window.clearTimeout(timeoutId);
	}, [delayMs, isLoading]);
	return isLoading && showSpinner;
}

export function useElementWidth<TElement extends HTMLElement>() {
	const ref = React.useRef<TElement | null>(null);
	const [width, setWidth] = React.useState(0);
	React.useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return;
		const updateWidth = () => {
			const nextWidth = element.getBoundingClientRect().width;
			// Keep the last real measurement while the element is hidden or
			// detached (keep-alive preview pools, display:none ancestors): a
			// zero-width pass would re-lay-out the viewer for nothing, clearing
			// its rendered canvases, and force a blank-then-repaint flash when
			// the element comes back at its old size.
			if (nextWidth === 0) return;
			setWidth(nextWidth);
		};
		updateWidth();
		const observer = new ResizeObserver(updateWidth);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);
	return [ref, width] as const;
}

export function ViewerScrollArea({
	className,
	children,
	orientation = "both",
	scrollFade = false,
	scrollbarGutter = false,
	viewportClassName,
	viewportProps,
	viewportRef,
	...props
}: ScrollAreaPrimitive.Root.Props & {
	orientation?: "vertical" | "horizontal" | "both";
	scrollFade?: boolean;
	scrollbarGutter?: boolean;
	viewportClassName?: string;
	viewportProps?: ScrollAreaPrimitive.Viewport.Props;
	viewportRef?: React.Ref<HTMLDivElement>;
}) {
	const { className: viewportPropsClassName, ref: viewportPropsRef, ...resolvedViewportProps } = viewportProps ?? {};
	const composedViewportRef = React.useMemo(
		() => composeRefs(viewportPropsRef, viewportRef),
		[viewportPropsRef, viewportRef]
	);
	return (
		<ScrollAreaPrimitive.Root className={cn("size-full min-h-0", className)} {...props}>
			<ScrollAreaPrimitive.Viewport
				{...resolvedViewportProps}
				ref={composedViewportRef}
				className={cn(
					"h-full rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring",
					scrollFade &&
						"mask-t-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-start)))] mask-r-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-end)))] mask-b-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-end)))] mask-l-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-start)))] [--fade-size:1.5rem]",
					scrollbarGutter && orientation !== "vertical" && "pb-3.5",
					scrollbarGutter && orientation !== "horizontal" && "pe-3.5",
					viewportPropsClassName,
					viewportClassName
				)}
				data-slot='scroll-area-viewport'
			>
				{children}
			</ScrollAreaPrimitive.Viewport>
			{orientation !== "horizontal" ? <ScrollBar orientation='vertical' /> : null}
			{orientation !== "vertical" ? <ScrollBar orientation='horizontal' /> : null}
			{orientation === "both" ? <ScrollAreaPrimitive.Corner /> : null}
		</ScrollAreaPrimitive.Root>
	);
}

export function ViewerSpinner({ className }: { className?: string }) {
	const labels = useDocumentViewerLabels();
	return (
		<HugeiconsIcon
			icon={Loading03Icon}
			strokeWidth={1.75}
			role='status'
			aria-label={labels.loading}
			className={cn("size-4 animate-spin", className)}
		/>
	);
}

export function ToolbarTooltip({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<Tooltip>
			<TooltipTrigger render={<span className='inline-flex'>{children}</span>}></TooltipTrigger>
			<TooltipContent side='bottom'>{label}</TooltipContent>
		</Tooltip>
	);
}

export function ViewerLoadingSurface({ className, showSpinner = true }: { className?: string; showSpinner?: boolean }) {
	return (
		<div className={cn("grid h-full min-h-52 place-items-center bg-transparent", className)}>
			{showSpinner ? <ViewerSpinner /> : null}
		</div>
	);
}

export function DocumentViewerThumbnailSidebar({
	children,
	className,
	closedInlineClassName = "-ms-40",
	inline,
	open,
	widthClassName = "w-40",
}: {
	children: React.ReactNode;
	className?: string;
	closedInlineClassName?: string;
	inline: boolean;
	open: boolean;
	widthClassName?: string;
}) {
	const [transitionsReady, setTransitionsReady] = React.useState(false);
	const shouldAnimateSidebar = transitionsReady && open;
	React.useEffect(() => {
		let secondFrameId = 0;
		const firstFrameId = window.requestAnimationFrame(() => {
			secondFrameId = window.requestAnimationFrame(() => {
				setTransitionsReady(true);
			});
		});
		return () => {
			window.cancelAnimationFrame(firstFrameId);
			window.cancelAnimationFrame(secondFrameId);
		};
	}, []);
	return (
		<aside
			data-document-thumbnail-sidebar=''
			data-sidebar-mode={inline ? "inline" : "overlay"}
			data-sidebar-open={open ? "true" : "false"}
			className={cn(
				"absolute inset-y-0 start-0 z-30 shrink-0 overflow-hidden border-e bg-sidebar shadow-lg",
				widthClassName,
				shouldAnimateSidebar
					? "transition-[translate,margin-left,border-color] duration-200 ease-out"
					: "transition-none",
				inline && "relative z-auto translate-x-0 shadow-none",
				open
					? "ms-0 translate-x-0"
					: inline
						? cn("pointer-events-auto border-e-0", closedInlineClassName)
						: "pointer-events-none -translate-x-full border-e-0 rtl:translate-x-full",
				className
			)}
		>
			{children}
		</aside>
	);
}

export function DocumentViewerSidebarSkeleton({ className, inline }: { className?: string; inline: boolean }) {
	if (!inline) return null;
	return (
		<div className={cn("w-40 shrink-0 border-e bg-sidebar p-4", className)}>
			<div className='mx-auto h-28 w-20 overflow-hidden rounded-md bg-background shadow-xs'>
				<div className='h-full animate-pulse bg-muted' />
			</div>
			<div className='mx-auto mt-3 h-3 w-10 rounded-full bg-muted' />
		</div>
	);
}
