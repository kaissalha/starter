import type * as React from "react";

import { cva } from "class-variance-authority";

import { cn } from "@starter/ui/lib/utils";

const textareaVariants = cva("", {
	variants: {
		variant: {
			composer:
				"not-placeholder-shown:text-foreground bg-transparent px-3 pt-2 pb-1 text-base font-normal leading-5 outline-none placeholder:text-base placeholder:font-normal placeholder:text-muted-foreground",
			default: null,
			inline: "m-0 block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-base leading-snug text-foreground outline-none placeholder:text-muted-foreground sm:text-[13px]",
		},
	},
});

const textareaFieldVariants = cva(
	"field-sizing-content min-h-17.5 w-full rounded-[inherit] px-[calc(--spacing(3)-1px)] py-[calc(--spacing(1.5)-1px)] outline-none max-sm:min-h-20.5 [&::-webkit-resizer]:opacity-0",
	{
		variants: {
			size: {
				default: null,
				lg: "min-h-18.5 py-[calc(--spacing(2)-1px)] max-sm:min-h-21.5",
				sm: "min-h-16.5 px-[calc(--spacing(2.5)-1px)] py-[calc(--spacing(1)-1px)] max-sm:min-h-19.5",
			},
		},
	}
);

export type TextareaProps = React.ComponentProps<"textarea"> & {
	size?: "sm" | "default" | "lg" | number;
	unstyled?: boolean;
	variant?: "default" | "inline" | "composer";
};

const Textarea = ({
	"aria-label": ariaLabel,
	className,
	size = "default",
	unstyled = false,
	variant = "default",
	...props
}: TextareaProps) => {
	if (unstyled || variant === "inline" || variant === "composer") {
		return (
			<textarea
				aria-label={ariaLabel}
				className={cn(textareaVariants({ variant }), className)}
				data-slot='textarea'
				{...props}
			/>
		);
	}

	return (
		<span
			className={cn(
				"relative inline-flex w-full rounded-lg border border-input bg-background bg-clip-padding text-base ring-ring/24 transition-[color,background-color,box-shadow,border-color] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-has-disabled:before:smooth-shadow-sm has-disabled:opacity-64 has-aria-invalid:border-destructive/36 has-aria-invalid:before:smooth-shadow-none sm:text-sm dark:bg-input/32 dark:bg-clip-border dark:shadow-black/24 dark:not-has-disabled:smooth-shadow-sm dark:has-aria-invalid:ring-destructive/24",
				className
			)}
			data-slot='textarea-control'
		>
			<textarea
				aria-label={ariaLabel}
				className={cn(textareaFieldVariants({ size: size === "sm" || size === "lg" ? size : undefined }))}
				data-slot='textarea'
				{...props}
			/>
		</span>
	);
};

export { Textarea };
