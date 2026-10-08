"use client";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { cva } from "class-variance-authority";

import { cn } from "@starter/ui/lib/utils";

const scrollAreaViewportVariants = cva(
	"h-full touch-pan-x touch-pan-y overscroll-contain rounded-[inherit] outline-none transition-shadows",
	{
		variants: {
			scrollbarGutter: { true: "data-has-overflow-y:pe-2.5 data-has-overflow-x:pb-2.5" },
			scrollFade: {
				true: "mask-t-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-start)))] mask-b-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-end)))] mask-l-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-start)))] mask-r-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-end)))] [--fade-size:1.5rem]",
			},
		},
	}
);

const scrollAreaVariants = cva("size-full min-h-0", {
	variants: { corners: { default: null, inherit: "rounded-[inherit]", sm: "rounded-sm" } },
});

export const ScrollArea = ({
	children,
	className,
	corners = "default",
	scrollbarGutter = false,
	scrollFade = false,
	viewportClassName,
	...props
}: ScrollAreaPrimitive.Root.Props & {
	corners?: "default" | "sm" | "inherit";
	scrollbarGutter?: boolean;
	scrollFade?: boolean;
	viewportClassName?: string;
}) => {
	return (
		<ScrollAreaPrimitive.Root className={cn(scrollAreaVariants({ corners }), className)} {...props}>
			<ScrollAreaPrimitive.Viewport
				className={cn(scrollAreaViewportVariants({ scrollbarGutter, scrollFade }), viewportClassName)}
				data-slot='scroll-area-viewport'
			>
				{children}
			</ScrollAreaPrimitive.Viewport>
			<ScrollBar orientation='vertical' />
			<ScrollBar orientation='horizontal' />
			<ScrollAreaPrimitive.Corner data-slot='scroll-area-corner' />
		</ScrollAreaPrimitive.Root>
	);
};

export const ScrollBar = ({ className, orientation = "vertical", ...props }: ScrollAreaPrimitive.Scrollbar.Props) => {
	return (
		<ScrollAreaPrimitive.Scrollbar
			className={cn(
				"m-1 flex opacity-0 transition-opacity delay-300 data-[orientation=horizontal]:h-1.5 data-[orientation=vertical]:w-1.5 data-[orientation=horizontal]:flex-col data-hovering:opacity-100 data-scrolling:opacity-100 data-hovering:delay-0 data-scrolling:delay-0 data-hovering:duration-100 data-scrolling:duration-100",
				className
			)}
			data-slot='scroll-area-scrollbar'
			orientation={orientation}
			{...props}
		>
			<ScrollAreaPrimitive.Thumb
				className='relative flex-1 rounded-full bg-foreground/20'
				data-slot='scroll-area-thumb'
			/>
		</ScrollAreaPrimitive.Scrollbar>
	);
};
