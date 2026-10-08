"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { useDirection } from "@base-ui/react/direction-provider";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { cn } from "cn";

import type { Layout, TabsNode } from "../document/structure-schema";
import { appearance } from "./appearance";
import { flexStyle } from "./flex";
import { gridStyle } from "./grid";
import { layoutStyle, lengthToCss, paddingStyle, setResponsiveValue } from "./layout";
import { TabDecorations } from "./tab-decorations";
import { useTabsAutoplay } from "./use-tabs-autoplay";

type TabItem = {
	detail?: ReactNode;
	disabled?: boolean;
	id: string;
	panel: ReactNode;
	trigger: ReactNode;
	value: string;
};

type TabsProps = Omit<TabsNode["props"], "items" | "lead"> & {
	items: Array<TabItem>;
	layout?: Layout;
	lead?: ReactNode;
};

type Status = "active" | "completed" | "upcoming";

const statusOf = ({ activeIndex, index }: { activeIndex: number; index: number }): Status => {
	if (index < activeIndex) {
		return "completed";
	}

	return index === activeIndex ? "active" : "upcoming";
};

const TabsList = ({
	activateOnFocus,
	activeIndex,
	decorations,
	detailMode,
	expandActive,
	indicator,
	indicatorAppearance,
	indicatorThickness,
	itemAppearance,
	itemFlex,
	itemLayout,
	items,
	label,
	listAppearance,
	listLayout,
	loopFocus,
	onSelect,
	openIndicator,
	orientation,
	tabAppearance,
}: Pick<
	TabsProps,
	| "activateOnFocus"
	| "decorations"
	| "detailMode"
	| "expandActive"
	| "indicator"
	| "indicatorAppearance"
	| "indicatorThickness"
	| "itemAppearance"
	| "itemFlex"
	| "itemLayout"
	| "items"
	| "label"
	| "listAppearance"
	| "listLayout"
	| "loopFocus"
	| "openIndicator"
	| "orientation"
	| "tabAppearance"
> & { activeIndex: number; onSelect: (value: string) => void }) => {
	const direction = useDirection();
	const [list, setList] = useState<HTMLElement | null>(null);
	const listVisual = appearance(listAppearance ?? {});
	const tabVisual = appearance(tabAppearance ?? {});
	const itemVisual = appearance(itemAppearance ?? {});
	const indicatorVisual = appearance(indicatorAppearance ?? { fill: "accent" });
	const horizontal = orientation === "horizontal";
	const horizontalIndicatorInlineStart = direction === "rtl" ? "var(--active-tab-right)" : "var(--active-tab-left)";

	const indicatorStyle: CSSProperties = {
		...indicatorVisual.style,
		blockSize: horizontal ? lengthToCss(indicatorThickness ?? "2px") : "var(--active-tab-height)",
		inlineSize: horizontal ? "var(--active-tab-width)" : lengthToCss(indicatorThickness ?? "2px"),
		insetBlockEnd: horizontal ? 0 : undefined,
		insetBlockStart: horizontal ? undefined : "var(--active-tab-top)",
		insetInlineStart: horizontal ? horizontalIndicatorInlineStart : "0",
	};

	useEffect(() => {
		const item = list?.querySelectorAll(".iw-tab-item")[activeIndex];

		if (!list || !item || !horizontal || list.scrollWidth <= list.clientWidth) {
			return;
		}

		const { bottom, top } = list.getBoundingClientRect();

		if (top < 0 || bottom > window.innerHeight) {
			return;
		}

		const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		item.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest", inline: "nearest" });
	}, [activeIndex, horizontal, list]);

	return (
		<BaseTabs.List
			activateOnFocus={activateOnFocus}
			aria-label={label}
			className={cn(
				"iw-layout iw-flex min-w-0 shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
				listVisual.className
			)}
			loopFocus={loopFocus}
			ref={setList}
			style={{
				...flexStyle({
					direction: horizontal ? "row" : "column",
					layout: { overflow: horizontal ? "auto" : undefined, position: "relative", ...listLayout },
				}),
				...listVisual.style,
				...paddingStyle(listAppearance?.padding),
				gap: listAppearance?.gap === undefined ? undefined : lengthToCss(listAppearance.gap),
			}}
		>
			{items.map((item, index) => {
				const status = statusOf({ activeIndex, index });
				const detailId = item.detail ? `${item.id}-detail` : undefined;

				return (
					<div
						className={cn("iw-layout iw-flex iw-tab-item", itemVisual.className)}
						data-active={status === "active" ? "" : undefined}
						data-expand={expandActive ? "" : undefined}
						data-indicator={openIndicator}
						data-status={status}
						key={item.id}
						onClick={() => (item.disabled ? undefined : onSelect(item.value))}
						role='presentation'
						style={{
							...flexStyle({
								direction: "column",
								...itemFlex,
								layout: {
									overflow: expandActive ? "hidden" : undefined,
									position: "relative",
									...itemLayout,
								},
							}),
							"--iw-tab-inactive-size": expandActive ? lengthToCss(expandActive.inactiveSize) : undefined,
							...itemVisual.style,
							...paddingStyle(itemAppearance?.padding),
						}}
					>
						<BaseTabs.Tab
							aria-describedby={detailId}
							className={cn(
								"iw-tab relative z-10 flex w-full cursor-pointer items-center justify-start bg-transparent text-start outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-current disabled:cursor-not-allowed disabled:opacity-50",
								tabVisual.className
							)}
							disabled={item.disabled}
							style={{ ...tabVisual.style, ...paddingStyle(tabAppearance?.padding) }}
							value={item.value}
						>
							{item.trigger}
						</BaseTabs.Tab>
						{item.detail ? (
							<div className='iw-tab-detail' data-mode={detailMode} id={detailId}>
								<div className='min-h-0 min-w-0 overflow-hidden'>{item.detail}</div>
							</div>
						) : null}
						<TabDecorations count={items.length} decorations={decorations} index={index} />
					</div>
				);
			})}
			{indicator ? (
				<BaseTabs.Indicator
					className={cn(
						"pointer-events-none absolute transition-[inset-inline-start,inset-block-start,inline-size,block-size] duration-200 ease-out motion-reduce:transition-none",
						indicatorVisual.className
					)}
					renderBeforeHydration
					style={indicatorStyle}
				/>
			) : null}
		</BaseTabs.List>
	);
};

const panelClassName = {
	crossfade:
		"[grid-area:1/1] min-w-0 outline-none transition-opacity duration-(--iw-tab-fade) data-[hidden]:opacity-0 motion-reduce:transition-none",
	swap: "outline-none transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current motion-reduce:transition-none",
	track: "iw-carousel-slide min-w-0 shrink-0 grow-0 cursor-pointer outline-none transition-[translate] duration-500 ease-in-out motion-reduce:transition-none",
} as const;

const TabsStage = ({
	items,
	onSelect,
	panels,
	panelsLayout,
	slideBasis,
	slideGap,
}: Pick<TabsProps, "items" | "panelsLayout" | "slideBasis" | "slideGap"> & {
	onSelect: (value: string) => void;
	panels: NonNullable<TabsProps["panels"]>;
}) => {
	const trackStyle: CSSProperties = {};
	setResponsiveValue({ name: "slide-gap", serialize: lengthToCss, style: trackStyle, value: slideGap ?? 0 });
	const slideStyle: CSSProperties = {};
	setResponsiveValue({ name: "slide-basis", serialize: lengthToCss, style: slideStyle, value: slideBasis ?? "100%" });
	const track = panels === "track";

	const renderedPanels = items.map((item) => (
		<BaseTabs.Panel
			className={panelClassName[panels]}
			hidden={panels === "swap" ? undefined : false}
			keepMounted={panels !== "swap"}
			key={item.id}
			value={item.value}
			{...(track ? { inert: false, onClick: () => onSelect(item.value) } : {})}
			style={
				track
					? {
							...slideStyle,
							paddingInlineStart: "var(--iw-active-slide-gap, 0px)",
							translate: "calc(var(--iw-tab-dir) * var(--iw-tab-index) * -100%) 0",
						}
					: undefined
			}
		>
			{item.panel}
		</BaseTabs.Panel>
	));

	return (
		<div
			className={cn(
				"iw-layout min-w-0",
				panels === "swap" && "flex-1",
				panels === "crossfade" && "grid-rows-[minmax(0,1fr)]"
			)}
			style={{
				"--iw-default-display": panels === "crossfade" ? "grid" : "block",
				...layoutStyle({ overflow: track ? "hidden" : undefined, ...panelsLayout }),
			}}
		>
			{track ? (
				<div
					className='iw-carousel-track flex'
					style={{
						...trackStyle,
						inlineSize: "calc(100% + var(--iw-active-slide-gap, 0px))",
						marginInlineStart: "calc(var(--iw-active-slide-gap, 0px) * -1)",
					}}
				>
					{renderedPanels}
				</div>
			) : (
				renderedPanels
			)}
		</div>
	);
};

export const Tabs = ({
	activeShift,
	arrangement,
	autoplay,
	crossfadeMs = 600,
	defaultValue,
	inactiveOpacity,
	items,
	label,
	layout,
	lead,
	listPlacement = "before",
	orientation = "horizontal",
	panels = "swap",
	...rest
}: TabsProps) => {
	const direction = useDirection();
	const { hoverHandlers, phase, setRoot, setValue, value } = useTabsAutoplay({ autoplay, defaultValue, items });

	const activeIndex = Math.max(
		0,
		items.findIndex((item) => item.value === value)
	);

	const rootStyle: CSSProperties = {
		"--iw-tab-active-shift": activeShift === undefined ? undefined : lengthToCss(activeShift),
		"--iw-tab-delay": `${autoplay?.startDelayMs ?? 0}ms`,
		"--iw-tab-dir": direction === "rtl" ? -1 : 1,
		"--iw-tab-fade": `${crossfadeMs}ms`,
		"--iw-tab-inactive-opacity": inactiveOpacity,
		"--iw-tab-index": activeIndex,
		"--iw-tab-interval": `${autoplay?.intervalMs ?? 0}ms`,
		...(arrangement
			? gridStyle({ ...arrangement, layout })
			: flexStyle({ direction: orientation === "vertical" ? "row" : "column", gap: "1.5rem", layout })),
	};

	const list = (
		<TabsList
			activateOnFocus={rest.activateOnFocus}
			activeIndex={activeIndex}
			decorations={rest.decorations}
			detailMode={rest.detailMode ?? "collapse"}
			expandActive={rest.expandActive}
			indicator={rest.indicator ?? true}
			indicatorAppearance={rest.indicatorAppearance}
			indicatorThickness={rest.indicatorThickness}
			itemAppearance={rest.itemAppearance}
			itemFlex={rest.itemFlex}
			itemLayout={rest.itemLayout}
			items={items}
			key='list'
			label={label}
			listAppearance={rest.listAppearance}
			listLayout={rest.listLayout}
			loopFocus={rest.loopFocus ?? true}
			onSelect={setValue}
			openIndicator={rest.openIndicator ?? "none"}
			orientation={orientation}
			tabAppearance={rest.tabAppearance}
		/>
	);

	const stage = (
		<TabsStage
			items={items}
			key='panels'
			onSelect={setValue}
			panels={panels}
			panelsLayout={rest.panelsLayout}
			slideBasis={rest.slideBasis}
			slideGap={rest.slideGap}
		/>
	);

	return (
		<BaseTabs.Root
			{...hoverHandlers}
			className={cn("iw-layout min-w-0", arrangement ? "iw-grid" : "iw-flex")}
			data-autoplay={phase}
			onValueChange={(next) => setValue(String(next))}
			orientation={orientation}
			ref={setRoot}
			style={rootStyle}
			value={value}
		>
			{lead}
			{listPlacement === "after" ? [stage, list] : [list, stage]}
		</BaseTabs.Root>
	);
};
