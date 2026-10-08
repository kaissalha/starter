"use client";

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { MinusSignIcon, Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { cn } from "@starter/ui/lib/utils";

const Accordion = (props: AccordionPrimitive.Root.Props) => {
	return <AccordionPrimitive.Root data-slot='accordion' {...props} />;
};

const AccordionItem = ({ className, ...props }: AccordionPrimitive.Item.Props) => {
	return <AccordionPrimitive.Item className={cn("border-b", className)} data-slot='accordion-item' {...props} />;
};

type AccordionSize = "default" | "lg";

const triggerSizes = {
	default: "py-4 text-sm",
	lg: "py-6 text-lg sm:text-xl",
} satisfies Record<AccordionSize, string>;

const panelSizes = {
	default: "text-sm",
	lg: "text-base leading-relaxed sm:text-lg",
} satisfies Record<AccordionSize, string>;

const panelBodySizes = {
	default: "pb-4",
	lg: "pb-6",
} satisfies Record<AccordionSize, string>;

type AccordionTriggerProps = AccordionPrimitive.Trigger.Props & {
	hideIcon?: boolean;
	size?: AccordionSize;
};

const AccordionTrigger = ({ children, className, hideIcon, size = "default", ...props }: AccordionTriggerProps) => {
	return (
		<AccordionPrimitive.Header className='flex'>
			<AccordionPrimitive.Trigger
				className={cn(
					"group flex flex-1 cursor-pointer items-center justify-between gap-4 rounded-md text-start font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-64",
					triggerSizes[size],
					className
				)}
				data-slot='accordion-trigger'
				{...props}
			>
				{children}
				{!hideIcon && (
					<span className='relative size-4 shrink-0'>
						<HugeiconsIcon
							aria-hidden='true'
							className='absolute inset-0 size-4 transition-opacity duration-200 group-data-panel-open:opacity-0 scale-110'
							icon={Add01Icon}
							strokeWidth={2.25}
						/>
						<HugeiconsIcon
							aria-hidden='true'
							className='absolute inset-0 size-4 opacity-0 transition-opacity duration-200 group-data-panel-open:opacity-100 scale-110'
							icon={MinusSignIcon}
							strokeWidth={2.25}
						/>
					</span>
				)}
			</AccordionPrimitive.Trigger>
		</AccordionPrimitive.Header>
	);
};

type AccordionPanelProps = AccordionPrimitive.Panel.Props & { size?: AccordionSize };

const AccordionPanel = ({ children, className, size = "default", ...props }: AccordionPanelProps) => {
	return (
		<AccordionPrimitive.Panel
			className={cn(
				"h-(--accordion-panel-height) animate-none overflow-hidden text-muted-foreground transition-[height_200ms_ease-in-out] data-ending-style:h-0 data-starting-style:h-0",
				panelSizes[size]
			)}
			data-slot='accordion-panel'
			{...props}
		>
			<div className={cn("pt-0", panelBodySizes[size], className)}>{children}</div>
		</AccordionPrimitive.Panel>
	);
};

export { Accordion, AccordionItem, AccordionTrigger, AccordionPanel, AccordionPanel as AccordionContent };
