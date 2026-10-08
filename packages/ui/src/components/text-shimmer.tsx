import type { ComponentProps } from "react";

import { cva } from "class-variance-authority";

import { cn } from "@starter/ui/lib/utils";

const textShimmerVariants = cva("shimmer", {
	variants: {
		variant: {
			default: null,
			label: "font-medium",
			muted: "font-medium text-sm text-muted-foreground",
		},
	},
});

export const TextShimmer = ({
	className,
	variant = "default",
	...props
}: ComponentProps<"span"> & { variant?: "default" | "label" | "muted" }) => {
	return <span className={cn(textShimmerVariants({ variant }), className)} {...props} />;
};

TextShimmer.displayName = "TextShimmer";
