"use client";

import type * as React from "react";

import { Menu as DropdownMenuPrimitive } from "@base-ui/react/menu";
import { Tick02Icon, ArrowRight01Icon, CircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cva } from "class-variance-authority";

import { cn } from "../lib/utils";

const dropdownMenuSubTriggerVariants = cva(
	"outline-hidden flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm data-highlighted:bg-accent data-popup-open:bg-accent [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
	{ variants: { inset: { true: "ps-8" } } }
);

const dropdownMenuLabelVariants = cva("px-2 py-1.5 text-sm font-semibold", { variants: { inset: { true: "ps-8" } } });

const dropdownMenuItemVariants = cva(
	"outline-hidden data-disabled:pointer-events-none data-disabled:opacity-50 relative flex cursor-pointer select-none items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent data-highlighted:bg-accent [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0",
	{
		variants: {
			inset: { true: "ps-8" },
			variant: {
				default: null,
				destructive:
					"text-destructive hover:bg-destructive/10 data-highlighted:bg-destructive/10 dark:text-destructive-foreground",
			},
		},
	}
);

const DropdownMenu = DropdownMenuPrimitive.Root;

const DropdownMenuTrigger = ({
	className,
	ref,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) => (
	<DropdownMenuPrimitive.Trigger
		className={cn("outline-hidden", className)}
		data-testid='dropdown-trigger'
		ref={ref}
		{...props}
	/>
);

const DropdownMenuGroup = DropdownMenuPrimitive.Group;

const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuSub = DropdownMenuPrimitive.SubmenuRoot;

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuSubTrigger = ({
	children,
	className,
	inset,
	ref,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubmenuTrigger> & {
	inset?: boolean;
}) => (
	<DropdownMenuPrimitive.SubmenuTrigger
		className={cn(dropdownMenuSubTriggerVariants({ inset }), className)}
		ref={ref}
		{...props}
	>
		{children}
		<HugeiconsIcon aria-hidden='true' className='ms-auto scale-110' icon={ArrowRight01Icon} strokeWidth={1.75} />
	</DropdownMenuPrimitive.SubmenuTrigger>
);

type DropdownMenuContentProps = DropdownMenuPrimitive.Popup.Props &
	Pick<DropdownMenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">;

const DropdownMenuContent = ({
	align = "end",
	alignOffset,
	className,
	side = "bottom",
	sideOffset = 4,
	...props
}: DropdownMenuContentProps) => (
	<DropdownMenuPrimitive.Portal>
		<DropdownMenuPrimitive.Positioner
			align={align}
			alignOffset={alignOffset}
			className='z-70'
			side={side}
			sideOffset={sideOffset}
		>
			<DropdownMenuPrimitive.Popup
				className={cn(
					"min-w-32 max-h-(--available-height) origin-(--transform-origin) overflow-y-auto rounded-2xl bg-popover p-1 text-popover-foreground smooth-shadow-ring-md outline-none transition-[transform,opacity] duration-150 ease-[var(--ease-out-quint)] data-starting-style:opacity-0 data-ending-style:opacity-0 data-starting-style:scale-98 data-ending-style:scale-98",
					className
				)}
				data-testid='dropdown-content'
				{...props}
			/>
		</DropdownMenuPrimitive.Positioner>
	</DropdownMenuPrimitive.Portal>
);

const DropdownMenuSubContent = (props: DropdownMenuContentProps) => (
	<DropdownMenuContent align='start' alignOffset={-5} side='inline-end' sideOffset={0} {...props} />
);

const DropdownMenuItem = ({
	className,
	inset,
	ref,
	variant = "default",
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
	inset?: boolean;
	variant?: "default" | "destructive";
}) => (
	<DropdownMenuPrimitive.Item
		className={cn(dropdownMenuItemVariants({ inset, variant }), className)}
		data-testid='dropdown-item'
		ref={ref}
		{...props}
	/>
);

const DropdownMenuCheckboxItem = ({
	checked,
	children,
	className,
	ref,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) => (
	<DropdownMenuPrimitive.CheckboxItem
		checked={checked}
		className={cn(
			"outline-hidden data-disabled:pointer-events-none data-disabled:opacity-50 relative flex cursor-default select-none items-center rounded-sm py-1.5 ps-8 pe-2 text-sm transition-colors data-highlighted:bg-accent data-highlighted:text-accent-foreground",
			className
		)}
		ref={ref}
		{...props}
	>
		<span className='absolute inset-s-2 flex h-3.5 w-3.5 items-center justify-center'>
			<DropdownMenuPrimitive.CheckboxItemIndicator>
				<HugeiconsIcon aria-hidden='true' className='h-4 w-4 scale-110' icon={Tick02Icon} strokeWidth={1.75} />
			</DropdownMenuPrimitive.CheckboxItemIndicator>
		</span>
		{children}
	</DropdownMenuPrimitive.CheckboxItem>
);

const DropdownMenuRadioItem = ({
	children,
	className,
	ref,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) => (
	<DropdownMenuPrimitive.RadioItem
		className={cn(
			"outline-hidden data-disabled:pointer-events-none data-disabled:opacity-50 relative flex cursor-default select-none items-center rounded-sm py-1.5 ps-8 pe-2 text-sm transition-colors data-highlighted:bg-accent data-highlighted:text-accent-foreground",
			className
		)}
		ref={ref}
		{...props}
	>
		<span className='absolute inset-s-2 flex h-3.5 w-3.5 items-center justify-center'>
			<DropdownMenuPrimitive.RadioItemIndicator>
				<HugeiconsIcon
					aria-hidden='true'
					className='h-2 w-2 fill-current scale-110'
					icon={CircleIcon}
					strokeWidth={1.75}
				/>
			</DropdownMenuPrimitive.RadioItemIndicator>
		</span>
		{children}
	</DropdownMenuPrimitive.RadioItem>
);

const DropdownMenuLabel = ({
	className,
	inset,
	ref,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.GroupLabel> & {
	inset?: boolean;
}) => (
	<DropdownMenuPrimitive.GroupLabel
		className={cn(dropdownMenuLabelVariants({ inset }), className)}
		data-testid='dropdown-label'
		ref={ref}
		{...props}
	/>
);

const DropdownMenuSeparator = ({
	className,
	ref,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) => (
	<DropdownMenuPrimitive.Separator
		className={cn("-mx-1 my-1 h-px bg-muted", className)}
		data-testid='dropdown-separator'
		ref={ref}
		{...props}
	/>
);

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
	return <span className={cn("ms-auto text-xs tracking-widest opacity-60", className)} {...props} />;
};

DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

export {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuCheckboxItem,
	DropdownMenuRadioItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuGroup,
	DropdownMenuPortal,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuRadioGroup,
};
