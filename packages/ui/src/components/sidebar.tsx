"use client";

import { type Context, createContext, use, useCallback, useEffect, useMemo, useState } from "react";

import { useRender } from "@base-ui/react/use-render";
import { Menu01Icon, PanelLeftIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cva, type VariantProps } from "class-variance-authority";
import { useMedia } from "use-media";
import { z } from "zod";

import { screens } from "@starter/ui/hooks/use-breakpoint";
import { useIsMobile } from "@starter/ui/hooks/use-is-mobile";
import { useIsTouchDevice } from "@starter/ui/hooks/use-is-touch-device";
import { cn } from "@starter/ui/lib/utils";

import { Button } from "./button";
import { MobileSidebar, type MobileSidebarPeek } from "./mobile-sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

const sidebarSpacerVariants = cva(
	"w-(--sidebar-width) relative h-full bg-transparent transition-[width] duration-200 ease-linear group-data-[collapsible=offcanvas]:w-0 group-data-[side=right]:rotate-180",
	{
		variants: {
			variant: {
				floating: "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]",
				inset: "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]",
				sidebar: "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
			},
		},
	}
);

const sidebarProviderVariants = cva(
	"group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex h-full w-full flex-1",
	{ variants: { surface: { canvas: "bg-background", default: null } } }
);

const sidebarVariants = cva("", {
	variants: {
		border: {
			default: null,
			editor: "group-has-[[data-dashboard-editor]]/sidebar-wrapper:border-transparent",
			none: "border-0",
		},
		surface: {
			canvas: "bg-background **:data-[sidebar=sidebar]:bg-background",
			default: null,
			sidebar: "bg-sidebar",
		},
	},
});

const sidebarPanelVariants = cva(
	"w-(--sidebar-width) absolute inset-y-0 z-10 hidden transition-[width,left,right] duration-200 ease-linear md:flex",
	{
		compoundVariants: [
			{ class: "border-r", side: "left", variant: "sidebar" },
			{ class: "border-l", side: "right", variant: "sidebar" },
		],
		variants: {
			side: {
				left: "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]",
				right: "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
			},
			variant: {
				floating: "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]",
				inset: "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]",
				sidebar: "border-sidebar-border group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
			},
		},
	}
);

const SIDEBAR_WIDTH_ICON = "3rem";

const SIDEBAR_KEYBOARD_SHORTCUT = "b";

const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type CSSPropertiesWithVariables = React.CSSProperties & {
	[key: `--${string}`]: string | number | undefined;
};

type SidebarPurpose = "navigation" | "chat" | "details";

type Side = "left" | "right";

type SidebarCollapsible = "offcanvas" | "icon" | "none";

const SIDEBAR_WIDTH_BY_PURPOSE = {
	chat: "30rem",
	details: "30rem",
	navigation: "15rem",
} satisfies Record<SidebarPurpose, string>;

const getSideFromPurpose = (purpose: SidebarPurpose, dir: "ltr" | "rtl" = "ltr"): Side => {
	if (purpose === "navigation") {
		return dir === "ltr" ? "left" : "right";
	}

	return dir === "ltr" ? "right" : "left";
};

type SidebarOpenOptions = {
	closeOthers?: boolean;
};

type SidebarSetOpenFn = (open: boolean, options?: SidebarOpenOptions) => void;

type SidebarContext = {
	isMobile: boolean;
	open: boolean;
	openMobile: boolean;
	purpose: SidebarPurpose;
	setOpen: SidebarSetOpenFn;
	setOpenMobile: SidebarSetOpenFn;
	side: Side;
	state: "expanded" | "collapsed";
	toggleSidebar: () => void;
};

const SidebarContext = createContext<SidebarContext | null>(null);

const sidebarContextRegistry = new Map<string, Context<SidebarContext | null>>();

sidebarContextRegistry.set("navigation", SidebarContext);

type SidebarSetters = {
	setOpen: (open: boolean) => void;
	setOpenMobile: (open: boolean) => void;
};

const sidebarSettersRegistry = new Map<SidebarPurpose, SidebarSetters>();

const getSidebarContext = (purpose: SidebarPurpose) => {
	const existingContext = sidebarContextRegistry.get(purpose);

	if (existingContext) {
		return existingContext;
	}

	const sidebarContext = createContext<SidebarContext | null>(null);
	sidebarContextRegistry.set(purpose, sidebarContext);

	return sidebarContext;
};

const CurrentSidebarPurposeContext = createContext<SidebarPurpose | null>(null);

const useSidebar = (purpose?: SidebarPurpose) => {
	const currentPurpose = use(CurrentSidebarPurposeContext);
	const resolvedPurpose = purpose ?? currentPurpose;

	if (!resolvedPurpose) {
		throw new Error("useSidebar must be used within a Sidebar or provide a purpose argument.");
	}

	const context = use(getSidebarContext(resolvedPurpose));

	if (!context) {
		throw new Error("useSidebar must be used within a SidebarProvider.");
	}

	return context;
};

const SidebarProvider = ({
	children,
	className,
	defaultOpen = true,
	dir = "ltr",
	keyboardShortcut = true,
	onOpenChange,
	purpose = "navigation",
	ref,
	style,
	surface = "default",
	...props
}: React.ComponentProps<"div"> & {
	defaultOpen?: boolean;
	dir?: "ltr" | "rtl";
	keyboardShortcut?: boolean;

	onOpenChange?: (open: boolean) => void;

	purpose?: SidebarPurpose;
	surface?: "default" | "canvas";
}) => {
	const isMobile = useIsMobile();
	const [openMobile, _setOpenMobile] = useState(false);

	const side = getSideFromPurpose(purpose, dir);

	const [open, _setOpen] = useState(defaultOpen);

	const internalSetOpen = useCallback(
		(value: boolean) => {
			_setOpen(value);
			document.cookie = `sidebar_state_${purpose}=${value}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`;
			onOpenChange?.(value);
		},
		[purpose, onOpenChange]
	);

	useEffect(() => {
		sidebarSettersRegistry.set(purpose, {
			setOpen: internalSetOpen,
			setOpenMobile: _setOpenMobile,
		});

		return () => {
			sidebarSettersRegistry.delete(purpose);
		};
	}, [purpose, internalSetOpen]);

	const closeOtherSidebars = useCallback(() => {
		sidebarSettersRegistry.forEach((setters, key) => {
			if (key !== purpose) {
				setters.setOpen(false);
				setters.setOpenMobile(false);
			}
		});
	}, [purpose]);

	const setOpen: SidebarSetOpenFn = useCallback(
		(value, options) => {
			if (options?.closeOthers) {
				closeOtherSidebars();
			}

			internalSetOpen(value);
		},
		[internalSetOpen, closeOtherSidebars]
	);

	const setOpenMobile: SidebarSetOpenFn = useCallback(
		(value, options) => {
			if (options?.closeOthers) {
				closeOtherSidebars();
			}

			_setOpenMobile(value);
		},
		[closeOtherSidebars]
	);

	const toggleSidebar = useCallback(() => {
		return isMobile ? setOpenMobile(!openMobile) : setOpen(!open);
	}, [isMobile, setOpen, setOpenMobile, open, openMobile]);

	useEffect(() => {
		if (!keyboardShortcut) {
			return;
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				toggleSidebar();
			}
		};

		window.addEventListener("keydown", handleKeyDown);

		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [keyboardShortcut, toggleSidebar]);

	const state = open ? "expanded" : "collapsed";

	const contextValue = useMemo<SidebarContext>(
		() => ({
			isMobile,
			open,
			openMobile,
			purpose,
			setOpen,
			setOpenMobile,
			side,
			state,
			toggleSidebar,
		}),
		[state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar, purpose, side]
	);

	const DynamicContext = getSidebarContext(purpose);

	const wrapperStyle: CSSPropertiesWithVariables = {
		"--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
		[`--sidebar-width-${purpose}`]: SIDEBAR_WIDTH_BY_PURPOSE[purpose],
		...style,
	};

	return (
		<DynamicContext.Provider value={contextValue}>
			<TooltipProvider delay={0}>
				<div
					className={cn(sidebarProviderVariants({ surface }), className)}
					ref={ref}
					style={wrapperStyle}
					{...props}
				>
					{children}
				</div>
			</TooltipProvider>
		</DynamicContext.Provider>
	);
};

SidebarProvider.displayName = "SidebarProvider";

const Sidebar = ({
	border = "default",
	children,
	className: customClassName,
	collapsible = "offcanvas",
	mobileModal = true,
	mobilePeek,
	mobilePosition,
	onMobileOpenChange,
	purpose = "navigation",
	ref,
	style,
	surface = "default",
	variant = "sidebar",
	...props
}: React.ComponentProps<"div"> & {
	border?: "default" | "none" | "editor";
	collapsible?: SidebarCollapsible;
	mobileModal?: boolean;
	mobilePeek?: MobileSidebarPeek;
	mobilePosition?: "bottom" | Side;
	onMobileOpenChange?: (open: boolean) => void;
	purpose?: SidebarPurpose;
	surface?: "canvas" | "default" | "sidebar";
	variant?: "sidebar" | "floating" | "inset";
}) => {
	const className = cn(sidebarVariants({ border, surface }), customClassName);
	const { side, state } = useSidebar(purpose);
	const knownMobile = useMedia({ maxWidth: screens.md - 1 });

	const sidebarWidthVar = `--sidebar-width-${purpose}`;

	const desktopStyle: CSSPropertiesWithVariables = {
		"--sidebar-width": `var(${sidebarWidthVar})`,
	};

	const panelStyle: CSSPropertiesWithVariables = {
		"--sidebar-width": `var(${sidebarWidthVar})`,
		...style,
	};

	if (collapsible === "none") {
		return (
			<CurrentSidebarPurposeContext.Provider value={purpose}>
				<div
					className={cn("flex h-full flex-col bg-sidebar text-sidebar-foreground", className)}
					ref={ref}
					style={{ width: `var(${sidebarWidthVar})`, ...style }}
					{...props}
				>
					{children}
				</div>
			</CurrentSidebarPurposeContext.Provider>
		);
	}

	return (
		<CurrentSidebarPurposeContext.Provider value={purpose}>
			<div className='md:hidden'>
				<MobileSidebar
					className={className}
					modal={mobileModal}
					onOpenChange={onMobileOpenChange}
					peek={mobilePeek}
					position={mobilePosition ?? side}
					purpose={purpose}
					style={style}
					{...props}
				>
					{children}
				</MobileSidebar>
			</div>
			<div
				className='group peer relative hidden text-sidebar-foreground md:block'
				data-collapsible={state === "collapsed" ? collapsible : ""}
				data-purpose={purpose}
				data-side={side}
				data-state={state}
				data-variant={variant}
				ref={ref}
			>
				{}
				<div className={cn(sidebarSpacerVariants({ variant }))} style={desktopStyle} />
				<div className={cn(sidebarPanelVariants({ side, variant }), className)} style={panelStyle} {...props}>
					<div
						className='flex h-full w-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:smooth-shadow-ring-sm group-data-[variant=floating]:smooth-ring-sidebar-border'
						data-sidebar='sidebar'
					>
						{knownMobile ? null : children}
					</div>
				</div>
			</div>
		</CurrentSidebarPurposeContext.Provider>
	);
};

Sidebar.displayName = "Sidebar";

const SidebarTrigger = ({
	children,
	className,
	label,
	onClick,
	purpose,
	ref,
	...props
}: React.ComponentProps<typeof Button> & { label?: string; purpose: SidebarPurpose }) => {
	const { toggleSidebar } = useSidebar(purpose);

	return (
		<Button
			className={className}
			data-sidebar='trigger'
			onClick={(event) => {
				onClick?.(event);
				toggleSidebar();
			}}
			ref={ref}
			size='icon'
			variant='ghost'
			{...props}
		>
			{children ?? (
				<>
					<HugeiconsIcon
						aria-hidden='true'
						className='md:hidden scale-110'
						icon={Menu01Icon}
						strokeWidth={1.75}
					/>
					<HugeiconsIcon
						aria-hidden='true'
						className='hidden md:block scale-110'
						icon={PanelLeftIcon}
						strokeWidth={1.75}
					/>
				</>
			)}
			<span className='sr-only'>Toggle Sidebar</span>
			{label && <span className='ms-3 md:hidden'>{label}</span>}
		</Button>
	);
};

SidebarTrigger.displayName = "SidebarTrigger";

const SidebarRail = ({ className, ref, ...props }: React.ComponentProps<"button">) => {
	const { toggleSidebar } = useSidebar();

	return (
		<button
			aria-label='Toggle Sidebar'
			className={cn(
				"absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-colors duration-150 after:absolute after:inset-y-0 after:inset-s-1/2 after:w-0.5 hover:after:bg-sidebar-border group-data-[side=left]:-inset-e-4 group-data-[side=right]:inset-s-0 sm:flex",
				"in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
				"[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
				"group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:start-full hover:group-data-[collapsible=offcanvas]:bg-sidebar",
				"[[data-side=left][data-collapsible=offcanvas]_&]:-inset-e-2",
				"[[data-side=right][data-collapsible=offcanvas]_&]:-inset-s-2",
				className
			)}
			data-sidebar='rail'
			onClick={toggleSidebar}
			ref={ref}
			tabIndex={-1}
			title='Toggle Sidebar'
			type='button'
			{...props}
		/>
	);
};

SidebarRail.displayName = "SidebarRail";

const SidebarInset = ({ className, ref, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			className={cn(
				"relative flex min-w-0 flex-1 flex-col bg-background max-h-dvh md:h-full md:overflow-auto",
				className
			)}
			ref={ref}
			{...props}
		/>
	);
};

SidebarInset.displayName = "SidebarInset";

const sidebarMenuButtonVariants = cva(
	"peer/menu-button outline-hidden duration-420 ease-[cubic-bezier(0.22,1,0.36,1)] [&_[data-sidebar-label]]:duration-[420ms] [&_[data-sidebar-label]]:ease-[cubic-bezier(0.22,1,0.36,1)] [&>svg]:duration-420 [&>svg]:ease-[cubic-bezier(0.22,1,0.36,1)] flex w-fit items-center overflow-hidden text-start font-medium ring-sidebar-ring transition-[background,color,width,height,padding] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 md:h-8 [&>svg]:size-5 [&>svg]:shrink-0 [&>svg]:transition-[width,height,transform] md:[&>svg]:size-4 [&_[data-sidebar-label]]:inline-block [&_[data-sidebar-label]]:max-w-40 [&_[data-sidebar-label]]:overflow-hidden [&_[data-sidebar-label]]:truncate [&_[data-sidebar-label]]:whitespace-nowrap [&_[data-sidebar-label]]:transition-[max-width,opacity] group-data-[collapsible=icon]:[&_[data-sidebar-label]]:max-w-0 group-data-[collapsible=icon]:[&_[data-sidebar-label]]:opacity-0",
	{
		defaultVariants: {
			size: "default",
			variant: "default",
		},
		variants: {
			size: {
				default:
					"group-has-data-[sidebar=menu-action]/menu-item:pe-8 group-data-[collapsible=icon]:h-8! group-data-[collapsible=icon]:gap-0! group-data-[collapsible=icon]:rounded-lg! group-data-[collapsible=icon]:px-2! group-data-[collapsible=icon]:py-2! gap-1 rounded-2xl px-3 py-2 text-base has-[>svg:first-child]:pe-4 has-[>svg:last-child]:ps-4 group-has-[[data-sidebar=menu-action]]/menu-item:pe-8 md:rounded-xl md:px-2 md:py-1 md:text-sm md:has-[>svg:first-child]:pe-3 md:has-[>svg:last-child]:ps-3",
			},
			variant: {
				default:
					"text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground",
				outline:
					"bg-background ring-1 ring-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:ring-sidebar-accent",
			},
		},
	}
);

const sidebarMenuTooltipSchema = z.compile(
	z.union([
		z.string().transform((children) => ({ children })),
		z.custom<React.ComponentProps<typeof TooltipContent>>(),
	])
);

const SidebarMenuButton = ({
	className,
	isActive = false,
	ref,
	render,
	size = "default",
	tooltip,
	variant = "default",
	...props
}: useRender.ComponentProps<"button"> & {
	isActive?: boolean;
	tooltip?: string | React.ComponentProps<typeof TooltipContent>;
} & VariantProps<typeof sidebarMenuButtonVariants>) => {
	const { isMobile, state } = useSidebar();
	const isTouchDevice = useIsTouchDevice();

	const button = useRender({
		defaultTagName: "button",
		props: {
			...props,
			className: cn(sidebarMenuButtonVariants({ size, variant }), className),
			"data-active": isActive,
			"data-sidebar": "menu-button",
			"data-size": size,
			"data-testid": "sidebar-menu-button",
		},
		ref,
		render,
	});

	if (!tooltip) {
		return button;
	}

	const tooltipContent = sidebarMenuTooltipSchema.parse(tooltip);

	return (
		<Tooltip>
			<TooltipTrigger render={button} />
			<TooltipContent
				align='center'
				hidden={state !== "collapsed" || isMobile || isTouchDevice}
				side='right'
				{...tooltipContent}
			/>
		</Tooltip>
	);
};

SidebarMenuButton.displayName = "SidebarMenuButton";

export { Sidebar, SidebarInset, SidebarMenuButton, SidebarProvider, SidebarRail, SidebarTrigger, useSidebar };

export {
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInput,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuBadge,
	SidebarMenuItem,
	SidebarMenuSkeleton,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarSeparator,
} from "./sidebar-content";

export type { SidebarPurpose, Side, SidebarOpenOptions };
