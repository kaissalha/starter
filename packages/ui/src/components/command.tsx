"use client";

import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
	AutocompleteEmpty,
	AutocompleteGroup,
	AutocompleteGroupLabel,
	AutocompleteItem,
	AutocompleteList,
	AutocompleteSeparator,
	AutocompleteCollection as CommandCollection,
} from "@starter/ui/components/autocomplete";
import { DialogBackdrop } from "@starter/ui/components/dialog";
import { Input } from "@starter/ui/components/input";
import { cn } from "@starter/ui/lib/utils";

const Command = ({
	autoHighlight = "always",
	keepHighlight = true,
	open = true,
	...props
}: AutocompletePrimitive.Root.Props<unknown>) => {
	return (
		<AutocompletePrimitive.Root
			autoHighlight={autoHighlight}
			keepHighlight={keepHighlight}
			open={open}
			{...props}
		/>
	);
};

const CommandInput = ({
	"aria-label": ariaLabel,
	className,
	...props
}: Omit<AutocompletePrimitive.Input.Props, "aria-label"> & { "aria-label": string }) => {
	return (
		<AutocompletePrimitive.Input
			aria-label={ariaLabel}
			className={cn("border-b", className)}
			data-slot='command-input'
			render={
				<Input
					aria-label={ariaLabel}
					className='rounded-none rounded-t-lg border-none ring-0 focus-within:ring-0'
					size='lg'
				/>
			}
			{...props}
		>
			<span className='absolute inset-s-3 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg:not([class*="size-"])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0'>
				<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Search01Icon} strokeWidth={1.75} />
			</span>
		</AutocompletePrimitive.Input>
	);
};

const CommandList = ({ className, ...props }: AutocompletePrimitive.List.Props) => {
	return <AutocompleteList className={cn("not-empty:p-1", className)} {...props} />;
};

const CommandEmpty = ({ className, ...props }: AutocompletePrimitive.Empty.Props) => {
	return <AutocompleteEmpty className={cn("py-6 text-center text-sm", className)} {...props} />;
};

const CommandItem = ({ className, ...props }: AutocompletePrimitive.Item.Props) => {
	return (
		<AutocompleteItem
			className={cn(
				"relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className
			)}
			data-slot='command-item'
			{...props}
		/>
	);
};

const CommandGroup = ({ className, ...props }: AutocompletePrimitive.Group.Props) => {
	return (
		<AutocompleteGroup
			className={cn(
				"overflow-hidden p-1 text-foreground **:data-[slot=command-group-label]:px-2 **:data-[slot=command-group-label]:py-1.5 **:data-[slot=command-group-label]:text-xs **:data-[slot=command-group-label]:font-medium **:data-[slot=command-group-label]:text-muted-foreground",
				className
			)}
			{...props}
		/>
	);
};

const CommandGroupLabel = ({ className, ...props }: AutocompletePrimitive.GroupLabel.Props) => {
	return (
		<AutocompleteGroupLabel
			className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)}
			data-slot='command-group-label'
			{...props}
		/>
	);
};

const CommandSeparator = ({ className, ...props }: AutocompletePrimitive.Separator.Props) => {
	return <AutocompleteSeparator className={cn("my-1 -mx-1 h-px bg-border", className)} {...props} />;
};

const CommandShortcut = ({ className, ...props }: React.ComponentProps<"span">) => {
	return (
		<span
			className={cn("ms-auto text-xs tracking-widest text-muted-foreground", className)}
			data-slot='command-shortcut'
			{...props}
		/>
	);
};

const CommandFooter = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			className={cn("flex items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground", className)}
			data-slot='command-footer'
			{...props}
		/>
	);
};

const CommandPanel = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			className={cn(
				"overflow-hidden rounded-lg bg-popover text-popover-foreground smooth-shadow-ring-lg",
				className
			)}
			data-slot='command-panel'
			{...props}
		/>
	);
};

const CommandDialog = DialogPrimitive.Root;

const CommandDialogTrigger = (props: DialogPrimitive.Trigger.Props) => {
	return <DialogPrimitive.Trigger data-slot='command-dialog-trigger' {...props} />;
};

const CommandDialogPopup = ({ children, className, ...props }: DialogPrimitive.Popup.Props) => {
	return (
		<DialogPrimitive.Portal>
			<DialogBackdrop />
			<div className='fixed inset-0 z-60 flex items-start justify-center pt-[20vh]'>
				<DialogPrimitive.Popup
					className={cn(
						"w-full max-w-lg overflow-hidden rounded-xl bg-popover text-popover-foreground smooth-shadow-ring-2xl",
						className
					)}
					data-slot='command-dialog-popup'
					{...props}
				>
					{children}
				</DialogPrimitive.Popup>
			</div>
		</DialogPrimitive.Portal>
	);
};

export {
	Command,
	CommandInput,
	CommandList,
	CommandEmpty,
	CommandItem,
	CommandGroup,
	CommandGroupLabel,
	CommandSeparator,
	CommandShortcut,
	CommandFooter,
	CommandPanel,
	CommandDialog,
	CommandDialogTrigger,
	CommandDialogPopup,
	CommandCollection,
};
