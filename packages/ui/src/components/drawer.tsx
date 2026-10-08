"use client";

import { Fragment, createContext, use, useMemo, useState } from "react";
import type { ComponentProps, ReactNode } from "react";

import { useDirection } from "@base-ui/react/direction-provider";
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { Tick02Icon, ArrowRight01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cva } from "class-variance-authority";

import { cn } from "../lib/utils";
import { ScrollArea } from "./scroll-area";

const drawerViewportVariants = cva("fixed inset-0 z-60 flex touch-manipulation", {
	variants: {
		position: {
			bottom: "items-end justify-center",
			left: "items-stretch justify-start rtl:justify-end",
			right: "items-stretch justify-end rtl:justify-start",
			top: "items-start justify-center",
		},
	},
});

const drawerMenuSwitchVariants = cva(
	"inline-flex h-4.5 w-7.5 shrink-0 rounded-full p-px inset-shadow-[0_1px_--theme(--color-black/4%)] transition-colors",
	{ variants: { checked: { false: "bg-input", true: "bg-primary" } } }
);

const drawerMenuSwitchThumbVariants = cva(
	"block size-4 rounded-full bg-background smooth-shadow-sm transition-transform",
	{ variants: { checked: { false: "translate-x-0", true: "translate-x-3 rtl:-translate-x-3" } } }
);

const drawerMenuCheckboxIndicatorVariants = cva(
	"flex size-4 shrink-0 items-center justify-center rounded-lg border border-input transition-colors",
	{ variants: { checked: { false: "bg-background", true: "border-primary bg-primary text-primary-foreground" } } }
);

const drawerMenuRadioItemVariants = cva(
	"flex size-4 shrink-0 items-center justify-center rounded-full border border-input",
	{ variants: { checked: { false: "bg-background", true: "border-primary bg-primary text-primary-foreground" } } }
);

const drawerBarVariants = cva("flex justify-center px-4 pt-3", {
	variants: { variant: { default: null, muted: "bg-muted/30" } },
});

const drawerPopupVariants = cva(
	"pointer-events-auto relative flex min-h-0 flex-col bg-popover text-popover-foreground outline-none will-change-transform transition-[transform,box-shadow,opacity] duration-350 ease-[var(--ease-drawer)] data-swiping:transition-none data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*350ms)] before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit]",
	{
		compoundVariants: [
			{
				class: "rounded-none smooth-shadow-none before:hidden",
				variant: "straight",
			},
			{
				class: "sm:mb-2 sm:max-w-3xl sm:rounded-3xl sm:border-b",
				position: "bottom",
				variant: "inset",
			},
			{
				class: "sm:mt-2 sm:max-w-3xl sm:rounded-3xl sm:border-t",
				position: "top",
				variant: "inset",
			},
			{
				class: "m-2 h-[calc(100dvh-1rem)] rounded-3xl",
				position: ["left", "right"],
				variant: "inset",
			},
		],
		variants: {
			position: {
				bottom: [
					"w-full max-h-[min(90dvh,calc(100dvh-1rem))] rounded-t-3xl",
					"origin-bottom [--drawer-stack-progress:clamp(0,var(--drawer-swipe-progress,0),1)] [--drawer-stack-scale:clamp(0,calc(1-(var(--nested-drawers,0)-var(--drawer-stack-progress))*0.05),1)] [--drawer-stack-peek:max(0px,calc((var(--nested-drawers,0)-var(--drawer-stack-progress))*1rem))] [--drawer-stack-shrink:calc(1-var(--drawer-stack-scale))] [--drawer-stack-height:var(--drawer-frontmost-height,var(--drawer-height,0px))]",
					"transform-[translate3d(0,calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y,0px)-var(--drawer-stack-peek)-(var(--drawer-stack-shrink)*var(--drawer-stack-height))),0)_scale(var(--drawer-stack-scale))]",
					"data-starting-style:transform-[translateY(100%)]",
					"data-ending-style:transform-[translateY(100%)]",
				],
				left: [
					"h-full w-full max-w-2xl",
					"transform-[translate3d(var(--drawer-swipe-movement-x,0px),0,0)]",
					"data-starting-style:transform-[translateX(-100%)]",
					"data-ending-style:transform-[translateX(-100%)]",
				],
				right: [
					"h-full w-full max-w-2xl",
					"transform-[translate3d(var(--drawer-swipe-movement-x,0px),0,0)]",
					"data-starting-style:transform-[translateX(100%)]",
					"data-ending-style:transform-[translateX(100%)]",
				],
				top: [
					"w-full max-h-[min(90dvh,calc(100dvh-1rem))] rounded-b-3xl",
					"transform-[translate3d(0,var(--drawer-swipe-movement-y,0px),0)]",
					"data-starting-style:transform-[translateY(-100%)]",
					"data-ending-style:transform-[translateY(-100%)]",
				],
			},
			variant: {
				default: "smooth-shadow-ring-xl",
				inset: "smooth-shadow-ring-xl",
				straight: null,
			},
		},
	}
);

const drawerHeaderVariants = cva("flex w-full min-w-0 flex-col gap-1 px-4 pb-4 pt-4 text-center sm:text-start", {
	variants: { variant: { default: null, profile: "gap-5 bg-muted/30 px-6 md:gap-6 md:px-14 md:pb-8 md:pt-14" } },
});

const drawerFooterVariants = cva("mt-auto flex flex-col-reverse gap-3 px-4 py-4 sm:flex-row sm:justify-end", {
	variants: { variant: { bare: null, default: "border-t bg-popover" } },
});

const drawerTitleVariants = cva("font-heading leading-none w-fit justify-start items-start text-start", {
	variants: { multiline: { true: "leading-7" }, size: { default: null, lg: "text-xl font-semibold" } },
});

const drawerPanelVariants = cva("min-h-0 flex-1 px-4 pb-4", {
	variants: {
		padding: { default: null, none: "px-0 pb-0", spacious: "px-6 pt-6 sm:px-14" },
		variant: { default: null, surface: "bg-popover" },
	},
});

const drawerMenuItemVariants = cva("", {
	variants: { variant: { default: null, destructive: "text-destructive hover:text-destructive" } },
});

type DrawerPosition = "right" | "left" | "top" | "bottom";

type DrawerSwipeDirection = "up" | "down" | "left" | "right";

const drawerSwipeDirections = {
	bottom: "down",
	left: "left",
	right: "right",
	top: "up",
} satisfies Record<DrawerPosition, DrawerSwipeDirection>;

type DrawerContextValue = {
	modal: boolean;
	position: DrawerPosition;
	swipeDirection: DrawerSwipeDirection;
};

const DrawerContext = createContext<DrawerContextValue>({
	modal: true,
	position: "bottom",
	swipeDirection: "down",
});

const useDrawerContext = () => use(DrawerContext);

type DrawerProps = DrawerPrimitive.Root.Props & {
	position?: DrawerPosition | "start" | "end";
};

const Drawer = ({ position: positionProp = "bottom", swipeDirection, ...props }: DrawerProps) => {
	const direction = useDirection();

	const logicalPositions = {
		end: direction === "rtl" ? "left" : "right",
		start: direction === "rtl" ? "right" : "left",
	} satisfies Record<string, DrawerPosition>;

	const position = positionProp === "start" || positionProp === "end" ? logicalPositions[positionProp] : positionProp;
	const resolvedSwipeDirection = swipeDirection ?? drawerSwipeDirections[position];
	const modal = props.modal !== false;

	const contextValue = useMemo(
		() => ({
			modal,
			position,
			swipeDirection: resolvedSwipeDirection,
		}),
		[modal, position, resolvedSwipeDirection]
	);

	return (
		<DrawerContext.Provider value={contextValue}>
			<DrawerPrimitive.Root
				data-position={position}
				data-slot='drawer'
				swipeDirection={resolvedSwipeDirection}
				{...props}
			/>
		</DrawerContext.Provider>
	);
};

const DrawerTrigger = (props: DrawerPrimitive.Trigger.Props) => {
	return <DrawerPrimitive.Trigger data-slot='drawer-trigger' {...props} />;
};

const DrawerPortal = (props: DrawerPrimitive.Portal.Props) => {
	return <DrawerPrimitive.Portal {...props} />;
};

const DrawerClose = (props: DrawerPrimitive.Close.Props) => {
	return <DrawerPrimitive.Close data-slot='drawer-close' {...props} />;
};

const DrawerBackdrop = ({ className, ...props }: DrawerPrimitive.Backdrop.Props) => {
	return (
		<DrawerPrimitive.Backdrop
			className={cn(
				"fixed inset-0 z-60 bg-foreground/32 transition-opacity dark:bg-black/56 duration-350 ease-[var(--ease-drawer)] data-ending-style:opacity-0 data-starting-style:opacity-0",
				"data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*350ms)]",
				"[--backdrop-opacity:0.32] opacity-[calc(var(--backdrop-opacity)*(1-var(--drawer-swipe-progress,0)))]",
				"data-swiping:transition-none",
				className
			)}
			data-slot='drawer-backdrop'
			{...props}
		/>
	);
};

const DrawerViewport = ({ className, ...props }: DrawerPrimitive.Viewport.Props) => {
	const { modal, position } = useDrawerContext();

	return (
		<DrawerPrimitive.Viewport
			className={cn(drawerViewportVariants({ position }), !modal && "pointer-events-none", className)}
			data-position={position}
			data-slot='drawer-viewport'
			{...props}
		/>
	);
};

const DrawerBar = ({
	className,
	variant = "default",
	...props
}: ComponentProps<"div"> & { variant?: "default" | "muted" }) => {
	return (
		<div className={cn(drawerBarVariants({ variant }))} data-slot='drawer-bar-wrap'>
			<div className={cn("h-1 w-12 rounded-full bg-border", className)} data-slot='drawer-bar' {...props} />
		</div>
	);
};

type DrawerPopupProps = DrawerPrimitive.Popup.Props & {
	backdropClassName?: string;
	barVariant?: "default" | "muted";
	closeLabel?: string;
	showBar?: boolean;
	showCloseButton?: boolean;
	variant?: "default" | "straight" | "inset";
};

const DrawerPopup = ({
	backdropClassName,
	barVariant = "default",
	children,
	className,
	closeLabel = "Close",
	ref,
	showBar = false,
	showCloseButton = false,
	variant = "default",
	...props
}: DrawerPopupProps) => {
	const { modal, position } = useDrawerContext();
	const isBottom = position === "bottom";
	const isTop = position === "top";
	const isVertical = isBottom || isTop;
	const KeyboardBoundary = isBottom ? DrawerPrimitive.VirtualKeyboardProvider : Fragment;

	return (
		<DrawerPortal>
			{modal ? <DrawerBackdrop className={backdropClassName} /> : null}
			<KeyboardBoundary>
				<DrawerViewport>
					<DrawerPrimitive.Popup
						className={cn(drawerPopupVariants({ position, variant }), className)}
						data-position={position}
						data-slot='drawer-popup'
						data-variant={variant}
						ref={ref}
						{...props}
					>
						<DrawerPrimitive.Content className='contents' data-slot='drawer-content'>
							{showBar && isVertical ? <DrawerBar variant={barVariant} /> : null}
							{children}
							{showCloseButton ? (
								<DrawerPrimitive.Close className="absolute inset-e-3 top-3 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent opacity-72 outline-none transition-[background-color,box-shadow,opacity] hover:bg-accent hover:opacity-100 pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
									<HugeiconsIcon
										aria-hidden='true'
										className='scale-110'
										icon={Cancel01Icon}
										strokeWidth={1.75}
									/>
									<span className='sr-only'>{closeLabel}</span>
								</DrawerPrimitive.Close>
							) : null}
						</DrawerPrimitive.Content>
					</DrawerPrimitive.Popup>
				</DrawerViewport>
			</KeyboardBoundary>
		</DrawerPortal>
	);
};

const withOptionalSelection = ({ allowSelection, children }: { allowSelection: boolean; children: ReactNode }) => {
	if (!allowSelection) {
		return children;
	}

	return <DrawerPrimitive.Content className='contents'>{children}</DrawerPrimitive.Content>;
};

const DrawerHeader = ({
	allowSelection = false,
	className,
	variant = "default",
	...props
}: ComponentProps<"div"> & {
	allowSelection?: boolean;
	variant?: "default" | "profile";
}) => {
	return withOptionalSelection({
		allowSelection,
		children: (
			<div className={cn(drawerHeaderVariants({ variant }), className)} data-slot='drawer-header' {...props} />
		),
	});
};

const DrawerFooter = ({
	allowSelection = true,
	className,
	variant = "default",
	...props
}: ComponentProps<"div"> & {
	allowSelection?: boolean;
	variant?: "default" | "bare";
}) => {
	return withOptionalSelection({
		allowSelection,
		children: (
			<div
				className={cn(drawerFooterVariants({ variant }), className)}
				data-slot='drawer-footer'
				data-variant={variant}
				{...props}
			/>
		),
	});
};

const DrawerTitle = ({
	className,
	multiline = false,
	size = "default",
	...props
}: DrawerPrimitive.Title.Props & { multiline?: boolean; size?: "default" | "lg" }) => {
	return (
		<DrawerPrimitive.Title
			className={cn(drawerTitleVariants({ multiline, size }), className)}
			data-slot='drawer-title'
			{...props}
		/>
	);
};

const DrawerDescription = ({ className, ...props }: DrawerPrimitive.Description.Props) => {
	return (
		<DrawerPrimitive.Description
			className={cn("text-sm text-muted-foreground w-fit justify-start", className)}
			data-slot='drawer-description'
			{...props}
		/>
	);
};

type DrawerPanelProps = ComponentProps<"div"> & {
	allowSelection?: boolean;
	padding?: "default" | "none" | "spacious";
	scrollable?: boolean;
	scrollFade?: boolean;
	variant?: "default" | "surface";
};

const DrawerPanel = ({
	allowSelection = true,
	children,
	className,
	padding = "default",
	scrollable = true,
	scrollFade = true,
	variant = "default",
	...props
}: DrawerPanelProps) => {
	const panelClassName = cn(drawerPanelVariants({ padding, variant }), className);

	const content = scrollable ? (
		<ScrollArea className={panelClassName} data-slot='drawer-panel' scrollFade={scrollFade} {...props}>
			{children}
		</ScrollArea>
	) : (
		<div className={panelClassName} data-slot='drawer-panel' {...props}>
			{children}
		</div>
	);

	return withOptionalSelection({ allowSelection, children: content });
};

const drawerMenuItemClassName =
	"flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-64 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const DrawerMenu = ({ className, ...props }: ComponentProps<"div">) => {
	return <div className={cn("flex flex-col p-1", className)} data-slot='drawer-menu' {...props} />;
};

const DrawerMenuItem = ({
	className,
	ref,
	type = "button",
	variant = "default",
	...props
}: ComponentProps<"button"> & {
	variant?: "default" | "destructive";
}) => {
	return (
		<button
			className={cn(drawerMenuItemClassName, drawerMenuItemVariants({ variant }), className)}
			data-slot='drawer-menu-item'
			data-variant={variant}
			ref={ref}
			type={type}
			{...props}
		/>
	);
};

const DrawerMenuGroup = ({ className, ...props }: ComponentProps<"div">) => {
	return <div className={cn("flex flex-col", className)} data-slot='drawer-menu-group' {...props} />;
};

const DrawerMenuGroupLabel = ({ className, ...props }: ComponentProps<"div">) => {
	return (
		<div
			className={cn("px-3 py-2 text-xs font-medium text-muted-foreground", className)}
			data-slot='drawer-menu-group-label'
			{...props}
		/>
	);
};

const DrawerMenuTrigger = ({ children, className, ...props }: DrawerPrimitive.Trigger.Props) => {
	return (
		<DrawerTrigger className={cn(drawerMenuItemClassName, className)} {...props}>
			<span className='truncate'>{children}</span>
			<HugeiconsIcon
				aria-hidden='true'
				className='ms-auto size-4 text-muted-foreground scale-110'
				icon={ArrowRight01Icon}
				strokeWidth={1.75}
			/>
		</DrawerTrigger>
	);
};

type DrawerMenuCheckboxItemProps = Omit<ComponentProps<"button">, "onChange"> & {
	checked?: boolean;
	defaultChecked?: boolean;
	onCheckedChange?: (checked: boolean) => void;
	variant?: "default" | "switch";
};

const DrawerMenuCheckboxItem = ({
	checked: checkedProp,
	children,
	className,
	defaultChecked = false,
	onCheckedChange,
	onClick,
	type = "button",
	variant = "default",
	...props
}: DrawerMenuCheckboxItemProps) => {
	const [uncontrolledChecked, setUncontrolledChecked] = useState(defaultChecked);
	const checked = checkedProp ?? uncontrolledChecked;

	return (
		<button
			aria-checked={checked}
			className={cn(drawerMenuItemClassName, className)}
			data-slot='drawer-menu-checkbox-item'
			data-variant={variant}
			onClick={(event) => {
				const nextChecked = !checked;

				if (checkedProp === undefined) {
					setUncontrolledChecked(nextChecked);
				}

				onCheckedChange?.(nextChecked);
				onClick?.(event);
			}}
			role='menuitemcheckbox'
			type={type}
			{...props}
		>
			{variant === "switch" ? (
				<span aria-hidden='true' className={cn(drawerMenuSwitchVariants({ checked }))}>
					<span className={cn(drawerMenuSwitchThumbVariants({ checked }))} />
				</span>
			) : (
				<span aria-hidden='true' className={cn(drawerMenuCheckboxIndicatorVariants({ checked }))}>
					{checked ? (
						<HugeiconsIcon
							aria-hidden='true'
							className='size-3 scale-110'
							icon={Tick02Icon}
							strokeWidth={1.75}
						/>
					) : null}
				</span>
			)}
			<span className='min-w-0 flex-1 truncate'>{children}</span>
		</button>
	);
};

type DrawerMenuRadioGroupContextValue = {
	onValueChange?: (value: string) => void;
	value?: string;
};

const DrawerMenuRadioGroupContext = createContext<DrawerMenuRadioGroupContextValue>({});

type DrawerMenuRadioGroupProps = ComponentProps<"div"> & {
	defaultValue?: string;
	onValueChange?: (value: string) => void;
	value?: string;
};

const DrawerMenuRadioGroup = ({
	children,
	className,
	defaultValue,
	onValueChange,
	value: valueProp,
	...props
}: DrawerMenuRadioGroupProps) => {
	const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
	const value = valueProp ?? uncontrolledValue;

	const contextValue = useMemo<DrawerMenuRadioGroupContextValue>(
		() => ({
			onValueChange: (nextValue) => {
				if (valueProp === undefined) {
					setUncontrolledValue(nextValue);
				}

				onValueChange?.(nextValue);
			},
			value,
		}),
		[onValueChange, value, valueProp]
	);

	return (
		<DrawerMenuRadioGroupContext.Provider value={contextValue}>
			<div
				className={cn("flex flex-col", className)}
				data-slot='drawer-menu-radio-group'
				role='radiogroup'
				{...props}
			>
				{children}
			</div>
		</DrawerMenuRadioGroupContext.Provider>
	);
};

type DrawerMenuRadioItemProps = ComponentProps<"button"> & {
	value: string;
};

const DrawerMenuRadioItem = ({
	children,
	className,
	onClick,
	type = "button",
	value,
	...props
}: DrawerMenuRadioItemProps) => {
	const { onValueChange, value: selectedValue } = use(DrawerMenuRadioGroupContext);
	const checked = selectedValue === value;

	return (
		<button
			aria-checked={checked}
			className={cn(drawerMenuItemClassName, className)}
			data-slot='drawer-menu-radio-item'
			onClick={(event) => {
				onValueChange?.(value);
				onClick?.(event);
			}}
			role='menuitemradio'
			type={type}
			{...props}
		>
			<span aria-hidden='true' className={cn(drawerMenuRadioItemVariants({ checked }))}>
				{checked ? <span className='size-1.5 rounded-full bg-current' /> : null}
			</span>
			<span className='min-w-0 flex-1 truncate'>{children}</span>
		</button>
	);
};

const DrawerContent = (props: DrawerPrimitive.Content.Props) => {
	return <DrawerPrimitive.Content data-slot='drawer-content-primitive' {...props} />;
};

export {
	Drawer,
	DrawerBackdrop,
	DrawerBackdrop as DrawerOverlay,
	DrawerBar,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerMenu,
	DrawerMenuCheckboxItem,
	DrawerMenuGroup,
	DrawerMenuGroupLabel,
	DrawerMenuItem,
	DrawerMenuRadioGroup,
	DrawerMenuRadioItem,
	DrawerMenuTrigger,
	DrawerPanel,
	DrawerPopup,
	DrawerPortal,
	DrawerTitle,
	DrawerTrigger,
	DrawerViewport,
};
