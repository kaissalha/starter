"use client";

import type * as React from "react";

import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cva } from "class-variance-authority";

import { cn } from "@starter/ui/lib/utils";

const NavigationMenu = ({ children, className, ...props }: NavigationMenuPrimitive.Root.Props) => {
	return (
		<NavigationMenuPrimitive.Root
			className={cn(
				"group/navigation-menu relative flex max-w-max flex-1 items-center justify-center",
				className
			)}
			data-slot='navigation-menu'
			{...props}
		>
			{children}
			<NavigationMenuViewport />
		</NavigationMenuPrimitive.Root>
	);
};

const NavigationMenuList = ({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.List>) => {
	return (
		<NavigationMenuPrimitive.List
			className={cn("group flex flex-1 list-none items-center justify-center gap-1", className)}
			data-slot='navigation-menu-list'
			{...props}
		/>
	);
};

const NavigationMenuItem = ({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Item>) => {
	return (
		<NavigationMenuPrimitive.Item
			className={cn("relative", className)}
			data-slot='navigation-menu-item'
			{...props}
		/>
	);
};

const navigationMenuTriggerStyle = cva(
	"outline-ring/50 ring-ring/10 focus:text-accent-foreground data-popup-open:text-accent-foreground dark:outline-ring/40 dark:ring-ring/20 group inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 font-medium transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-50"
);

const NavigationMenuTrigger = ({
	children,
	className,
	...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Trigger>) => {
	return (
		<NavigationMenuPrimitive.Trigger
			className={cn(navigationMenuTriggerStyle(), "group", className)}
			data-slot='navigation-menu-trigger'
			{...props}
		>
			{children}{" "}
			<HugeiconsIcon
				aria-hidden='true'
				className='relative top-px ms-1 size-3 transition duration-300 group-data-popup-open:rotate-180 scale-110'
				icon={ArrowDown01Icon}
				strokeWidth={1.75}
			/>
		</NavigationMenuPrimitive.Trigger>
	);
};

const NavigationMenuContent = ({ className, ...props }: NavigationMenuPrimitive.Content.Props) => (
	<NavigationMenuPrimitive.Content
		className={cn(
			"w-max max-w-[min(36rem,calc(100vw-2rem))] p-2 pe-2.5 outline-none transition-[opacity,translate] duration-200 data-starting-style:opacity-0 data-ending-style:opacity-0 data-[activation-direction=left]:data-starting-style:-translate-x-8 data-[activation-direction=right]:data-starting-style:translate-x-8",
			className
		)}
		data-slot='navigation-menu-content'
		{...props}
	/>
);

const NavigationMenuViewport = ({ className, ...props }: NavigationMenuPrimitive.Viewport.Props) => (
	<NavigationMenuPrimitive.Portal>
		<NavigationMenuPrimitive.Positioner className='z-50 max-w-(--available-width)' sideOffset={6}>
			<NavigationMenuPrimitive.Popup className='relative h-(--popup-height) w-(--popup-width) origin-(--transform-origin) rounded-md bg-popover text-popover-foreground smooth-shadow-ring-md outline-none transition-[opacity,transform,width,height] duration-200 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0'>
				<NavigationMenuPrimitive.Viewport
					className={cn("relative size-full overflow-hidden", className)}
					data-slot='navigation-menu-viewport'
					{...props}
				/>
			</NavigationMenuPrimitive.Popup>
		</NavigationMenuPrimitive.Positioner>
	</NavigationMenuPrimitive.Portal>
);

const NavigationMenuLink = ({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Link>) => {
	return (
		<NavigationMenuPrimitive.Link
			className={cn(
				"outline-ring/50 ring-ring/10 hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-active:bg-accent/50 data-active:text-accent-foreground data-active:hover:bg-accent data-active:focus:bg-accent dark:outline-ring/40 dark:ring-ring/20 [&_svg:not([class*='text-'])]:text-muted-foreground flex flex-col gap-1 rounded-sm p-2 transition-[color,box-shadow] [&_svg:not([class*='size-'])]:size-4",
				className
			)}
			data-slot='navigation-menu-link'
			{...props}
		/>
	);
};

export {
	NavigationMenu,
	NavigationMenuList,
	NavigationMenuItem,
	NavigationMenuContent,
	NavigationMenuTrigger,
	NavigationMenuLink,
	NavigationMenuViewport,
	navigationMenuTriggerStyle,
};
