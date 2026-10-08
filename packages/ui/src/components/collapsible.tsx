"use client";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import { cva } from "class-variance-authority";

import { cn } from "@starter/ui/lib/utils";

const collapsibleTriggerVariants = cva("cursor-pointer", {
	variants: {
		variant: {
			default: null,
			step: "gap-2 rounded-lg text-sm text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
		},
	},
});

const Collapsible = ({ ...props }: CollapsiblePrimitive.Root.Props) => {
	return <CollapsiblePrimitive.Root data-slot='collapsible' {...props} />;
};

const CollapsibleTrigger = ({
	className,
	variant = "default",
	...props
}: CollapsiblePrimitive.Trigger.Props & { variant?: "default" | "step" }) => {
	return (
		<CollapsiblePrimitive.Trigger
			className={cn(collapsibleTriggerVariants({ variant }), className)}
			data-slot='collapsible-trigger'
			{...props}
		/>
	);
};

const CollapsiblePanel = ({ className, ...props }: CollapsiblePrimitive.Panel.Props) => {
	return (
		<CollapsiblePrimitive.Panel
			className={cn(
				"h-(--collapsible-panel-height) animate-none overflow-hidden transition-[height_200ms_ease-out] data-ending-style:h-0 data-starting-style:h-0",
				className
			)}
			data-slot='collapsible-panel'
			{...props}
		/>
	);
};

export { Collapsible, CollapsibleTrigger, CollapsiblePanel, CollapsiblePanel as CollapsibleContent };
