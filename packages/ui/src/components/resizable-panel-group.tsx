"use client";

import type * as React from "react";

import { DragDropVerticalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@starter/ui/lib/utils";

const ResizablePanelGroup = ({ className, ...props }: React.ComponentProps<typeof ResizablePrimitive.Group>) => {
	return (
		<ResizablePrimitive.Group
			className={cn("flex h-full w-full data-[panel-group-direction=vertical]:flex-col", className)}
			data-slot='resizable-panel-group'
			{...props}
		/>
	);
};

const ResizablePanel = ({ ...props }: React.ComponentProps<typeof ResizablePrimitive.Panel>) => {
	return <ResizablePrimitive.Panel data-slot='resizable-panel' {...props} />;
};

const ResizableSeparator = ({
	className,
	withHandle,
	...props
}: React.ComponentProps<typeof ResizablePrimitive.Separator> & {
	withHandle?: boolean;
}) => {
	return (
		<ResizablePrimitive.Separator
			className={cn(
				"outline-hidden bg-border relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:start-1/2 after:w-1 after:-translate-x-1/2 rtl:after:translate-x-1/2 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:start-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90",
				className
			)}
			data-slot='resizable-handle'
			{...props}
		>
			{withHandle && (
				<div className='rounded-xs bg-border z-10 flex h-4 w-3 items-center justify-center border'>
					<HugeiconsIcon
						aria-hidden='true'
						className='size-2.5 scale-110'
						icon={DragDropVerticalIcon}
						strokeWidth={1.75}
					/>
				</div>
			)}
		</ResizablePrimitive.Separator>
	);
};

export { ResizablePanelGroup, ResizablePanel, ResizableSeparator };
