"use client";

import type * as React from "react";

import { Input as InputPrimitive } from "@base-ui/react/input";
import { cva } from "class-variance-authority";

import { cn } from "@starter/ui/lib/utils";

const inputVariants = cva("relative inline-flex w-full", {
	compoundVariants: [
		{
			class: "rounded-lg border bg-clip-padding text-base/5 ring-ring/24 transition-[color,background-color,box-shadow,border-color] has-disabled:opacity-64 has-aria-invalid:border-destructive/36 has-focus-visible:border-ring has-focus-visible:ring-2 sm:text-sm dark:bg-clip-border dark:has-aria-invalid:ring-destructive/24",
			unstyled: false,
			variant: ["default", "ghost", "subtle"],
		},
		{
			class: "border-input bg-background dark:bg-input/32",
			unstyled: false,
			variant: "default",
		},
		{
			class: "min-h-14 rounded-2xl sm:text-base",
			size: "xl",
		},
		{
			class: "rounded-full",
			corners: "pill",
		},
	],
	variants: {
		corners: {
			default: null,
			pill: null,
		},
		size: {
			default: null,
			lg: null,
			sm: null,
			xl: null,
		},
		unstyled: {
			false: null,
			true: null,
		},
		variant: {
			default: null,
			ghost: "border-transparent bg-transparent text-foreground hover:bg-muted/40",
			overlay: "absolute inset-0 size-full opacity-0",
			subtle: "border-transparent bg-muted/40",
		},
	},
});

const inputFieldVariants = cva(
	"w-full min-w-0 rounded-[inherit] px-[calc(--spacing(3)-1px)] py-[calc(--spacing(1.5)-1px)] outline-none placeholder:text-muted-foreground/64",
	{
		compoundVariants: [{ class: "h-full cursor-pointer p-0", overlay: true }],
		variants: {
			file: {
				true: "text-muted-foreground file:me-3 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
			},
			overlay: { true: null },
			search: {
				true: "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none",
			},
			size: {
				default: null,
				lg: "py-[calc(--spacing(2)-1px)]",
				sm: "px-[calc(--spacing(2.5)-1px)] py-[calc(--spacing(1)-1px)]",
				xl: "px-6 py-4",
			},
		},
	}
);

export type InputProps = Omit<InputPrimitive.Props & React.RefAttributes<HTMLInputElement>, "size"> & {
	corners?: "default" | "pill";
	size?: "sm" | "default" | "lg" | "xl" | number;
	unstyled?: boolean;
	variant?: "default" | "ghost" | "subtle" | "overlay";
};

const Input = ({
	className,
	corners = "default",
	ref,
	size = "default",
	unstyled = false,
	variant = "default",
	...props
}: InputProps) => {
	const visualSize = size === "sm" || size === "lg" || size === "xl" ? size : "default";

	return (
		<span
			className={cn(inputVariants({ corners, size: visualSize, unstyled, variant }), className)}
			data-slot='input-control'
		>
			<InputPrimitive
				className={cn(
					inputFieldVariants({
						file: props.type === "file",
						overlay: variant === "overlay",
						search: props.type === "search",
						size: visualSize,
					})
				)}
				data-slot='input'
				ref={ref}
				size={size === "sm" || size === "default" || size === "lg" || size === "xl" ? undefined : size}
				{...props}
			/>
		</span>
	);
};

export { Input };
