"use client";

import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete";
import { UnfoldMoreIcon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cva } from "class-variance-authority";

import { Input } from "@starter/ui/components/input";
import { ScrollArea } from "@starter/ui/components/scroll-area";
import { cn } from "@starter/ui/lib/utils";

const autocompleteInputVariants = cva("", {
	variants: {
		size: {
			default:
				"has-[+[data-slot=autocomplete-trigger],+[data-slot=autocomplete-clear]]:*:data-[slot=autocomplete-input]:pe-7",
			sm: "has-[+[data-slot=autocomplete-trigger],+[data-slot=autocomplete-clear]]:*:data-[slot=autocomplete-input]:pe-6.5",
		},
	},
});

const autocompleteActionVariants = cva(
	"-translate-y-1/2 absolute top-1/2 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent opacity-72 outline-none transition-colors pointer-coarse:after:absolute pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:opacity-100 has-[+[data-slot=autocomplete-clear]]:hidden [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{ variants: { size: { default: "inset-e-0.5", sm: "inset-e-0" } } }
);

const Autocomplete = AutocompletePrimitive.Root;

const AutocompleteInput = ({
	"aria-label": ariaLabel,
	className,
	showClear = false,
	showTrigger = false,
	size,
	...props
}: Omit<AutocompletePrimitive.Input.Props, "aria-label" | "size"> & {
	"aria-label": string;
	showClear?: boolean;
	showTrigger?: boolean;
	size?: "sm" | "default" | "lg" | number;
}) => {
	const sizeValue: "sm" | "default" | "lg" | number = size ?? "default";

	return (
		<div className='relative w-full'>
			<AutocompletePrimitive.Input
				aria-label={ariaLabel}
				className={cn(autocompleteInputVariants({ size: sizeValue === "sm" ? "sm" : "default" }), className)}
				data-slot='autocomplete-input'
				render={<Input aria-label={ariaLabel} size={sizeValue} />}
				{...props}
			/>
			{showTrigger && (
				<AutocompleteTrigger
					className={cn(autocompleteActionVariants({ size: sizeValue === "sm" ? "sm" : "default" }))}
				>
					<HugeiconsIcon aria-hidden='true' className='scale-110' icon={UnfoldMoreIcon} strokeWidth={1.75} />
				</AutocompleteTrigger>
			)}
			{showClear && (
				<AutocompleteClear
					className={cn(autocompleteActionVariants({ size: sizeValue === "sm" ? "sm" : "default" }))}
				>
					<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Cancel01Icon} strokeWidth={1.75} />
				</AutocompleteClear>
			)}
		</div>
	);
};

const AutocompletePopup = ({
	children,
	className,
	sideOffset = 4,
	...props
}: AutocompletePrimitive.Popup.Props & {
	sideOffset?: number;
}) => {
	return (
		<AutocompletePrimitive.Portal>
			<AutocompletePrimitive.Positioner
				className='z-70 select-none'
				data-slot='autocomplete-positioner'
				sideOffset={sideOffset}
			>
				<span
					className={cn(
						"relative flex max-h-full origin-(--transform-origin) rounded-lg bg-popover smooth-shadow-ring-lg transition-[scale,opacity] duration-150 ease-[var(--ease-out-quint)] has-data-starting-style:scale-98 has-data-starting-style:opacity-0",
						className
					)}
				>
					<AutocompletePrimitive.Popup
						className='flex max-h-[min(var(--available-height),23rem)] w-(--anchor-width) max-w-(--available-width) flex-col'
						data-slot='autocomplete-popup'
						{...props}
					>
						{children}
					</AutocompletePrimitive.Popup>
				</span>
			</AutocompletePrimitive.Positioner>
		</AutocompletePrimitive.Portal>
	);
};

const AutocompleteItem = ({ children, className, ...props }: AutocompletePrimitive.Item.Props) => {
	return (
		<AutocompletePrimitive.Item
			className={cn(
				"flex cursor-default select-none items-center rounded-sm px-2 py-1 text-base outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:text-sm",
				className
			)}
			data-slot='autocomplete-item'
			{...props}
		>
			{children}
		</AutocompletePrimitive.Item>
	);
};

const AutocompleteSeparator = ({ className, ...props }: AutocompletePrimitive.Separator.Props) => {
	return (
		<AutocompletePrimitive.Separator
			className={cn("mx-2 my-1 h-px bg-border last:hidden", className)}
			data-slot='autocomplete-separator'
			{...props}
		/>
	);
};

const AutocompleteGroup = ({ className, ...props }: AutocompletePrimitive.Group.Props) => {
	return <AutocompletePrimitive.Group className={className} data-slot='autocomplete-group' {...props} />;
};

const AutocompleteGroupLabel = ({ className, ...props }: AutocompletePrimitive.GroupLabel.Props) => {
	return (
		<AutocompletePrimitive.GroupLabel
			className={cn("px-2 py-1.5 font-medium text-muted-foreground text-xs", className)}
			data-slot='autocomplete-group-label'
			{...props}
		/>
	);
};

const AutocompleteEmpty = ({ className, ...props }: AutocompletePrimitive.Empty.Props) => {
	return (
		<AutocompletePrimitive.Empty
			className={cn("not-empty:p-2 text-center text-muted-foreground text-sm", className)}
			data-slot='autocomplete-empty'
			{...props}
		/>
	);
};

const AutocompleteRow = ({ className, ...props }: AutocompletePrimitive.Row.Props) => {
	return <AutocompletePrimitive.Row className={className} data-slot='autocomplete-row' {...props} />;
};

const AutocompleteValue = ({ ...props }: AutocompletePrimitive.Value.Props) => {
	return <AutocompletePrimitive.Value data-slot='autocomplete-value' {...props} />;
};

const AutocompleteList = ({ className, ...props }: AutocompletePrimitive.List.Props) => {
	return (
		<ScrollArea scrollbarGutter scrollFade>
			<AutocompletePrimitive.List
				className={cn(
					"not-empty:scroll-py-1 not-empty:px-1 not-empty:py-1 in-data-has-overflow-y:pe-3",
					className
				)}
				data-slot='autocomplete-list'
				{...props}
			/>
		</ScrollArea>
	);
};

const AutocompleteClear = ({ className, ...props }: AutocompletePrimitive.Clear.Props) => {
	return (
		<AutocompletePrimitive.Clear
			className={cn(
				"-translate-y-1/2 absolute inset-e-0.5 top-1/2 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent opacity-72 outline-none transition-[color,background-color,box-shadow,opacity] pointer-coarse:after:absolute pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:opacity-100 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className
			)}
			data-slot='autocomplete-clear'
			{...props}
		>
			<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Cancel01Icon} strokeWidth={1.75} />
		</AutocompletePrimitive.Clear>
	);
};

const AutocompleteStatus = ({ className, ...props }: AutocompletePrimitive.Status.Props) => {
	return (
		<AutocompletePrimitive.Status
			className={cn("px-3 py-2 font-medium text-muted-foreground text-xs empty:m-0 empty:p-0", className)}
			data-slot='autocomplete-status'
			{...props}
		/>
	);
};

const AutocompleteCollection = ({ ...props }: AutocompletePrimitive.Collection.Props) => {
	return <AutocompletePrimitive.Collection data-slot='autocomplete-collection' {...props} />;
};

const AutocompleteTrigger = ({ className, ...props }: AutocompletePrimitive.Trigger.Props) => {
	return <AutocompletePrimitive.Trigger className={className} data-slot='autocomplete-trigger' {...props} />;
};

export {
	Autocomplete,
	AutocompleteInput,
	AutocompleteTrigger,
	AutocompletePopup,
	AutocompleteItem,
	AutocompleteSeparator,
	AutocompleteGroup,
	AutocompleteGroupLabel,
	AutocompleteEmpty,
	AutocompleteValue,
	AutocompleteList,
	AutocompleteClear,
	AutocompleteStatus,
	AutocompleteRow,
	AutocompleteCollection,
};
