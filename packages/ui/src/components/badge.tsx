import type * as React from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

const badgeVariants = cva(
	"focus:outline-hidden max-w-fit rounded-full border text-xs font-semibold transition-colors",
	{
		defaultVariants: {
			size: "default",
			variant: "default",
		},
		variants: {
			size: {
				default: "px-2 py-px",
				lg: "px-3 py-1 text-sm",
				sm: "px-2.5 py-1",
				xl: "px-4 py-1.5 text-base",
			},
			variant: {
				critical: "border-transparent bg-destructive/10 text-destructive",
				dark: "border-transparent bg-foreground/55 text-background",
				default: "border-transparent bg-muted text-muted-foreground",
				destructive: "border-transparent bg-destructive/10 text-muted-foreground",
				optimal: "border-transparent bg-success/20 text-success-foreground",
				outline: "text-muted-foreground",
				secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
				suboptimal: "border-transparent bg-warning/20 text-warning-foreground",
				success: "border-transparent bg-success/20 text-muted-foreground",
				warning: "border-transparent bg-warning/20 text-muted-foreground",
			},
		},
	}
);

export type BadgeProps = {} & React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>;

const Badge = ({ className, size, variant, ...props }: BadgeProps) => {
	return <div className={cn(badgeVariants({ size, variant }), className)} {...props} />;
};

export { Badge, badgeVariants };
