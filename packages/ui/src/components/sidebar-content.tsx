"use client";

import { useRender } from "@base-ui/react/use-render";
import { cva } from "class-variance-authority";

import { cn } from "@starter/ui/lib/utils";

import { Input } from "./input";
import { Separator } from "./separator";
import type { CSSPropertiesWithVariables } from "./sidebar";
import { Skeleton } from "./skeleton";

const sidebarMenuActionVariants = cva(
	[
		"outline-hidden absolute inset-e-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0",
		"after:absolute after:-inset-2 md:after:hidden",
		"peer-data-[size=sm]/menu-button:top-1",
		"peer-data-[size=default]/menu-button:top-1.5",
		"peer-data-[size=lg]/menu-button:top-2.5",
		"group-data-[collapsible=icon]:hidden",
	],
	{
		variants: {
			showOnHover: {
				true: "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground md:opacity-0",
			},
		},
	}
);

const sidebarHeaderVariants = cva("flex flex-col gap-3 px-3 pt-4 group-data-[collapsible=icon]:px-2", {
	variants: { variant: { default: null, navigation: "md:px-2" } },
});

const sidebarFooterVariants = cva("flex flex-col gap-2 px-3 pb-4 group-data-[collapsible=icon]:px-2", {
	variants: { variant: { default: null, navigation: "max-md:p-2 md:px-2" } },
});

const sidebarContentVariants = cva(
	"flex min-h-0 flex-1 flex-col gap-2 overflow-auto px-3 py-4 group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=icon]:px-2",
	{ variants: { variant: { default: null, navigation: "max-md:py-2 max-md:pb-10 max-md:ps-2 md:px-2" } } }
);

const sidebarMenuSubButtonVariants = cva(
	"outline-hidden flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 rtl:translate-x-px [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden",
	{ variants: { size: { md: "text-sm", sm: "text-xs" } } }
);

export const SidebarInput = ({ "aria-label": ariaLabel, className, ...props }: React.ComponentProps<typeof Input>) => {
	return (
		<Input
			aria-label={ariaLabel}
			className={cn("h-8 w-full bg-background smooth-shadow-none", className)}
			data-sidebar='input'
			{...props}
		/>
	);
};

SidebarInput.displayName = "SidebarInput";

export const SidebarHeader = ({
	className,
	ref,
	variant = "default",
	...props
}: React.ComponentProps<"div"> & { variant?: "default" | "navigation" }) => {
	return (
		<div className={cn(sidebarHeaderVariants({ variant }), className)} data-sidebar='header' ref={ref} {...props} />
	);
};

SidebarHeader.displayName = "SidebarHeader";

export const SidebarFooter = ({
	className,
	ref,
	variant = "default",
	...props
}: React.ComponentProps<"div"> & { variant?: "default" | "navigation" }) => {
	return (
		<div className={cn(sidebarFooterVariants({ variant }), className)} data-sidebar='footer' ref={ref} {...props} />
	);
};

SidebarFooter.displayName = "SidebarFooter";

export const SidebarSeparator = ({ className, ...props }: React.ComponentProps<typeof Separator>) => {
	return <Separator className={cn("mx-2 w-auto bg-sidebar-border", className)} data-sidebar='separator' {...props} />;
};

SidebarSeparator.displayName = "SidebarSeparator";

export const SidebarContent = ({
	className,
	ref,
	variant = "default",
	...props
}: React.ComponentProps<"div"> & { variant?: "default" | "navigation" }) => {
	return (
		<div
			className={cn(sidebarContentVariants({ variant }), className)}
			data-sidebar='content'
			ref={ref}
			{...props}
		/>
	);
};

SidebarContent.displayName = "SidebarContent";

export const SidebarGroup = ({ className, ref, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			className={cn("relative flex w-full min-w-0 flex-col", className)}
			data-sidebar='group'
			ref={ref}
			{...props}
		/>
	);
};

SidebarGroup.displayName = "SidebarGroup";

export const SidebarGroupLabel = ({ className, ref, render, ...props }: useRender.ComponentProps<"div">) => {
	return useRender({
		defaultTagName: "div",
		props: {
			...props,
			className: cn(
				"outline-hidden flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-medium text-foreground/80 ring-sidebar-ring transition-[margin,opacity] duration-200 ease-linear [&>svg]:size-4 [&>svg]:shrink-0",
				"group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
				className
			),
			"data-sidebar": "group-label",
			"data-testid": "sidebar-group-label",
		},
		ref,
		render,
	});
};

SidebarGroupLabel.displayName = "SidebarGroupLabel";

export const SidebarGroupAction = ({ className, ref, render, ...props }: useRender.ComponentProps<"button">) => {
	return useRender({
		defaultTagName: "button",
		props: {
			...props,
			className: cn(
				"outline-hidden absolute inset-e-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0",
				"after:absolute after:-inset-2 md:after:hidden",
				"group-data-[collapsible=icon]:hidden",
				className
			),
			"data-sidebar": "group-action",
			"data-testid": "sidebar-group-action",
		},
		ref,
		render,
	});
};

SidebarGroupAction.displayName = "SidebarGroupAction";

export const SidebarGroupContent = ({ className, ref, ...props }: React.ComponentProps<"div">) => (
	<div
		className={cn("w-full text-sm", className)}
		data-sidebar='group-content'
		data-testid='sidebar-group-content'
		ref={ref}
		{...props}
	/>
);

SidebarGroupContent.displayName = "SidebarGroupContent";

export const SidebarMenu = ({ className, ref, ...props }: React.ComponentProps<"ul">) => (
	<ul
		className={cn("flex w-full min-w-0 flex-col gap-1", className)}
		data-sidebar='menu'
		data-testid='sidebar-menu'
		ref={ref}
		{...props}
	/>
);

SidebarMenu.displayName = "SidebarMenu";

export const SidebarMenuItem = ({ className, ref, ...props }: React.ComponentProps<"li">) => {
	return (
		<li
			className={cn("group/menu-item relative", className)}
			data-sidebar='menu-item'
			data-testid='sidebar-menu-item'
			ref={ref}
			{...props}
		/>
	);
};

SidebarMenuItem.displayName = "SidebarMenuItem";

export const SidebarMenuAction = ({
	className,
	ref,
	render,
	showOnHover = false,
	...props
}: useRender.ComponentProps<"button"> & {
	showOnHover?: boolean;
}) => {
	return useRender({
		defaultTagName: "button",
		props: {
			...props,
			className: cn(sidebarMenuActionVariants({ showOnHover }), className),
			"data-sidebar": "menu-action",
			"data-testid": "sidebar-menu-action",
		},
		ref,
		render,
	});
};

SidebarMenuAction.displayName = "SidebarMenuAction";

export const SidebarMenuBadge = ({ className, ref, ...props }: React.ComponentProps<"div">) => (
	<div
		className={cn(
			"pointer-events-none absolute inset-e-1 flex h-5 min-w-5 select-none items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums text-sidebar-foreground",
			"peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
			"peer-data-[size=sm]/menu-button:top-1",
			"peer-data-[size=default]/menu-button:top-1.5",
			"peer-data-[size=lg]/menu-button:top-2.5",
			"group-data-[collapsible=icon]:hidden",
			className
		)}
		data-sidebar='menu-badge'
		ref={ref}
		{...props}
	/>
);

SidebarMenuBadge.displayName = "SidebarMenuBadge";

export const SidebarMenuSkeleton = ({
	className,
	ref,
	showIcon = false,

	width = "70%",
	...props
}: React.ComponentProps<"div"> & {
	showIcon?: boolean;
	width?: string;
}) => {
	const skeletonStyle: CSSPropertiesWithVariables = {
		"--skeleton-width": width,
	};

	return (
		<div
			className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
			data-sidebar='menu-skeleton'
			ref={ref}
			{...props}
		>
			{showIcon && <Skeleton className='size-4 rounded-md' data-sidebar='menu-skeleton-icon' />}
			<Skeleton
				className='max-w-(--skeleton-width) h-4 flex-1'
				data-sidebar='menu-skeleton-text'
				style={skeletonStyle}
			/>
		</div>
	);
};

SidebarMenuSkeleton.displayName = "SidebarMenuSkeleton";

export const SidebarMenuSub = ({ className, ref, ...props }: React.ComponentProps<"ul">) => (
	<ul
		className={cn(
			"mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-s border-sidebar-border px-2.5 py-0.5 rtl:-translate-x-px",
			"group-data-[collapsible=icon]:hidden",
			className
		)}
		data-sidebar='menu-sub'
		ref={ref}
		{...props}
	/>
);

SidebarMenuSub.displayName = "SidebarMenuSub";

export const SidebarMenuSubItem = ({ ref, ...props }: React.ComponentProps<"li">) => <li ref={ref} {...props} />;

SidebarMenuSubItem.displayName = "SidebarMenuSubItem";

export const SidebarMenuSubButton = ({
	className,
	isActive,
	ref,
	render,
	size = "md",
	...props
}: useRender.ComponentProps<"a"> & {
	isActive?: boolean;
	size?: "sm" | "md";
}) => {
	return useRender({
		defaultTagName: "a",
		props: {
			...props,
			className: cn(sidebarMenuSubButtonVariants({ size }), className),
			"data-active": isActive,
			"data-sidebar": "menu-sub-button",
			"data-size": size,
		},
		ref,
		render,
	});
};

SidebarMenuSubButton.displayName = "SidebarMenuSubButton";
