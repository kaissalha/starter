"use client";

import type * as React from "react";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Tick02Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cva } from "class-variance-authority";

import { cn } from "@starter/ui/lib/utils";

const Menu = MenuPrimitive.Root;

const MenuPortal = MenuPrimitive.Portal;

const MenuTrigger = (props: MenuPrimitive.Trigger.Props) => {
	return <MenuPrimitive.Trigger data-slot='menu-trigger' {...props} />;
};

const MenuPopup = ({
	align = "center",
	alignOffset = 0,
	className,
	sideOffset = 4,
	...props
}: MenuPrimitive.Popup.Props & {
	align?: MenuPrimitive.Positioner.Props["align"];
	alignOffset?: MenuPrimitive.Positioner.Props["alignOffset"];
	sideOffset?: MenuPrimitive.Positioner.Props["sideOffset"];
}) => {
	return (
		<MenuPrimitive.Portal>
			<MenuPrimitive.Positioner
				align={align}
				alignOffset={alignOffset}
				className='z-70'
				data-slot='menu-positioner'
				sideOffset={sideOffset}
			>
				<span className='relative flex origin-(--transform-origin) rounded-lg bg-popover smooth-shadow-ring-lg transition-[scale,opacity] duration-150 ease-[var(--ease-out-quint)] has-data-starting-style:scale-98 has-data-starting-style:opacity-0'>
					<MenuPrimitive.Popup
						className={cn("max-h-(--available-height) min-w-32 overflow-y-auto p-1", className)}
						data-slot='menu-popup'
						{...props}
					/>
				</span>
			</MenuPrimitive.Positioner>
		</MenuPrimitive.Portal>
	);
};

const MenuGroup = (props: MenuPrimitive.Group.Props) => {
	return <MenuPrimitive.Group data-slot='menu-group' {...props} />;
};

const menuItemVariants = cva(
	"flex cursor-default items-center gap-2 rounded-sm px-2 py-1 text-base outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-64 data-highlighted:bg-accent data-highlighted:text-accent-foreground data-inset:ps-8 sm:text-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{ variants: { variant: { default: null, destructive: "data-[variant=destructive]:text-destructive-foreground" } } }
);

const MenuItem = ({
	className,
	inset,
	variant = "default",
	...props
}: MenuPrimitive.Item.Props & {
	inset?: boolean;
	variant?: "default" | "destructive";
}) => {
	return (
		<MenuPrimitive.Item
			className={cn(menuItemVariants({ variant }), className)}
			data-inset={inset}
			data-slot='menu-item'
			data-variant={variant}
			{...props}
		/>
	);
};

const MenuCheckboxItem = ({ checked, children, className, ...props }: MenuPrimitive.CheckboxItem.Props) => {
	return (
		<MenuPrimitive.CheckboxItem
			checked={checked}
			className={cn(
				"grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-sm py-1 ps-2 pe-4 text-base outline-none in-data-[side=none]:min-w-[calc(var(--anchor-width)+1.25rem)] data-disabled:pointer-events-none data-disabled:opacity-64 data-highlighted:bg-accent data-highlighted:text-accent-foreground sm:text-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className
			)}
			data-slot='menu-checkbox-item'
			{...props}
		>
			<MenuPrimitive.CheckboxItemIndicator className='col-start-1'>
				<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Tick02Icon} strokeWidth={1.75} />
			</MenuPrimitive.CheckboxItemIndicator>
			<span className='col-start-2'>{children}</span>
		</MenuPrimitive.CheckboxItem>
	);
};

const MenuRadioGroup = (props: MenuPrimitive.RadioGroup.Props) => {
	return <MenuPrimitive.RadioGroup data-slot='menu-radio-group' {...props} />;
};

const MenuRadioItem = ({ children, className, ...props }: MenuPrimitive.RadioItem.Props) => {
	return (
		<MenuPrimitive.RadioItem
			className={cn(
				"grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-sm py-1 ps-2 pe-4 text-base outline-none in-data-[side=none]:min-w-[calc(var(--anchor-width)+1.25rem)] data-disabled:pointer-events-none data-disabled:opacity-64 data-highlighted:bg-accent data-highlighted:text-accent-foreground sm:text-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className
			)}
			data-slot='menu-radio-item'
			{...props}
		>
			<MenuPrimitive.RadioItemIndicator className='col-start-1'>
				<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Tick02Icon} strokeWidth={1.75} />
			</MenuPrimitive.RadioItemIndicator>
			<span className='col-start-2'>{children}</span>
		</MenuPrimitive.RadioItem>
	);
};

const MenuGroupLabel = ({
	className,
	inset,
	...props
}: MenuPrimitive.GroupLabel.Props & {
	inset?: boolean;
}) => {
	return (
		<MenuPrimitive.GroupLabel
			className={cn(
				"px-2 py-1.5 text-xs font-medium text-muted-foreground data-inset:ps-9 sm:data-inset:ps-8",
				className
			)}
			data-inset={inset}
			data-slot='menu-label'
			{...props}
		/>
	);
};

const MenuSeparator = ({ className, ...props }: MenuPrimitive.Separator.Props) => {
	return (
		<MenuPrimitive.Separator
			className={cn("mx-2 my-1 h-px bg-border", className)}
			data-slot='menu-separator'
			{...props}
		/>
	);
};

const MenuShortcut = ({ className, ...props }: React.ComponentProps<"span">) => {
	return (
		<span
			className={cn("ms-auto text-xs tracking-widest text-muted-foreground/64", className)}
			data-slot='menu-shortcut'
			{...props}
		/>
	);
};

const MenuSub = (props: MenuPrimitive.SubmenuRoot.Props) => {
	return <MenuPrimitive.SubmenuRoot data-slot='menu-sub' {...props} />;
};

const MenuSubTrigger = ({
	children,
	className,
	inset,
	...props
}: MenuPrimitive.SubmenuTrigger.Props & {
	inset?: boolean;
}) => {
	return (
		<MenuPrimitive.SubmenuTrigger
			className={cn(
				"flex items-center gap-2 rounded-sm px-2 py-1 text-base outline-none data-disabled:pointer-events-none data-disabled:opacity-64 data-highlighted:bg-accent data-highlighted:text-accent-foreground data-inset:ps-8 sm:text-sm [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
				className
			)}
			data-inset={inset}
			data-slot='menu-sub-trigger'
			{...props}
		>
			{children}
			<HugeiconsIcon
				aria-hidden='true'
				className='ms-auto scale-110'
				icon={ArrowRight01Icon}
				strokeWidth={1.75}
			/>
		</MenuPrimitive.SubmenuTrigger>
	);
};

const MenuSubPopup = ({
	align = "start",
	alignOffset = -4,
	className,
	sideOffset = 0,
	...props
}: MenuPrimitive.Popup.Props & {
	align?: MenuPrimitive.Positioner.Props["align"];
	alignOffset?: MenuPrimitive.Positioner.Props["alignOffset"];
	sideOffset?: MenuPrimitive.Positioner.Props["sideOffset"];
}) => {
	return (
		<MenuPopup
			align={align}
			alignOffset={alignOffset}
			className={className}
			data-slot='menu-sub-content'
			sideOffset={sideOffset}
			{...props}
		/>
	);
};

export {
	Menu,
	Menu as DropdownMenu,
	MenuPortal,
	MenuPortal as DropdownMenuPortal,
	MenuTrigger,
	MenuTrigger as DropdownMenuTrigger,
	MenuPopup,
	MenuPopup as DropdownMenuContent,
	MenuGroup,
	MenuGroup as DropdownMenuGroup,
	MenuItem,
	MenuItem as DropdownMenuItem,
	MenuCheckboxItem,
	MenuCheckboxItem as DropdownMenuCheckboxItem,
	MenuRadioGroup,
	MenuRadioGroup as DropdownMenuRadioGroup,
	MenuRadioItem,
	MenuRadioItem as DropdownMenuRadioItem,
	MenuGroupLabel,
	MenuGroupLabel as DropdownMenuLabel,
	MenuSeparator,
	MenuSeparator as DropdownMenuSeparator,
	MenuShortcut,
	MenuShortcut as DropdownMenuShortcut,
	MenuSub,
	MenuSub as DropdownMenuSub,
	MenuSubTrigger,
	MenuSubTrigger as DropdownMenuSubTrigger,
	MenuSubPopup,
	MenuSubPopup as DropdownMenuSubContent,
};
