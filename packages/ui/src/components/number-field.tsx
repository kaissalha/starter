"use client";

import * as React from "react";

import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field";
import { MinusSignIcon, Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cva } from "class-variance-authority";

import { Label } from "@starter/ui/components/label";
import { cn } from "@starter/ui/lib/utils";

const numberFieldDecrementVariants = cva(
	"relative flex shrink-0 cursor-pointer items-center justify-center rounded-s-[calc(var(--radius-lg)-1px)] px-[calc(--spacing(3)-1px)] transition-colors hover:bg-accent pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11",
	{ variants: { size: { default: null, lg: "", sm: "px-[calc(--spacing(2.5)-1px)]" } } }
);

const numberFieldIncrementVariants = cva(
	"relative flex shrink-0 cursor-pointer items-center justify-center rounded-e-[calc(var(--radius-lg)-1px)] px-[calc(--spacing(3)-1px)] transition-colors hover:bg-accent pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11",
	{ variants: { size: { default: null, lg: "", sm: "px-[calc(--spacing(2.5)-1px)]" } } }
);

const numberFieldInputVariants = cva(
	"min-w-0 flex-1 bg-transparent px-[calc(--spacing(3)-1px)] py-[calc(--spacing(1.5)-1px)] text-center tabular-nums outline-none",
	{
		variants: {
			size: {
				default: null,
				lg: "py-[calc(--spacing(2)-1px)]",
				sm: "px-[calc(--spacing(2.5)-1px)] py-[calc(--spacing(1)-1px)]",
			},
		},
	}
);

const NumberFieldContext = React.createContext<{
	fieldId: string;
	size: "sm" | "default" | "lg";
} | null>(null);

const NumberField = ({
	className,
	id,
	size = "default",
	...props
}: NumberFieldPrimitive.Root.Props & {
	size?: "sm" | "default" | "lg";
}) => {
	const generatedId = React.useId();
	const fieldId = id ?? generatedId;

	return (
		<NumberFieldContext.Provider value={{ fieldId, size }}>
			<NumberFieldPrimitive.Root
				className={cn("flex w-full flex-col items-start gap-2", className)}
				data-size={size}
				data-slot='number-field'
				id={fieldId}
				{...props}
			/>
		</NumberFieldContext.Provider>
	);
};

const NumberFieldGroup = ({ className, ...props }: NumberFieldPrimitive.Group.Props) => {
	return (
		<NumberFieldPrimitive.Group
			className={cn(
				"relative flex w-full justify-between rounded-lg border border-input bg-background bg-clip-padding text-sm ring-ring/24 transition-[color,background-color,box-shadow,border-color] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-data-disabled:not-aria-invalid:before:smooth-shadow-sm focus-within:border-ring focus-within:ring-[3px] has-aria-invalid:border-destructive/36 focus-within:has-aria-invalid:border-destructive/64 focus-within:has-aria-invalid:ring-destructive/48 data-disabled:pointer-events-none data-disabled:opacity-64 dark:bg-input/32 dark:bg-clip-border dark:shadow-black/24 dark:not-data-disabled:smooth-shadow-sm dark:has-aria-invalid:ring-destructive/24 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className
			)}
			data-slot='number-field-group'
			{...props}
		/>
	);
};

const NumberFieldDecrement = ({ className, ...props }: NumberFieldPrimitive.Decrement.Props) => {
	const size = React.useContext(NumberFieldContext)?.size ?? "default";

	return (
		<NumberFieldPrimitive.Decrement
			className={cn(numberFieldDecrementVariants({ size }), className)}
			data-slot='number-field-decrement'
			{...props}
		>
			<HugeiconsIcon aria-hidden='true' className='scale-110' icon={MinusSignIcon} strokeWidth={1.75} />
		</NumberFieldPrimitive.Decrement>
	);
};

const NumberFieldIncrement = ({ className, ...props }: NumberFieldPrimitive.Increment.Props) => {
	const size = React.useContext(NumberFieldContext)?.size ?? "default";

	return (
		<NumberFieldPrimitive.Increment
			className={cn(numberFieldIncrementVariants({ size }), className)}
			data-slot='number-field-increment'
			{...props}
		>
			<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Add01Icon} strokeWidth={1.75} />
		</NumberFieldPrimitive.Increment>
	);
};

const NumberFieldInput = ({ className, ...props }: NumberFieldPrimitive.Input.Props) => {
	const size = React.useContext(NumberFieldContext)?.size ?? "default";

	return (
		<NumberFieldPrimitive.Input
			className={cn(numberFieldInputVariants({ size }), className)}
			data-slot='number-field-input'
			{...props}
		/>
	);
};

const NumberFieldScrubArea = ({
	className,
	label,
	...props
}: NumberFieldPrimitive.ScrubArea.Props & {
	label: string;
}) => {
	const context = React.useContext(NumberFieldContext);

	if (!context) {
		throw new Error("NumberFieldScrubArea must be used within a NumberField component for accessibility.");
	}

	return (
		<NumberFieldPrimitive.ScrubArea
			className={cn("flex cursor-ew-resize", className)}
			data-slot='number-field-scrub-area'
			{...props}
		>
			<Label className='cursor-ew-resize' htmlFor={context.fieldId}>
				{label}
			</Label>
			<NumberFieldPrimitive.ScrubAreaCursor className='drop-shadow-[0_1px_1px_#0008] filter'>
				<CursorGrowIcon />
			</NumberFieldPrimitive.ScrubAreaCursor>
		</NumberFieldPrimitive.ScrubArea>
	);
};

const CursorGrowIcon = (props: React.ComponentProps<"svg">) => {
	return (
		<svg
			fill='black'
			height='14'
			stroke='white'
			viewBox='0 0 24 14'
			width='26'
			xmlns='http://www.w3.org/2000/svg'
			{...props}
		>
			<path d='M19.5 5.5L6.5 5.52V2L1 7L6.5 12L6.5 8.5L19.5 8.5V12L25 7L19.5 2V5.5Z' />
		</svg>
	);
};

export {
	NumberField,
	NumberFieldScrubArea,
	NumberFieldDecrement,
	NumberFieldIncrement,
	NumberFieldGroup,
	NumberFieldInput,
};
