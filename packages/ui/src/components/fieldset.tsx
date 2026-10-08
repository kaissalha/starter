"use client";

import { Fieldset as FieldsetPrimitive } from "@base-ui/react/fieldset";
import { cva } from "class-variance-authority";

import { cn } from "@starter/ui/lib/utils";

const fieldsetVariants = cva("flex w-full max-w-64 flex-col gap-6", {
	variants: { size: { compact: "max-w-none gap-4", default: null } },
});

const Fieldset = ({
	className,
	size = "default",
	...props
}: FieldsetPrimitive.Root.Props & { size?: "default" | "compact" }) => {
	return (
		<FieldsetPrimitive.Root className={cn(fieldsetVariants({ size }), className)} data-slot='fieldset' {...props} />
	);
};

const FieldsetLegend = ({ className, ...props }: FieldsetPrimitive.Legend.Props) => {
	return (
		<FieldsetPrimitive.Legend className={cn("font-semibold", className)} data-slot='fieldset-legend' {...props} />
	);
};

export { Fieldset, FieldsetLegend };
