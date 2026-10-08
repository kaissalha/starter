"use client";

import { Toolbar as ToolbarPrimitive } from "@base-ui/react/toolbar";

import { cn } from "@starter/ui/lib/utils";

const Toolbar = ({ className, ...props }: ToolbarPrimitive.Root.Props) => {
	return (
		<ToolbarPrimitive.Root
			className={cn(
				"relative flex gap-2 rounded-xl border bg-card bg-clip-padding p-1 text-card-foreground",
				className
			)}
			data-slot='toolbar'
			{...props}
		/>
	);
};

const ToolbarButton = ({ className, ...props }: ToolbarPrimitive.Button.Props) => {
	return <ToolbarPrimitive.Button className={cn(className)} data-slot='toolbar-button' {...props} />;
};

const ToolbarLink = ({ className, ...props }: ToolbarPrimitive.Link.Props) => {
	return <ToolbarPrimitive.Link className={cn(className)} data-slot='toolbar-link' {...props} />;
};

const ToolbarInput = ({ className, ...props }: ToolbarPrimitive.Input.Props) => {
	return <ToolbarPrimitive.Input className={cn(className)} data-slot='toolbar-input' {...props} />;
};

const ToolbarGroup = ({ className, ...props }: ToolbarPrimitive.Group.Props) => {
	return (
		<ToolbarPrimitive.Group
			className={cn("flex items-center gap-1", className)}
			data-slot='toolbar-group'
			{...props}
		/>
	);
};

const ToolbarSeparator = ({ className, ...props }: ToolbarPrimitive.Separator.Props) => {
	return (
		<ToolbarPrimitive.Separator
			className={cn(
				"shrink-0 bg-border data-[orientation=horizontal]:my-0.5 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:my-1.5 data-[orientation=vertical]:w-px data-[orientation=vertical]:not-[[class^='h-']]:not-[[class*='_h-']]:self-stretch",
				className
			)}
			data-slot='toolbar-separator'
			{...props}
		/>
	);
};

export { Toolbar, ToolbarGroup, ToolbarSeparator, ToolbarButton, ToolbarLink, ToolbarInput };
