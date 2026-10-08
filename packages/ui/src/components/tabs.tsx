"use client";

import * as React from "react";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

const tabsListVariants = cva("", {
	variants: { surface: { default: null, panel: "gap-4 bg-muted/30 px-6 md:gap-4 md:px-14" } },
});

const tabsContentVariants = cva("outline-hidden gap-3", {
	variants: {
		animated: { true: "animate-fade-in-only motion-reduce:animate-none" },
		padding: { none: null, panel: "px-6 py-6 sm:px-14" },
	},
});

const tabsVariants = cva("", {
	variants: { spacing: { default: "gap-3", none: "gap-0" } },
});

const Tabs = ({
	className,
	spacing = "default",
	...props
}: React.ComponentProps<typeof TabsPrimitive.Root> & VariantProps<typeof tabsVariants>) => (
	<TabsPrimitive.Root className={cn(tabsVariants({ spacing }), className)} {...props} />
);

const TabContext = React.createContext<{
	size?: "sm" | "md" | "lg" | null;
	variant?: "tab" | "toggle" | null;
}>({});

const tabListVariants = cva("items-center", {
	defaultVariants: {
		size: "md",
		variant: "tab",
	},
	variants: {
		size: {
			lg: "",
			md: "",
			sm: "",
		},
		variant: {
			tab: "no-scrollbar relative flex w-full flex-nowrap gap-5 md:gap-7 overflow-x-auto px-5 after:absolute after:bottom-0 after:start-0 after:h-0.25 after:w-full after:bg-border",
			toggle: "grid w-auto auto-cols-auto grid-flow-col rounded-xl bg-muted p-1",
		},
	},
});

const TabsList = ({
	className,
	ref,
	size = "md",
	surface = "default",
	variant,
	...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
	VariantProps<typeof tabListVariants> & { surface?: "default" | "panel" }) => (
	<TabContext.Provider value={{ size, variant }}>
		<TabsPrimitive.List
			activateOnFocus
			className={cn(tabListVariants({ size, variant }), tabsListVariants({ surface }), className)}
			ref={ref}
			{...props}
		/>
	</TabContext.Provider>
);

const tabTriggerVariants = cva(
	"outline-hidden inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium text-muted-foreground ring-offset-background transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50 data-active:border-foreground data-active:text-foreground",
	{
		compoundVariants: [
			{ className: "px-2 py-1", size: "sm", variant: "toggle" },
			{ className: "px-3 py-1.5", size: "md", variant: "toggle" },
			{ className: "px-4 py-2", size: "lg", variant: "toggle" },
			{ className: "border-b-2 py-4 font-semibold sm:py-3", size: "lg", variant: "tab" },
		],
		defaultVariants: {
			size: "md",
			variant: "tab",
		},
		variants: {
			size: { lg: "", md: "", sm: "" },
			variant: {
				tab: "relative z-10 border-b border-transparent pb-3",
				toggle: "rounded-lg data-active:bg-background [&_svg:not([class*='size-'])]:size-5 [&_svg]:shrink-0",
			},
		},
	}
);

const TabsTrigger = ({
	className,
	ref,
	size,
	variant,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Tab> & VariantProps<typeof tabTriggerVariants>) => {
	const context = React.useContext(TabContext);

	return (
		<TabsPrimitive.Tab
			className={cn(
				tabTriggerVariants({
					size: size || context.size,
					variant: variant || context.variant,
				}),
				className
			)}
			ref={ref}
			{...props}
		/>
	);
};

const TabsContent = ({
	animated = false,
	className,
	padding = "none",
	ref,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Panel> & {
	animated?: boolean;
	padding?: "none" | "panel";
}) => (
	<TabsPrimitive.Panel className={cn(tabsContentVariants({ animated, padding }), className)} ref={ref} {...props} />
);

export { Tabs, TabsList, TabsTrigger, TabsContent };
