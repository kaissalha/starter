import type * as React from "react";

import { cva } from "class-variance-authority";

import { cn } from "@starter/ui/lib/utils";

const labelVariants = cva("inline-flex items-center gap-2 text-sm/4", {
	variants: {
		variant: {
			default: null,
			option: "min-h-10 w-full cursor-pointer rounded-lg px-2 transition-colors [@media(hover:hover)]:hover:bg-accent/50",
		},
	},
});

const Label = ({
	className,
	variant = "default",
	...props
}: React.ComponentProps<"label"> & { variant?: "default" | "option" }) => {
	return <label className={cn(labelVariants({ variant }), className)} data-slot='label' {...props} />;
};

export { Label };
