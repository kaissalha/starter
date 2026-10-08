"use client";

import * as React from "react";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { UnfoldMoreIcon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cva } from "class-variance-authority";

import { Input } from "@starter/ui/components/input";
import { ScrollArea } from "@starter/ui/components/scroll-area";
import { cn } from "@starter/ui/lib/utils";

const comboboxMultipleInputVariants = cva(
	"min-w-12 flex-1 text-base/5 outline-none sm:text-sm [[data-slot=combobox-chip]+&]:ps-0.5",
	{ variants: { size: { default: "ps-2", sm: "ps-1.5" } } }
);

const comboboxInputVariants = cva("", {
	variants: {
		size: {
			default:
				"has-[+[data-slot=combobox-trigger],+[data-slot=combobox-clear]]:*:data-[slot=combobox-input]:pe-7",
			sm: "has-[+[data-slot=combobox-trigger],+[data-slot=combobox-clear]]:*:data-[slot=combobox-input]:pe-6.5",
		},
	},
});

const comboboxActionVariants = cva(
	"absolute top-1/2 inline-flex size-7 shrink-0 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border border-transparent opacity-72 transition-[color,background-color,box-shadow,opacity] outline-none hover:opacity-100 has-[+[data-slot=combobox-clear]]:hidden pointer-coarse:after:absolute pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{ variants: { size: { default: "inset-e-0.5", sm: "inset-e-0" } } }
);

const ComboboxContext = React.createContext<{
	chipsRef: React.RefObject<HTMLDivElement | null> | null;
	multiple: boolean;
}>({
	chipsRef: null,
	multiple: false,
});

const Combobox = <ItemValue, Multiple extends boolean | undefined = false>(
	props: ComboboxPrimitive.Root.Props<ItemValue, Multiple>
) => {
	const chipsRef = React.useRef<HTMLDivElement | null>(null);

	return (
		<ComboboxContext.Provider value={{ chipsRef, multiple: !!props.multiple }}>
			<ComboboxPrimitive.Root {...props} />
		</ComboboxContext.Provider>
	);
};

const ComboboxInput = ({
	"aria-label": ariaLabel,
	className,
	showClear = false,
	showTrigger = true,
	size,
	...props
}: Omit<ComboboxPrimitive.Input.Props, "aria-label" | "size"> & {
	"aria-label": string;
	showClear?: boolean;
	showTrigger?: boolean;
	size?: "sm" | "default" | "lg" | number;
}) => {
	const { multiple } = React.useContext(ComboboxContext);
	const sizeValue: "sm" | "default" | "lg" | number = size ?? "default";
	const isNamedSize = sizeValue === "sm" || sizeValue === "default" || sizeValue === "lg";

	if (multiple) {
		return (
			<ComboboxPrimitive.Input
				aria-label={ariaLabel}
				className={cn(
					comboboxMultipleInputVariants({ size: sizeValue === "sm" ? "sm" : "default" }),
					className
				)}
				data-size={isNamedSize ? sizeValue : undefined}
				data-slot='combobox-input'
				size={isNamedSize ? undefined : sizeValue}
				{...props}
			/>
		);
	}

	return (
		<div className='relative w-full has-disabled:opacity-64'>
			<ComboboxPrimitive.Input
				aria-label={ariaLabel}
				className={cn(comboboxInputVariants({ size: sizeValue === "sm" ? "sm" : "default" }), className)}
				data-slot='combobox-input'
				render={<Input aria-label={ariaLabel} className='has-disabled:opacity-100' size={sizeValue} />}
				{...props}
			/>
			{showTrigger && (
				<ComboboxTrigger
					className={cn(comboboxActionVariants({ size: sizeValue === "sm" ? "sm" : "default" }))}
				>
					<HugeiconsIcon aria-hidden='true' className='scale-110' icon={UnfoldMoreIcon} strokeWidth={1.75} />
				</ComboboxTrigger>
			)}
			{showClear && (
				<ComboboxClear className={cn(comboboxActionVariants({ size: sizeValue === "sm" ? "sm" : "default" }))}>
					<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Cancel01Icon} strokeWidth={1.75} />
				</ComboboxClear>
			)}
		</div>
	);
};

const ComboboxTrigger = ({ className, ...props }: ComboboxPrimitive.Trigger.Props) => {
	return <ComboboxPrimitive.Trigger className={className} data-slot='combobox-trigger' {...props} />;
};

const ComboboxPopup = ({
	children,
	className,
	sideOffset = 4,
	...props
}: ComboboxPrimitive.Popup.Props & {
	sideOffset?: number;
}) => {
	const { chipsRef } = React.useContext(ComboboxContext);

	return (
		<ComboboxPrimitive.Portal>
			<ComboboxPrimitive.Positioner
				anchor={chipsRef}
				className='z-70 select-none'
				data-slot='combobox-positioner'
				sideOffset={sideOffset}
			>
				<span className='relative flex max-h-full origin-(--transform-origin) rounded-lg bg-popover smooth-shadow-ring-lg transition-[scale,opacity] duration-150 ease-[var(--ease-out-quint)] has-data-starting-style:scale-98 has-data-starting-style:opacity-0'>
					<ComboboxPrimitive.Popup
						className={cn(
							"flex max-h-[min(var(--available-height),23rem)] w-(--anchor-width) max-w-(--available-width) flex-col",
							className
						)}
						data-slot='combobox-popup'
						{...props}
					>
						{children}
					</ComboboxPrimitive.Popup>
				</span>
			</ComboboxPrimitive.Positioner>
		</ComboboxPrimitive.Portal>
	);
};

const ComboboxItem = ({ children, className, ...props }: ComboboxPrimitive.Item.Props) => {
	return (
		<ComboboxPrimitive.Item
			className={cn(
				"grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-sm py-1 ps-2 pe-4 text-base outline-none in-data-[side=none]:min-w-[calc(var(--anchor-width)+1.25rem)] data-disabled:pointer-events-none data-disabled:opacity-64 data-highlighted:bg-accent data-highlighted:text-accent-foreground sm:text-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className
			)}
			data-slot='combobox-item'
			{...props}
		>
			<ComboboxPrimitive.ItemIndicator className='col-start-1'>
				<svg
					fill='none'
					height='24'
					stroke='currentColor'
					strokeLinecap='round'
					strokeLinejoin='round'
					strokeWidth='2'
					viewBox='0 0 24 24'
					width='24'
					xmlns='http://www.w3.org/1500/svg'
				>
					<path d='M5.252 12.7 10.2 18.63 18.748 5.37' />
				</svg>
			</ComboboxPrimitive.ItemIndicator>
			<div className='col-start-2'>{children}</div>
		</ComboboxPrimitive.Item>
	);
};

const ComboboxSeparator = ({ className, ...props }: ComboboxPrimitive.Separator.Props) => {
	return (
		<ComboboxPrimitive.Separator
			className={cn("mx-2 my-1 h-px bg-border last:hidden", className)}
			data-slot='combobox-separator'
			{...props}
		/>
	);
};

const ComboboxGroup = ({ className, ...props }: ComboboxPrimitive.Group.Props) => {
	return <ComboboxPrimitive.Group className={className} data-slot='combobox-group' {...props} />;
};

const ComboboxGroupLabel = ({ className, ...props }: ComboboxPrimitive.GroupLabel.Props) => {
	return (
		<ComboboxPrimitive.GroupLabel
			className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)}
			data-slot='combobox-group-label'
			{...props}
		/>
	);
};

const ComboboxEmpty = ({ className, ...props }: ComboboxPrimitive.Empty.Props) => {
	return (
		<ComboboxPrimitive.Empty
			className={cn("text-center text-sm text-muted-foreground not-empty:p-2", className)}
			data-slot='combobox-empty'
			{...props}
		/>
	);
};

const ComboboxRow = ({ className, ...props }: ComboboxPrimitive.Row.Props) => {
	return <ComboboxPrimitive.Row className={className} data-slot='combobox-row' {...props} />;
};

const ComboboxValue = ({ ...props }: ComboboxPrimitive.Value.Props) => {
	return <ComboboxPrimitive.Value data-slot='combobox-value' {...props} />;
};

const ComboboxList = ({ className, ...props }: ComboboxPrimitive.List.Props) => {
	return (
		<ScrollArea className='flex-1'>
			<ComboboxPrimitive.List
				className={cn(
					"not-empty:scroll-py-1 not-empty:px-1 not-empty:py-1 in-data-has-overflow-y:pe-3",
					className
				)}
				data-slot='combobox-list'
				{...props}
			/>
		</ScrollArea>
	);
};

const ComboboxClear = ({ className, ...props }: ComboboxPrimitive.Clear.Props) => {
	return <ComboboxPrimitive.Clear className={className} data-slot='combobox-clear' {...props} />;
};

const ComboboxStatus = ({ className, ...props }: ComboboxPrimitive.Status.Props) => {
	return (
		<ComboboxPrimitive.Status
			className={cn("px-3 py-2 text-xs font-medium text-muted-foreground empty:m-0 empty:p-0", className)}
			data-slot='combobox-status'
			{...props}
		/>
	);
};

const ComboboxCollection = (props: ComboboxPrimitive.Collection.Props) => {
	return <ComboboxPrimitive.Collection data-slot='combobox-collection' {...props} />;
};

const ComboboxChips = ({ className, ...props }: ComboboxPrimitive.Chips.Props) => {
	const { chipsRef } = React.useContext(ComboboxContext);

	return (
		<ComboboxPrimitive.Chips
			className={cn(
				"relative inline-flex min-h-8 w-full flex-wrap gap-1 rounded-lg border border-input bg-background bg-clip-padding p-[calc(--spacing(1)-1px)] text-base/5 ring-ring/24 transition-[color,background-color,box-shadow,border-color] outline-none *:min-h-6 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-has-disabled:not-aria-invalid:before:smooth-shadow-sm focus-within:border-ring focus-within:ring-[3px] has-disabled:pointer-events-none has-disabled:opacity-64 has-aria-invalid:border-destructive/36 focus-within:has-aria-invalid:border-destructive/64 focus-within:has-aria-invalid:ring-destructive/16 has-data-[size=lg]:min-h-9 has-data-[size=lg]:*:min-h-7 has-data-[size=sm]:min-h-7 has-data-[size=sm]:*:min-h-5 sm:text-sm dark:bg-clip-border dark:shadow-black/24 dark:not-has-disabled:bg-input/32 dark:not-has-disabled:smooth-shadow-sm dark:has-aria-invalid:ring-destructive/24",
				className
			)}
			data-slot='combobox-chips'
			ref={chipsRef}
			{...props}
		/>
	);
};

const ComboboxChip = ({ children, ...props }: ComboboxPrimitive.Chip.Props) => {
	return (
		<ComboboxPrimitive.Chip
			className='flex items-center rounded-md bg-accent ps-2 text-xs font-medium text-accent-foreground outline-none'
			data-slot='combobox-chip'
			{...props}
		>
			{children}
			<ComboboxChipRemove />
		</ComboboxPrimitive.Chip>
	);
};

const ComboboxChipRemove = (props: ComboboxPrimitive.ChipRemove.Props) => {
	return (
		<ComboboxPrimitive.ChipRemove
			aria-label='Remove'
			className="h-full shrink-0 cursor-pointer px-1.5 opacity-72 hover:opacity-100 [&_svg:not([class*='size-'])]:size-3.5"
			data-slot='combobox-chip-remove'
			{...props}
		>
			<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Cancel01Icon} strokeWidth={1.75} />
		</ComboboxPrimitive.ChipRemove>
	);
};

export {
	Combobox,
	ComboboxInput,
	ComboboxTrigger,
	ComboboxPopup,
	ComboboxItem,
	ComboboxSeparator,
	ComboboxGroup,
	ComboboxGroupLabel,
	ComboboxEmpty,
	ComboboxValue,
	ComboboxList,
	ComboboxClear,
	ComboboxStatus,
	ComboboxRow,
	ComboboxCollection,
	ComboboxChips,
	ComboboxChip,
};
