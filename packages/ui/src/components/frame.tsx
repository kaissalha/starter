import type * as React from "react";

import { cva } from "class-variance-authority";

import { cn } from "@starter/ui/lib/utils";

const Frame = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			className={cn(
				"group relative flex flex-col rounded-[1.375rem] bg-muted/60 *:[[data-slot=frame-panel]+[data-slot=frame-panel]]:mt-1.5",
				className
			)}
			data-slot='frame'
			{...props}
		/>
	);
};

const framePanelVariants = cva("relative min-w-0 rounded-2xl border border-border bg-background bg-clip-padding", {
	variants: {
		elevation: {
			default:
				"smooth-shadow-xs before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:border-b before:border-black/4 dark:before:border-t dark:before:border-b-0 dark:before:border-white/6",
			flat: null,
		},
		padding: { default: "p-5", none: "p-0" },
		spacing: { default: "gap-4", none: null },
	},
});

const FramePanel = ({
	className,
	elevation = "default",
	padding = "default",
	spacing = "none",
	...props
}: React.ComponentProps<"div"> & {
	elevation?: "default" | "flat";
	padding?: "default" | "none";
	spacing?: "default" | "none";
}) => (
	<div
		className={cn(framePanelVariants({ elevation, padding, spacing }), className)}
		data-slot='frame-panel'
		{...props}
	/>
);

const frameHeaderVariants = cva("flex flex-col px-4 py-1.5", {
	variants: { layout: { default: null, row: "flex-row flex-wrap items-center gap-3" } },
});

const FrameHeader = ({
	className,
	layout = "default",
	...props
}: React.ComponentProps<"header"> & { layout?: "default" | "row" }) => (
	<header className={cn(frameHeaderVariants({ layout }), className)} data-slot='frame-panel-header' {...props} />
);

const FrameHeading = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div className={cn("flex min-w-0 items-center gap-2", className)} data-slot='frame-panel-heading' {...props} />
	);
};

const FrameIcon = ({ className, ...props }: React.ComponentProps<"span">) => {
	return (
		<span
			className={cn(
				"shrink-0 text-muted-foreground transition-colors duration-200 ease-out group-hover:text-foreground",
				className
			)}
			data-slot='frame-panel-icon'
			{...props}
		/>
	);
};

const FrameTitle = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			className={cn("text-[13px] font-medium text-muted-foreground", className)}
			data-slot='frame-panel-title'
			{...props}
		/>
	);
};

const FrameDescription = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			className={cn("text-sm text-muted-foreground", className)}
			data-slot='frame-panel-description'
			{...props}
		/>
	);
};

const FrameFooter = ({ className, ...props }: React.ComponentProps<"footer">) => {
	return <footer className={cn("px-5 py-4", className)} data-slot='frame-panel-footer' {...props} />;
};

export { Frame, FramePanel, FrameHeader, FrameHeading, FrameIcon, FrameTitle, FrameDescription, FrameFooter };
