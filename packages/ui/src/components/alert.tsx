import type * as React from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@starter/ui/lib/utils";

const alertVariants = cva(
	"relative grid w-full items-start gap-x-2 rounded-xl border bg-card px-3 py-2.5 text-sm text-card-foreground has-data-[slot=alert-action]:grid-cols-[1fr_auto] has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-2 has-[>svg]:has-data-[slot=alert-action]:grid-cols-[calc(var(--spacing)*4)_1fr_auto] [&>svg]:size-4 [&>svg]:self-center",
	{
		defaultVariants: {
			variant: "default",
		},
		variants: {
			variant: {
				default: "[&>svg]:text-muted-foreground",
				error: "border-destructive/32 bg-destructive/4 [&>svg]:text-destructive",
				info: "border-info/32 bg-info/4 [&>svg]:text-info",
				success: "border-success/32 bg-success/4 [&>svg]:text-success",
				warning: "border-warning/32 bg-warning/4 [&>svg]:text-warning",
			},
		},
	}
);

const Alert = ({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) => {
	return <div className={cn(alertVariants({ variant }), className)} data-slot='alert' role='alert' {...props} />;
};

const AlertTitle = ({ className, ...props }: React.ComponentProps<"div">) => {
	return <div className={cn("font-medium [svg~&]:col-start-2", className)} data-slot='alert-title' {...props} />;
};

const AlertDescription = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			className={cn(
				"grid justify-items-start gap-1 text-sm text-muted-foreground *:[p]:leading-relaxed [svg~&]:col-start-2",
				className
			)}
			data-slot='alert-description'
			{...props}
		/>
	);
};

const AlertAction = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			className={cn(
				"flex gap-1 max-sm:col-start-2 max-sm:mt-2 sm:row-start-1 sm:row-end-3 sm:self-center sm:[[data-slot=alert-description]~&]:col-start-2 sm:[[data-slot=alert-title]~&]:col-start-2 sm:[svg~&]:col-start-2 sm:[svg~[data-slot=alert-description]~&]:col-start-3 sm:[svg~[data-slot=alert-title]~&]:col-start-3",
				className
			)}
			data-slot='alert-action'
			{...props}
		/>
	);
};

export { Alert, AlertTitle, AlertDescription, AlertAction };
