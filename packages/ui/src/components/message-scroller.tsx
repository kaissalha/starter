"use client";

import type * as React from "react";

import { ArrowDown02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	MessageScroller as MessageScrollerPrimitive,
	useMessageScroller,
	useMessageScrollerScrollable,
	useMessageScrollerVisibility,
} from "@shadcn/react/message-scroller";

import { cn } from "../lib/utils";
import { Button } from "./button";

const MessageScrollerProvider = (props: React.ComponentProps<typeof MessageScrollerPrimitive.Provider>) => (
	<MessageScrollerPrimitive.Provider {...props} />
);

const MessageScroller = ({ className, ...props }: React.ComponentProps<typeof MessageScrollerPrimitive.Root>) => (
	<MessageScrollerPrimitive.Root
		className={cn("group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden", className)}
		data-slot='message-scroller'
		{...props}
	/>
);

const MessageScrollerViewport = ({
	className,
	...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>) => (
	<MessageScrollerPrimitive.Viewport
		className={cn(
			"size-full min-h-0 min-w-0 mask-t-from-[calc(100%-1.5rem)] mask-b-from-[calc(100%-1.5rem)] overflow-y-auto overscroll-contain contain-content no-scrollbar data-pending-scroll:invisible",
			className
		)}
		data-slot='message-scroller-viewport'
		{...props}
	/>
);

const MessageScrollerContent = ({
	className,
	...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Content>) => (
	<MessageScrollerPrimitive.Content
		className={cn("flex h-max min-h-full flex-col gap-2 px-5 pt-5 pb-8 md:px-6", className)}
		data-slot='message-scroller-content'
		{...props}
	/>
);

const MessageScrollerItem = ({
	className,
	scrollAnchor = false,
	...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Item>) => (
	<MessageScrollerPrimitive.Item
		className={cn("min-w-0 shrink-0 [contain-intrinsic-size:auto_10rem] [content-visibility:auto]", className)}
		data-slot='message-scroller-item'
		scrollAnchor={scrollAnchor}
		{...props}
	/>
);

const MessageScrollerButton = ({
	children,
	className,
	direction = "end",
	label,
	...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Button> & { label: string }) => (
	<MessageScrollerPrimitive.Button
		className={cn(
			"absolute start-1/2 -translate-x-1/2 transition-[translate,scale,opacity] duration-200 data-[active=false]:pointer-events-none data-[active=false]:scale-95 data-[active=false]:opacity-0 data-[active=true]:translate-y-0 data-[active=true]:scale-100 data-[active=true]:opacity-100 data-[direction=end]:bottom-3 data-[direction=end]:data-[active=false]:translate-y-full data-[direction=start]:top-3 data-[direction=start]:data-[active=false]:-translate-y-full motion-reduce:transition-none rtl:translate-x-1/2 data-[direction=start]:[&_svg]:rotate-180",
			className
		)}
		data-direction={direction}
		data-slot='message-scroller-button'
		direction={direction}
		render={<Button aria-label={label} size='icon-sm' variant='outline' />}
		{...props}
	>
		{children ?? <HugeiconsIcon aria-hidden className='scale-110' icon={ArrowDown02Icon} strokeWidth={1.75} />}
	</MessageScrollerPrimitive.Button>
);

export {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
	useMessageScroller,
	useMessageScrollerScrollable,
	useMessageScrollerVisibility,
};
