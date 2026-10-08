"use client";

import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { cva } from "class-variance-authority";

import { cn } from "@starter/ui/lib/utils";

const radioGroupVariants = cva("flex flex-col gap-3", { variants: { padded: { true: "p-4" } } });

const radioVariants = cva(
	"relative inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-background bg-clip-padding transition-[box-shadow,border-color] outline-none before:pointer-events-none before:absolute before:inset-0 before:rounded-full not-disabled:not-aria-invalid:not-data-checked:before:smooth-shadow-sm disabled:cursor-not-allowed disabled:opacity-64 aria-invalid:border-destructive/36 dark:bg-clip-border dark:shadow-black/24 dark:not-data-checked:bg-input/32 dark:not-disabled:not-data-checked:smooth-shadow-sm dark:aria-invalid:ring-destructive/24",
	{ variants: { variant: { card: "peer sr-only absolute", default: null } } }
);

const RadioGroup = ({
	className,
	padded = false,
	...props
}: RadioGroupPrimitive.Props & {
	padded?: boolean;
}) => {
	return (
		<RadioGroupPrimitive
			className={cn(radioGroupVariants({ padded }), className)}
			data-slot='radio-group'
			{...props}
		/>
	);
};

const Radio = ({
	className,
	variant = "default",
	...props
}: RadioPrimitive.Root.Props & { variant?: "default" | "card" }) => {
	return (
		<RadioPrimitive.Root className={cn(radioVariants({ variant }), className)} data-slot='radio' {...props}>
			<RadioPrimitive.Indicator
				className='absolute -inset-px flex size-4 items-center justify-center rounded-full before:size-1.5 before:rounded-full before:bg-primary-foreground transition-[scale,opacity] duration-150 ease-[var(--ease-out-quint)] data-checked:bg-primary data-unchecked:scale-50 data-unchecked:opacity-0'
				data-slot='radio-indicator'
				keepMounted
			/>
		</RadioPrimitive.Root>
	);
};

export { RadioGroup, Radio, Radio as RadioGroupItem };
