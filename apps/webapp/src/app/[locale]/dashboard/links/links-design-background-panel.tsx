"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { MediaPicker } from "@/components/media/media-picker";
import {
	isLinkPageStudioLayout,
	linkPageWallpaperPatterns,
	linkPageWallpaperShaders,
	linkPageWallpaperStyle,
	linkPageWallpaperStyles,
	type LinkPageAppearance,
} from "@starter/infinite-links";

import { useBrandOverride, useDesignTheme } from "./links-design-preview";
import {
	LinksColorList,
	LinksColorRow,
	LinksRatioSlider,
	LinksSelect,
	LinksTilePicker,
	LinksToggle,
} from "./links-option-controls";
import { LinksAddButton, LinksFieldset } from "./links-panel";
import type { LinksPageController } from "./use-links-page-controller";

type Wallpaper = LinkPageAppearance["wallpaper"];

type Gradient = NonNullable<Wallpaper["gradient"]>;

export type LinksWallpaperEditor = { update: (patch: Partial<Wallpaper>) => void; wallpaper: Wallpaper };

type FieldsProps = { controller: LinksPageController; editor: LinksWallpaperEditor };

const maxStops = 6;

const minStops = 2;

const splitStyles: ReadonlyArray<Wallpaper["style"]> = ["split"];

const baseColorStyles: ReadonlyArray<Wallpaper["style"]> = ["fill", "pattern", "image"];

const spread = (colors: ReadonlyArray<string>) =>
	colors.map((color, index) => ({ color, position: Math.round((100 * index) / (colors.length - 1)) }));

const useWallpaperModel = ({ controller, editor }: FieldsProps) => {
	const theme = useDesignTheme(controller);
	const { wallpaper } = editor;
	const mesh = wallpaper.gradientColors ?? [theme.colors.featured, theme.colors.canvas, theme.colors.foreground];

	const gradient: Gradient = wallpaper.gradient ?? {
		angle: splitStyles.includes(wallpaper.style) ? 155 : 180,
		stops: splitStyles.includes(wallpaper.style)
			? [
					{ color: mesh[0], position: 0 },
					{ color: mesh[0], position: 50 },
					{ color: mesh[1], position: 50 },
					{ color: mesh[1], position: 100 },
				]
			: spread(wallpaper.gradientColors ?? [theme.colors.featured, theme.colors.canvas]),
	};

	const setGradient = (next: Partial<Gradient>) => editor.update({ gradient: { ...gradient, ...next } });

	const split = {
		first: gradient.stops[0]?.color ?? mesh[0],
		position: gradient.stops[1]?.position ?? 50,
		second: gradient.stops.at(-1)?.color ?? mesh[1],
	};

	const setSplit = (next: Partial<typeof split>) => {
		const { first, position, second } = { ...split, ...next };
		setGradient({
			stops: [
				{ color: first, position: 0 },
				{ color: first, position },
				{ color: second, position },
				{ color: second, position: 100 },
			],
		});
	};

	return { gradient, mesh, setGradient, setSplit, split, theme, wallpaper };
};

const WallpaperColors = (props: FieldsProps) => {
	const t = useTranslations("links.design");
	const { editor } = props;
	const { gradient, mesh, setGradient, setSplit, split, theme, wallpaper } = useWallpaperModel(props);
	const colorLabel = (index: number) => t("gradientColor", { number: index + 1 });
	const stops = gradient.stops.map((stop) => stop.color);

	if (baseColorStyles.includes(wallpaper.style)) {
		return (
			<LinksColorList>
				<LinksColorRow
					label={t("color")}
					onChange={(color) => color && editor.update({ color })}
					value={wallpaper.color ?? theme.colors.canvas}
				/>
			</LinksColorList>
		);
	}

	if (wallpaper.style === "split") {
		return (
			<LinksColorList>
				<LinksColorRow
					label={colorLabel(0)}
					onChange={(first) => first && setSplit({ first })}
					value={split.first}
				/>
				<LinksColorRow
					label={colorLabel(1)}
					onChange={(second) => second && setSplit({ second })}
					value={split.second}
				/>
			</LinksColorList>
		);
	}

	if (wallpaper.style === "gradient") {
		return (
			<>
				<LinksColorList>
					{gradient.stops.map((stop, index) => (
						<LinksColorRow
							key={`${index}-${stop.position}`}
							label={colorLabel(index)}
							onChange={(color) =>
								color &&
								setGradient({
									stops: gradient.stops.map((item, at) => (at === index ? { ...item, color } : item)),
								})
							}
							onRemove={
								gradient.stops.length > minStops
									? () => setGradient({ stops: spread(stops.filter((_, at) => at !== index)) })
									: undefined
							}
							value={stop.color}
						/>
					))}
				</LinksColorList>
				<LinksAddButton
					disabled={gradient.stops.length >= maxStops}
					label={t("addColor")}
					onClick={() => setGradient({ stops: spread([...stops, stops.at(-1) ?? theme.colors.foreground]) })}
				/>
			</>
		);
	}

	const animation = wallpaper.style === "animated" ? wallpaper.animation : undefined;
	const colors = animation?.colors ?? mesh;

	return (
		<LinksColorList>
			{colors.map((color, index) => (
				<LinksColorRow
					key={`${index}-${color}`}
					label={colorLabel(index)}
					onChange={(next) => {
						if (!next) {
							return;
						}

						const updated = colors.map((candidate, at) => (at === index ? next : candidate));

						if (animation) {
							editor.update({ animation: { ...animation, colors: updated } });
						} else {
							editor.update({
								gradientColors: [updated[0] ?? next, updated[1] ?? next, updated[2] ?? next],
							});
						}
					}}
					value={color}
				/>
			))}
		</LinksColorList>
	);
};

const WallpaperMedia = ({ controller, editor }: FieldsProps) => {
	const t = useTranslations("links.design");
	const theme = useDesignTheme(controller);
	const { wallpaper } = editor;

	if (wallpaper.style === "image") {
		return (
			<MediaPicker
				kind='image'
				label={t("wallpaperImage")}
				onRemove={() => editor.update({ imageUrl: null })}
				onSelect={(media) => editor.update({ imageUrl: media.url })}
				previewUrl={wallpaper.imageUrl ?? null}
			/>
		);
	}

	if (wallpaper.style !== "pattern") {
		return null;
	}

	return (
		<LinksTilePicker
			columns={4}
			label={t("pattern")}
			onChange={(pattern) => editor.update({ pattern })}
			options={linkPageWallpaperPatterns.map((pattern) => ({
				label: t(`patterns.${pattern}`),
				preview: (
					<span
						className='size-full'
						style={linkPageWallpaperStyle({
							background: theme.colors.canvas,
							foreground: theme.colors.foreground,
							wallpaper: { ...wallpaper, pattern },
						})}
					/>
				),
				value: pattern,
			}))}
			previewClassName='min-h-12 outline outline-border/64'
			value={wallpaper.pattern}
		/>
	);
};

const animationStyles = ["classic", ...linkPageWallpaperShaders] as const;

const AnimationOptions = (props: FieldsProps) => {
	const t = useTranslations("links.design");
	const { editor } = props;
	const { mesh, theme } = useWallpaperModel(props);
	const { animation } = editor.wallpaper;

	const update = (patch: Partial<NonNullable<Wallpaper["animation"]>>) =>
		animation && editor.update({ animation: { ...animation, ...patch } });

	return (
		<>
			<LinksSelect
				label={t("animation")}
				onChange={(style) =>
					editor.update({
						animation:
							style === "classic"
								? undefined
								: {
										colors: [...mesh, theme.colors.action],
										intensity: 0.8,
										scale: 1,
										shader: style,
										speed: 0.4,
										swirl: 0.1,
									},
					})
				}
				options={animationStyles.map((style) => ({ label: t(`animationStyles.${style}`), value: style }))}
				value={animation?.shader ?? "classic"}
			/>
			{animation && (
				<>
					<LinksRatioSlider
						label={t("animationSpeed")}
						onChange={(speed) => update({ speed: speed * 2 })}
						value={animation.speed / 2}
					/>
					<LinksRatioSlider
						label={t("animationIntensity")}
						onChange={(intensity) => update({ intensity })}
						value={animation.intensity}
					/>
					<LinksRatioSlider
						label={t("animationScale")}
						onChange={(ratio) => update({ scale: 0.1 + ratio * 3.9 })}
						value={(animation.scale - 0.1) / 3.9}
					/>
					<LinksRatioSlider
						label={t("animationSwirl")}
						onChange={(swirl) => update({ swirl })}
						value={animation.swirl ?? 0}
					/>
				</>
			)}
		</>
	);
};

const AngleSlider = ({ angle, onChange }: { angle: number; onChange: (angle: number) => void }) => {
	const t = useTranslations("links.design");

	return (
		<LinksRatioSlider
			label={t("gradientAngle")}
			onChange={(ratio) => onChange(Math.round(ratio * 360))}
			scale={360}
			unit='°'
			value={angle / 360}
		/>
	);
};

const WallpaperOptions = (props: FieldsProps) => {
	const t = useTranslations("links.design");
	const { editor } = props;
	const { gradient, setGradient, setSplit, split, wallpaper } = useWallpaperModel(props);
	const overlay = wallpaper.overlay ?? { amount: 0.24, color: "#000000" };

	const options = {
		animated: <AnimationOptions {...props} />,
		fill: null,
		gradient: <AngleSlider angle={gradient.angle} onChange={(angle) => setGradient({ angle })} />,
		image: (
			<>
				<LinksRatioSlider
					label={t("imageOverlay")}
					onChange={(amount) => editor.update({ overlay: { ...overlay, amount } })}
					value={overlay.amount}
				/>
				<LinksColorList>
					<LinksColorRow
						label={t("imageOverlayColor")}
						onChange={(color) => color && editor.update({ overlay: { ...overlay, color } })}
						value={overlay.color}
					/>
				</LinksColorList>
			</>
		),
		mesh: null,
		pattern: null,
		split: (
			<>
				<LinksRatioSlider
					label={t("splitPosition")}
					onChange={(ratio) => setSplit({ position: Math.round(ratio * 100) })}
					value={split.position / 100}
				/>
				<AngleSlider angle={gradient.angle} onChange={(angle) => setGradient({ angle })} />
			</>
		),
	} satisfies Record<Wallpaper["style"], ReactNode>;

	return (
		<>
			{options[wallpaper.style]}
			<LinksToggle
				checked={wallpaper.noise === true}
				label={t("wallpaperNoise")}
				onChange={(noise) => editor.update({ noise })}
			/>
		</>
	);
};

export const LinksWallpaperSection = ({
	children,
	label,
	titled = false,
	...props
}: FieldsProps & { children?: ReactNode; label: string; titled?: boolean }) => {
	const t = useTranslations("links.design");
	const theme = useDesignTheme(props.controller);
	const { editor } = props;

	const picker = (
		<LinksTilePicker
			columns={4}
			label={label}
			onChange={(style) => editor.update({ style })}
			options={linkPageWallpaperStyles.map((style) => ({
				label: t(`wallpapers.${style}`),
				preview: (
					<span
						className='size-full'
						style={linkPageWallpaperStyle({
							accent: theme.colors.featured,
							background: theme.colors.canvas,
							foreground: theme.colors.foreground,
							wallpaper: { ...editor.wallpaper, style },
						})}
					/>
				),
				value: style,
			}))}
			previewClassName='min-h-12 outline outline-border/64'
			value={editor.wallpaper.style}
		/>
	);

	const fields = (
		<>
			<WallpaperMedia {...props} />
			<WallpaperColors {...props} />
			<WallpaperOptions {...props} />
			{children}
		</>
	);

	if (titled) {
		return (
			<LinksFieldset legend={label}>
				{picker}
				{fields}
			</LinksFieldset>
		);
	}

	return (
		<>
			{picker}
			<LinksFieldset>{fields}</LinksFieldset>
		</>
	);
};

export const LinksBackgroundPanel = ({ controller }: { controller: LinksPageController }) => {
	const t = useTranslations("links.design");
	const { profile } = controller.document;
	const { wallpaper } = controller.document.appearance;
	const theme = useDesignTheme(controller);
	const updateOverride = useBrandOverride(controller);

	const editor: LinksWallpaperEditor = {
		update: (patch) => {
			if (patch.color) {
				updateOverride({ colors: { background: patch.color } });
			}

			controller.updateWallpaper(patch);
		},
		wallpaper,
	};

	return (
		<LinksWallpaperSection controller={controller} editor={editor} label={t("background")}>
			{isLinkPageStudioLayout(profile.layout) && (
				<LinksColorList>
					<LinksColorRow
						fallback={theme.colors.canvas}
						label={t("desktopColor")}
						onChange={(desktopColor) =>
							controller.updateWallpaper({ desktopColor: desktopColor ?? undefined })
						}
						value={wallpaper.desktopColor ?? null}
					/>
				</LinksColorList>
			)}
		</LinksWallpaperSection>
	);
};
