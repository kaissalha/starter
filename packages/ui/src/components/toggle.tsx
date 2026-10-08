"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@starter/ui/lib/utils";

const toggleVariants = cva(
	"relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border text-sm font-medium text-muted-foreground whitespace-nowrap transition-shadow outline-none select-none hover:bg-accent/50 disabled:pointer-events-none disabled:opacity-64 data-pressed:bg-accent data-pressed:text-accent-foreground data-pressed:transition-none dark:hover:bg-accent dark:data-pressed:bg-input/80 pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		defaultVariants: {
			size: "default",
			variant: "default",
		},
		variants: {
			size: {
				default: "h-8 min-w-8 px-[calc(--spacing(2)-1px)]",
				lg: "h-9 min-w-9 px-[calc(--spacing(2.5)-1px)]",
				sm: "h-7 min-w-7 px-[calc(--spacing(1.5)-1px)]",
				xl: "h-10 min-w-14 px-[calc(--spacing(4)-1px)] text-base",
			},
			variant: {
				default: "border",
				outline:
					"border-border bg-clip-padding smooth-shadow-xs dark:bg-input/32 dark:hover:bg-input/64 [:disabled,:active,[data-pressed]]:smooth-shadow-none",
			},
		},
	}
);

const Toggle = ({
	className,
	size,
	variant,
	...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) => {
	return (
		<TogglePrimitive className={cn(toggleVariants({ className, size, variant }))} data-slot='toggle' {...props} />
	);
};

export { Toggle, toggleVariants };
