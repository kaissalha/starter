import type { CSSProperties } from "react";

import { cn } from "cn";
import type { EmblaCarouselType } from "embla-carousel";

import type { CarouselControl, CarouselNode, Length, Responsive } from "../document/structure-schema";
import { appearance } from "./appearance";
import { isResponsiveObject, layoutStyle, lengthToCss, paddingStyle } from "./layout";
import { typographyAppearanceStyle } from "./typography";

type ArrowKind = "previous" | "next";

type Axis = "x" | "y";

const legacyArrowSize = "4.125rem";

const arrowPath = ({ axis, icon, kind }: { axis: Axis; icon: "arrow" | "chevron"; kind: ArrowKind }) => {
	if (axis === "y") {
		const down = kind === "next";

		if (icon === "arrow") {
			return down ? "M12 5v14m-6-6 6 6 6-6" : "M12 19V5m-6 6 6-6 6 6";
		}

		return down ? "m6 9 6 6 6-6" : "m18 15-6-6-6 6";
	}

	if (icon === "arrow") {
		return kind === "previous" ? "M19 12H5m6-6-6 6 6 6" : "M5 12h14m-6-6 6 6-6 6";
	}

	return kind === "previous" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6";
};

const ArrowIcon = ({
	axis,
	icon,
	kind,
	size,
}: {
	axis: Axis;
	icon: "arrow" | "chevron";
	kind: ArrowKind;
	size: string;
}) => (
	<svg
		aria-hidden
		className={cn("fill-none stroke-current stroke-2", axis === "x" && "iw-directional-icon")}
		style={{ blockSize: size, inlineSize: size }}
		viewBox='0 0 24 24'
	>
		<path d={arrowPath({ axis, icon, kind })} strokeLinecap='round' strokeLinejoin='round' />
	</svg>
);

const mapSize = ({
	size,
	transform,
}: {
	size: Responsive<Length>;
	transform: (css: string) => string;
}): Responsive<Length> => {
	if (!isResponsiveObject(size)) {
		return transform(lengthToCss(size));
	}

	return {
		base: transform(lengthToCss(size.base)),
		compact: size.compact === undefined ? undefined : transform(lengthToCss(size.compact)),
		medium: size.medium === undefined ? undefined : transform(lengthToCss(size.medium)),
		wide: size.wide === undefined ? undefined : transform(lengthToCss(size.wide)),
	};
};

const arrowDimensions = ({ control }: { control: Extract<CarouselControl, { kind: ArrowKind }> }) => {
	const size = control.size ?? legacyArrowSize;
	const baseSize = lengthToCss(isResponsiveObject(size) ? size.base : size);

	return {
		blockSize: mapSize({ size, transform: (css) => css }),
		iconSize: control.iconSize === undefined ? `calc(${baseSize} * 0.45)` : lengthToCss(control.iconSize),
		inlineSize: mapSize({ size, transform: (css) => (control.corners === "pill" ? `calc(${css} * 1.75)` : css) }),
	};
};

export const ArrowControl = ({
	axis,
	control,
	disabled,
	onPress,
}: {
	axis: Axis;
	control: Extract<CarouselControl, { kind: ArrowKind }>;
	disabled: boolean;
	onPress: () => void;
}) => {
	const visual = appearance(control.appearance ?? {});
	const dimensions = arrowDimensions({ control });

	return (
		<button
			aria-label={control.label}
			className={cn(
				"iw-layout shrink-0 items-center justify-center transition-[background-color,color,opacity,transform] duration-200 ease-out hover:scale-[1.03] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35 motion-reduce:transition-none",
				visual.className
			)}
			disabled={disabled}
			onClick={onPress}
			style={{
				borderRadius: control.corners === "square" ? 0 : "9999px",
				...layoutStyle({
					blockSize: dimensions.blockSize,
					grow: control.stretch ? 1 : undefined,
					inlineSize: control.stretch ? "auto" : dimensions.inlineSize,
					visibility: control.visibility,
				}),
				...visual.style,
				"--iw-default-display": "inline-flex",
			}}
			type='button'
		>
			<ArrowIcon axis={axis} icon={control.icon ?? "chevron"} kind={control.kind} size={dimensions.iconSize} />
		</button>
	);
};

export const IndicatorsControl = ({
	control,
	onSelect,
	selectedIndex,
	snapCount,
}: {
	control: Extract<CarouselControl, { kind: "indicators" }>;
	onSelect: (index: number) => void;
	selectedIndex: number;
	snapCount: number;
}) => {
	const visual = appearance(control.appearance ?? {});
	const spaced = control.spacing !== undefined;
	const gap = spaced ? control.spacing : control.appearance?.gap;

	const containerStyle: CSSProperties = {
		...layoutStyle({ visibility: control.visibility }),
		...visual.style,
		...paddingStyle(control.appearance?.padding),
		"--iw-default-display": "flex",
		gap: gap === undefined ? undefined : lengthToCss(gap),
	};

	return (
		<div
			aria-label={control.label}
			className={cn("iw-layout items-center", visual.className)}
			role='group'
			style={containerStyle}
		>
			{Array.from({ length: snapCount }, (_, index) => {
				const state = selectedIndex === index ? control.active : control.inactive;

				return (
					<button
						aria-current={selectedIndex === index ? "true" : undefined}
						aria-label={`${control.label} ${index + 1}`}
						className={cn(
							"iw-layout relative shrink-0 items-center justify-center rounded-full",
							spaced && "after:absolute after:-inset-2 after:content-['']"
						)}
						key={`${control.label}-${index + 1}`}
						onClick={() => onSelect(index)}
						style={{
							...(!spaced && {
								...layoutStyle({
									blockSize: { base: "2rem", compact: "1.5rem" },
									inlineSize: { base: "2rem", compact: "1.5rem" },
								}),
							}),
							"--iw-default-display": "inline-flex",
						}}
						type='button'
					>
						<span
							aria-hidden
							className='block rounded-full bg-current transition-[inline-size,block-size,opacity] duration-200 ease-out motion-reduce:transition-none'
							style={{
								blockSize: lengthToCss(state.blockSize),
								inlineSize: lengthToCss(state.inlineSize),
								opacity: state.opacity,
							}}
						/>
					</button>
				);
			})}
		</div>
	);
};

export const CounterControl = ({
	control,
	selectedIndex,
	snapCount,
}: {
	control: Extract<CarouselControl, { kind: "counter" }>;
	selectedIndex: number;
	snapCount: number;
}) => {
	const { appearance: typography, tone, ...box } = control.appearance ?? {};
	const visual = appearance({ ...box, foreground: box.foreground ?? tone });
	const pad = control.pad ?? 0;
	const current = String(selectedIndex + 1).padStart(pad, "0");
	const total = String(snapCount).padStart(pad, "0");

	return (
		<span
			className={cn(
				"iw-layout items-center tabular-nums",
				control.bar === undefined ? "gap-0" : "gap-3",
				!typography && "font-mono text-sm",
				visual.className
			)}
			style={{
				...layoutStyle({ visibility: control.visibility }),
				...(typography && typographyAppearanceStyle({ appearance: typography })),
				...visual.style,
				...paddingStyle(control.appearance?.padding),
				"--iw-default-display": "inline-flex",
			}}
		>
			<span>{current}</span>
			{control.bar === undefined ? (
				<span>{control.separator ?? "/"}</span>
			) : (
				<span
					aria-hidden
					className='block h-px bg-current opacity-40'
					style={{ inlineSize: lengthToCss(control.bar) }}
				/>
			)}
			<span>{total}</span>
		</span>
	);
};

export const ControlGroup = ({
	api,
	axis,
	group,
	state,
}: {
	api: EmblaCarouselType | undefined;
	axis: Axis;
	group: CarouselNode["props"]["controlGroups"][number];
	state: { canNext: boolean; canPrevious: boolean; selectedIndex: number; snapCount: number };
}) => {
	const visual = appearance(group.appearance ?? {});

	return (
		<div
			className={cn("iw-layout items-center", visual.className)}
			style={{
				...layoutStyle(group.layout),
				...visual.style,
				"--iw-default-display": "flex",
				flexDirection: axis === "y" && group.placement !== "header" ? "column" : undefined,
				gap: group.gap === undefined ? undefined : lengthToCss(group.gap),
				justifyContent: group.align,
			}}
		>
			{group.controls.map((control, index) => {
				const key = `${group.id}-${control.kind}-${index}`;

				if (control.kind === "previous" || control.kind === "next") {
					const previous = control.kind === "previous";

					return (
						<ArrowControl
							axis={axis}
							control={control}
							disabled={previous ? !state.canPrevious : !state.canNext}
							key={key}
							onPress={() => (previous ? api?.scrollPrev() : api?.scrollNext())}
						/>
					);
				}

				if (control.kind === "indicators") {
					return (
						<IndicatorsControl
							control={control}
							key={key}
							onSelect={(slideIndex) => api?.scrollTo(slideIndex)}
							selectedIndex={state.selectedIndex}
							snapCount={state.snapCount}
						/>
					);
				}

				if (control.kind === "counter") {
					return (
						<CounterControl
							control={control}
							key={key}
							selectedIndex={state.selectedIndex}
							snapCount={state.snapCount}
						/>
					);
				}

				return null;
			})}
		</div>
	);
};
