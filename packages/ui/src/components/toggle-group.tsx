"use client";

import * as React from "react";

import type { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import { Separator } from "@starter/ui/components/separator";
import { Toggle as ToggleComponent, type toggleVariants } from "@starter/ui/components/toggle";
import { cn } from "@starter/ui/lib/utils";

const toggleGroupItemVariants = cva("", {
	variants: {
		resolvedVariant: {
			default: null,
			outline:
				"border-x-0 not-first:rounded-s-none not-last:rounded-e-none before:[clip-path:inset(-1rem_var(--clip-end)_-1rem_var(--clip-start))] not-first:before:-start-0.5 not-first:before:rounded-s-none not-first:before:[--clip-start:2px] not-last:before:-end-0.5 not-last:before:rounded-e-none not-last:before:[--clip-end:2px] first:border-s last:border-e not-last:has-[+[data-slot=separator]]:before:[--clip-end:1.5px] [[data-slot=separator]+&]:before:[--clip-start:1.5px]",
		},
	},
});

const toggleGroupVariants = cva("flex w-fit *:pointer-coarse:after:min-w-auto", {
	variants: { variant: { default: "gap-4", outline: "[--clip-end:-1rem] [--clip-start:-1rem]" } },
});

const ToggleGroupContext = React.createContext<VariantProps<typeof toggleVariants>>({
	size: "default",
	variant: "default",
});

const ToggleGroup = ({
	children,
	className,
	size = "default",
	variant = "default",
	...props
}: ToggleGroupPrimitive.Props & VariantProps<typeof toggleVariants>) => {
	return (
		<ToggleGroupPrimitive
			className={cn(toggleGroupVariants({ variant }), className)}
			data-size={size}
			data-slot='toggle-group'
			data-variant={variant}
			{...props}
		>
			<ToggleGroupContext.Provider value={{ size, variant }}>{children}</ToggleGroupContext.Provider>
		</ToggleGroupPrimitive>
	);
};

const Toggle = ({
	children,
	className,
	size,
	variant,
	...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) => {
	const context = React.useContext(ToggleGroupContext);

	const resolvedVariant = context.variant || variant;
	const resolvedSize = context.size || size;

	return (
		<ToggleComponent
			className={cn(toggleGroupItemVariants({ resolvedVariant }), className)}
			data-size={resolvedSize}
			data-variant={resolvedVariant}
			size={resolvedSize}
			variant={resolvedVariant}
			{...props}
		>
			{children}
		</ToggleComponent>
	);
};

const ToggleGroupSeparator = ({ className, ...props }: { className?: string }) => {
	return <Separator className={className} orientation='vertical' {...props} />;
};

export { ToggleGroup, Toggle, Toggle as ToggleGroupItem, ToggleGroupSeparator };
