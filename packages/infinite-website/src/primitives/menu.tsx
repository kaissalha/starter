"use client";

import { Children, cloneElement, useLayoutEffect, useState, type ReactElement, type ReactNode } from "react";

import { Accordion } from "@base-ui/react/accordion";
import { Dialog } from "@base-ui/react/dialog";
import { NavigationMenu } from "@base-ui/react/navigation-menu";
import { cn } from "cn";

import type { BoxAppearance, Edges, Layout, Length } from "../document/structure-schema";
import { appearance } from "./appearance";
import { layoutStyle, lengthToCss, paddingStyle } from "./layout";
import type { SiteLinkElementProps, SiteLinkProps } from "./shared";

type MenuItem = {
	id: string;
	link: ReactElement<SiteLinkProps>;
	linkElementProps?: SiteLinkElementProps;
	mobileLink: ReactElement<SiteLinkProps>;
	mobileTrigger?: ReactNode;
	panel?: ReactNode;
	trigger: ReactNode;
};

type MenuAlign = "start" | "center" | "end";

type MenuCollapseAt = "compact" | "medium" | "wide" | "always";

const MenuDivider = ({ className }: { className?: string }) => (
	<span aria-hidden className={cn("inline-block h-6 w-px shrink-0 self-center bg-current opacity-20", className)} />
);

const collapseClasses = (collapseAt: MenuCollapseAt) => {
	if (collapseAt === "always") {
		return {
			desktop: "hidden",
			desktopBrand: "",
			desktopChildren: "",
			mobile: "flex",
		};
	}

	if (collapseAt === "wide") {
		return {
			desktop: "@min-[90rem]/website-container:flex",
			desktopBrand: "@min-[90rem]/website-container:grow-0",
			desktopChildren: "@min-[90rem]/website-container:*:inline-flex",
			mobile: "@min-[90rem]/website-container:hidden",
		};
	}

	if (collapseAt === "medium") {
		return {
			desktop: "@5xl/website-container:flex",
			desktopBrand: "@5xl/website-container:grow-0",
			desktopChildren: "@5xl/website-container:*:inline-flex",
			mobile: "@5xl/website-container:hidden",
		};
	}

	return {
		desktop: "@2xl/website-container:flex",
		desktopBrand: "@2xl/website-container:grow-0",
		desktopChildren: "@2xl/website-container:*:inline-flex",
		mobile: "@2xl/website-container:hidden",
	};
};

const navListJustifyClass = (align: MenuAlign) => {
	if (align === "center") {
		return "justify-center";
	}

	if (align === "end") {
		return "ms-auto justify-end";
	}

	return "justify-start";
};

const MenuNavItem = ({
	item,
	itemAppearance,
}: {
	item: MenuItem;
	itemAppearance?: BoxAppearance & { padding?: Edges<Length> };
}) => {
	const itemVisual = appearance(itemAppearance ?? {});
	const itemStyle = { ...itemVisual.style, ...paddingStyle(itemAppearance?.padding) };

	if (item.panel && item.linkElementProps) {
		return (
			<NavigationMenu.Item>
				<button
					{...item.linkElementProps}
					className={cn(
						"flex items-center gap-1.5 bg-transparent",
						itemVisual.className,
						item.linkElementProps.className
					)}
					style={{ ...itemStyle, ...item.linkElementProps.style }}
					type='button'
				>
					{item.trigger}
				</button>
			</NavigationMenu.Item>
		);
	}

	if (item.panel) {
		return (
			<NavigationMenu.Item>
				<NavigationMenu.Trigger
					{...item.linkElementProps}
					className={cn(
						"flex items-center gap-1.5 bg-transparent",
						itemVisual.className,
						item.linkElementProps?.className
					)}
					style={{ ...itemStyle, ...item.linkElementProps?.style }}
				>
					{item.trigger}
				</NavigationMenu.Trigger>
				<NavigationMenu.Content className='flex flex-col'>{item.panel}</NavigationMenu.Content>
			</NavigationMenu.Item>
		);
	}

	if (item.linkElementProps) {
		return (
			<NavigationMenu.Item>
				{cloneElement(item.link, {
					...item.linkElementProps,
					className: cn(
						item.link.props.className,
						"flex items-center gap-1.5",
						itemVisual.className,
						item.linkElementProps.className
					),
					style: { ...item.link.props.style, ...itemStyle, ...item.linkElementProps.style },
				})}
			</NavigationMenu.Item>
		);
	}

	return (
		<NavigationMenu.Item>
			<NavigationMenu.Link
				className={cn("flex items-center gap-1.5", itemVisual.className)}
				render={item.link}
				style={itemStyle}
			/>
		</NavigationMenu.Item>
	);
};

const MobileMenu = ({
	actions,
	boundedToContainer,
	brand,
	closeLabel,
	items,
	menuOnRight,
	mobileClass,
	mobileLabel,
	popupAppearance,
	portalContainer,
	showDivider,
	socialActions,
	triggerAppearance,
}: {
	actions: ReactNode;
	boundedToContainer: boolean;
	brand: ReactNode;
	closeLabel: string;
	items: Array<MenuItem>;
	menuOnRight: boolean;
	mobileClass: string;
	mobileLabel: string;
	popupAppearance?: BoxAppearance & { padding?: Edges<Length> };
	portalContainer: HTMLElement | null;
	showDivider: boolean;
	socialActions?: ReactNode;
	triggerAppearance?: BoxAppearance;
}) => {
	const triggerVisual = appearance(triggerAppearance ?? {});
	const popupVisual = appearance(popupAppearance ?? {});

	return (
		<Dialog.Root>
			<div className={cn("flex items-center gap-4", mobileClass)}>
				{menuOnRight && showDivider && <MenuDivider />}
				<Dialog.Trigger
					aria-label={mobileLabel}
					className={cn(
						"inline-flex size-11 shrink-0 items-center justify-center bg-transparent",
						triggerVisual.className
					)}
					style={triggerVisual.style}
				>
					<svg aria-hidden className='size-6 fill-none stroke-current stroke-2' viewBox='0 0 16 12'>
						<path d='M1 1h14M1 6h14M1 11h14' />
					</svg>
				</Dialog.Trigger>
				{!menuOnRight && showDivider && <MenuDivider />}
			</div>
			<Dialog.Portal container={portalContainer}>
				<div
					className={cn("fixed z-40", !boundedToContainer && "inset-0")}
					data-website-mobile-menu-overlay=''
					style={
						boundedToContainer
							? {
									blockSize: "var(--website-menu-block-size)",
									inlineSize: "var(--website-menu-inline-size)",
									insetBlockStart: "var(--website-menu-inset-block-start)",
									insetInlineStart: "var(--website-menu-inset-inline-start)",
								}
							: undefined
					}
				>
					<Dialog.Backdrop className='absolute inset-0 bg-black/35 backdrop-blur-sm transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0' />
					<Dialog.Popup
						className={cn(
							"absolute inset-0 z-10 flex min-h-full flex-col overflow-hidden transition-[opacity,translate] duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
							menuOnRight
								? "data-[ending-style]:translate-x-4 data-[starting-style]:translate-x-4"
								: "data-[ending-style]:-translate-x-4 data-[starting-style]:-translate-x-4",
							popupVisual.className
						)}
						style={{ ...popupVisual.style, ...paddingStyle(popupAppearance?.padding) }}
					>
						<Dialog.Title className='sr-only'>{mobileLabel}</Dialog.Title>
						<div
							className={cn(
								"flex min-h-19 items-center gap-4 border-b border-current/15 px-6 py-4",
								menuOnRight && "flex-row-reverse"
							)}
						>
							<Dialog.Close
								aria-label={closeLabel}
								className='inline-flex size-11 shrink-0 items-center justify-center bg-transparent'
							>
								<svg
									aria-hidden
									className='size-6 fill-none stroke-current stroke-2'
									viewBox='0 0 16 16'
								>
									<path d='M2 2l12 12M14 2 2 14' />
								</svg>
							</Dialog.Close>
							{showDivider && !menuOnRight && <MenuDivider />}
							<div className={cn("flex min-w-0 flex-1 items-center", menuOnRight && "justify-start")}>
								{brand}
							</div>
						</div>
						<Accordion.Root className='flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-8' multiple>
							{items.map((item) => {
								if (item.panel) {
									return (
										<Accordion.Item key={item.id} value={item.id}>
											<Accordion.Header>
												<Accordion.Trigger
													{...item.linkElementProps}
													className={cn(
														"group flex w-full items-center justify-between gap-4 bg-transparent py-2 text-start",
														item.linkElementProps?.className
													)}
													style={item.linkElementProps?.style}
												>
													{item.mobileTrigger ?? item.trigger}
												</Accordion.Trigger>
											</Accordion.Header>
											<Accordion.Panel className='h-[var(--accordion-panel-height)] overflow-hidden transition-[height] duration-200 data-[ending-style]:h-0 data-[starting-style]:h-0'>
												<div className='flex flex-col gap-2 ps-6 pt-3'>{item.panel}</div>
											</Accordion.Panel>
										</Accordion.Item>
									);
								}

								if (item.linkElementProps) {
									return cloneElement(item.mobileLink, {
										...item.linkElementProps,
										className: cn(
											item.mobileLink.props.className,
											"flex py-2",
											item.linkElementProps.className
										),
										key: item.id,
										style: { ...item.mobileLink.props.style, ...item.linkElementProps.style },
									});
								}

								return (
									<Dialog.Close
										className='flex py-2'
										key={item.id}
										nativeButton={false}
										render={item.mobileLink}
									/>
								);
							})}
						</Accordion.Root>
						{(Children.toArray(socialActions).length > 0 || Children.toArray(actions).length > 0) && (
							<div className='flex flex-col gap-6 border-t border-current/15 px-6 py-8'>
								{Children.toArray(socialActions).length > 0 && (
									<div className='flex items-center gap-4'>{socialActions}</div>
								)}
								{Children.toArray(actions).length > 0 && (
									<div className='flex flex-col gap-3 [&>*]:w-full'>{actions}</div>
								)}
							</div>
						)}
					</Dialog.Popup>
				</div>
			</Dialog.Portal>
		</Dialog.Root>
	);
};

const MenuTrailingContent = ({
	actions,
	centered,
	desktopChildrenClass,
	desktopClass,
	menuOnRight,
	mobileMenu,
	socialActions,
}: {
	actions: ReactNode;
	centered: boolean;
	desktopChildrenClass: string;
	desktopClass: string;
	menuOnRight: boolean;
	mobileMenu: ReactNode;
	socialActions?: ReactNode;
}) => {
	const hasActions = Children.toArray(actions).length > 0;
	const hasSocial = Children.toArray(socialActions).length > 0;

	return (
		<div
			className={cn(
				"flex shrink-0 items-center justify-end gap-3",
				centered && "flex-1",
				!centered && !menuOnRight && "ms-auto"
			)}
			data-website-layout-occupied='actions'
		>
			{hasSocial && (
				<div className={cn("items-center gap-3", hasActions ? cn("hidden", desktopClass) : "flex")}>
					{socialActions}
				</div>
			)}
			{hasActions && (
				<div
					className={cn(
						"flex items-center gap-3 whitespace-nowrap [&_.iw-text]:whitespace-nowrap",
						"*:hidden *:first:inline-flex",
						desktopChildrenClass
					)}
				>
					{actions}
				</div>
			)}
			{menuOnRight && mobileMenu}
		</div>
	);
};

export const Menu = ({
	actions,
	align = "start",
	background,
	border,
	brand,
	closeLabel,
	collapseAt = "compact",
	fill,
	fillOpacity,
	foreground,
	itemAppearance,
	itemGap,
	items,
	label,
	layout,
	menuTriggerSide,
	mobileLabel,
	mobileTriggerAppearance,
	opacity,
	popupAppearance,
	radius,
	showMenuDivider = true,
	socialActions,
}: {
	actions: ReactNode;
	align?: MenuAlign;
	background?: BoxAppearance["background"];
	border?: BoxAppearance["border"];
	brand: ReactNode;
	closeLabel: string;
	collapseAt?: MenuCollapseAt;
	fill?: BoxAppearance["fill"];
	fillOpacity?: BoxAppearance["fillOpacity"];
	foreground?: BoxAppearance["foreground"];
	itemAppearance?: BoxAppearance & { padding?: Edges<Length> };
	itemGap?: Length;
	items: Array<MenuItem>;
	label: string;
	layout?: Layout;
	menuTriggerSide?: "start" | "end";
	mobileLabel: string;
	mobileTriggerAppearance?: BoxAppearance;
	opacity?: BoxAppearance["opacity"];
	popupAppearance?: BoxAppearance & { padding?: Edges<Length> };
	radius?: BoxAppearance["radius"];
	showMenuDivider?: boolean;
	socialActions?: ReactNode;
}) => {
	const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
	const boundedToContainer = Boolean(portalContainer?.closest("[data-website-viewport]"));
	const visual = appearance({ background, border, fill, fillOpacity, foreground, opacity, radius });
	const popupVisual = appearance(popupAppearance ?? {});
	const centered = align === "center";
	const menuOnRight = menuTriggerSide ? menuTriggerSide === "end" : align === "end";

	const {
		desktop: desktopClass,
		desktopBrand: desktopBrandClass,
		desktopChildren: desktopChildrenClass,
		mobile: mobileClass,
	} = collapseClasses(collapseAt);

	const mobileMenu = (
		<MobileMenu
			actions={actions}
			boundedToContainer={boundedToContainer}
			brand={brand}
			closeLabel={closeLabel}
			items={items}
			menuOnRight={menuOnRight}
			mobileClass={mobileClass}
			mobileLabel={mobileLabel}
			popupAppearance={popupAppearance}
			portalContainer={portalContainer}
			showDivider={showMenuDivider}
			socialActions={socialActions}
			triggerAppearance={mobileTriggerAppearance}
		/>
	);

	useLayoutEffect(() => {
		if (!portalContainer || !boundedToContainer) {
			return;
		}

		const updateBounds = () => {
			const bounds = portalContainer.getBoundingClientRect();
			const insetBlockStart = Math.max(0, bounds.top);

			const insetInlineStart = portalContainer.matches(":dir(rtl)")
				? window.innerWidth - bounds.right
				: bounds.left;

			portalContainer.style.setProperty(
				"--website-menu-block-size",
				`${Math.max(0, Math.min(window.innerHeight, bounds.bottom) - insetBlockStart)}px`
			);

			portalContainer.style.setProperty("--website-menu-inset-block-start", `${insetBlockStart}px`);
			portalContainer.style.setProperty("--website-menu-inset-inline-start", `${insetInlineStart}px`);
			portalContainer.style.setProperty("--website-menu-inline-size", `${bounds.width}px`);
		};

		updateBounds();

		const observer = new ResizeObserver(updateBounds);

		observer.observe(portalContainer);
		window.addEventListener("resize", updateBounds);

		return () => {
			observer.disconnect();
			window.removeEventListener("resize", updateBounds);
			portalContainer.style.removeProperty("--website-menu-block-size");
			portalContainer.style.removeProperty("--website-menu-inset-block-start");
			portalContainer.style.removeProperty("--website-menu-inset-inline-start");
			portalContainer.style.removeProperty("--website-menu-inline-size");
		};
	}, [boundedToContainer, portalContainer]);

	return (
		<nav
			aria-label={label}
			className={cn("iw-layout iw-box relative", visual.className)}
			ref={(node) => {
				setPortalContainer(node?.closest<HTMLElement>(".website-container") ?? null);
			}}
			style={{ ...layoutStyle(layout), ...visual.style }}
		>
			<NavigationMenu.Root className='flex w-full items-center gap-4'>
				<div
					className={cn("flex min-w-0 flex-auto items-center gap-3", centered ? "flex-1" : desktopBrandClass)}
				>
					{!menuOnRight && mobileMenu}
					<div className='flex min-w-0 self-stretch items-center' data-website-layout-occupied='brand'>
						{brand}
					</div>
					{showMenuDivider && align === "start" && <MenuDivider className={cn("hidden", desktopClass)} />}
				</div>
				<NavigationMenu.List
					className={cn(
						"m-0 hidden list-none items-center gap-x-4 p-0 @5xl/website-container:gap-x-6",
						desktopClass,
						navListJustifyClass(align)
					)}
					data-website-layout-occupied='navigation'
					style={{ columnGap: itemGap === undefined ? undefined : lengthToCss(itemGap) }}
				>
					{showMenuDivider && align === "end" && <MenuDivider className={cn("hidden", desktopClass)} />}
					{items.map((item) => (
						<MenuNavItem item={item} itemAppearance={itemAppearance} key={item.id} />
					))}
				</NavigationMenu.List>
				<MenuTrailingContent
					actions={actions}
					centered={centered}
					desktopChildrenClass={desktopChildrenClass}
					desktopClass={desktopClass}
					menuOnRight={menuOnRight}
					mobileMenu={mobileMenu}
					socialActions={socialActions}
				/>
				<NavigationMenu.Portal container={portalContainer}>
					<NavigationMenu.Positioner className='z-20' collisionPadding={16} sideOffset={10}>
						<NavigationMenu.Popup
							className={cn(
								"min-w-44 shadow-lg transition-[opacity,transform] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 motion-reduce:transition-none",
								popupVisual.className
							)}
							style={{
								...popupVisual.style,
								...paddingStyle(popupAppearance?.padding),
							}}
						>
							<NavigationMenu.Viewport />
						</NavigationMenu.Popup>
					</NavigationMenu.Positioner>
				</NavigationMenu.Portal>
			</NavigationMenu.Root>
		</nav>
	);
};
