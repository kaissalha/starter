import type * as React from "react";

import { cva } from "class-variance-authority";

import { cn } from "@starter/ui/lib/utils";

const cardVariants = cva("flex flex-col rounded-sm border border-border bg-card text-card-foreground", {
	variants: {
		corners: { default: null, rounded: "rounded-xl" },
		variant: {
			attachment: "gap-2.5 p-2.5",
			dashed: "border-dashed",
			default: null,
			elevated: "border-0 bg-background/95 smooth-shadow-ring-xl",
			selectable: "overflow-hidden p-1 group-aria-pressed:border-primary group-aria-pressed:bg-primary",
		},
	},
});

const cardTitleVariants = cva("font-semibold", {
	variants: { size: { default: null, lg: "text-2xl tracking-tight" } },
});

const cardPanelVariants = cva("px-6 pb-6", { variants: { spacing: { default: "space-y-4", none: null } } });

const Card = ({
	className,
	corners = "default",
	variant = "default",
	...props
}: React.ComponentProps<"div"> & {
	corners?: "default" | "rounded";
	variant?: "default" | "selectable" | "dashed" | "elevated" | "attachment";
}) => {
	return <div className={cn(cardVariants({ corners, variant }), className)} data-slot='card' {...props} />;
};

const CardHeader = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			className={cn(
				"flex flex-col gap-1 p-6 has-data-[slot=card-action]:flex-row has-data-[slot=card-action]:items-start has-data-[slot=card-action]:justify-between has-data-[slot=card-action]:gap-4 [.border-b]:pb-6",
				className
			)}
			data-slot='card-header'
			{...props}
		/>
	);
};

const CardTitle = ({
	className,
	size = "default",
	...props
}: React.ComponentProps<"div"> & {
	size?: "default" | "lg";
}) => {
	return <div className={cn(cardTitleVariants({ size }), className)} data-slot='card-title' {...props} />;
};

const CardDescription = ({ className, ...props }: React.ComponentProps<"div">) => {
	return <div className={cn("text-sm text-muted-foreground", className)} data-slot='card-description' {...props} />;
};

const CardAction = ({ className, ...props }: React.ComponentProps<"div">) => {
	return <div className={cn("shrink-0", className)} data-slot='card-action' {...props} />;
};

const CardPanel = ({
	className,
	spacing = "none",
	...props
}: React.ComponentProps<"div"> & {
	spacing?: "none" | "default";
}) => {
	return <div className={cn(cardPanelVariants({ spacing }), className)} data-slot='card-content' {...props} />;
};

const CardFooter = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			className={cn("flex items-center justify-between gap-4 border-t border-border px-6 py-4", className)}
			data-slot='card-footer'
			{...props}
		/>
	);
};

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardPanel, CardPanel as CardContent };
