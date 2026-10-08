import { converter, formatHex, interpolate, toGamut, wcagContrast } from "culori";

import {
	brandFoundationSchema,
	type BrandButtonStyle,
	type BrandFontRole,
	type BrandFoundationV1,
} from "@starter/infinite-brand";

export type WebsiteTheme = {
	buttons: { style: BrandButtonStyle };
	colors: {
		accent: string;
		accentText: string;
		action: string;
		border: string;
		canvas: string;
		featured: string;
		foreground: string;
		muted: string;
		onAccent: string;
		onAction: string;
		onFeatured: string;
		onFeaturedMuted: string;
		onMedia: string;
		onMediaMuted: string;
		onSubtle: string;
		onSubtleMuted: string;
		subtle: string;
	};
	radii: { control: string; media: string };
	radius: string;
	typography: {
		body: BrandFontRole;
		catalogVersion: 1;
		heading: BrandFontRole;
	};
};

const mix = ({ amount, from, to }: { amount: number; from: string; to: string }) => {
	return formatHex(interpolate([from, to], "oklch")(amount));
};

const bestBlackOrWhite = ({ background }: { background: string }) => {
	return wcagContrast(background, "#000000") >= wcagContrast(background, "#ffffff") ? "#000000" : "#ffffff";
};

const toOklch = converter("oklch");

const toSrgbGamut = toGamut("rgb", "oklch");

const contrastStep = 0.02;

const maximumContrast = 21;

const contrastTarget = ({ level, minimum }: { level: number; minimum: number }) => {
	return minimum + ((maximumContrast - minimum) * (level - 1)) / 9;
};

const oklchHex = ({ chroma, hue, lightness }: { chroma: number; hue: number; lightness: number }) => {
	return formatHex(toSrgbGamut({ c: chroma, h: hue, l: lightness, mode: "oklch" }));
};

const adjustForContrast = ({ background, base, target }: { background: string; base: string; target: number }) => {
	const origin = toOklch(base);
	const chroma = origin?.c ?? 0;
	const hue = origin?.h ?? 0;
	const start = origin?.l ?? 0.5;

	const search = (direction: 1 | -1) => {
		const steps = Math.ceil((direction === 1 ? 1 - start : start) / contrastStep) + 1;

		return Array.from({ length: steps }, (_, index) => {
			const lightness = Math.min(1, Math.max(0, start + direction * index * contrastStep));

			return { change: Math.abs(lightness - start), color: oklchHex({ chroma, hue, lightness }) };
		}).find(({ color }) => wcagContrast(color, background) >= target);
	};

	const found = [search(1), search(-1)].flatMap((result) => (result ? [result] : []));
	const nearest = found.sort((left, right) => left.change - right.change)[0];

	if (nearest) {
		return nearest.color;
	}

	const lightest = oklchHex({ chroma: chroma * 0.1, hue, lightness: 0.99 });
	const darkest = oklchHex({ chroma: chroma * 0.5, hue, lightness: 0.05 });

	return wcagContrast(lightest, background) > wcagContrast(darkest, background) ? lightest : darkest;
};

const readable = ({
	background,
	base,
	level,
	minimum = 4.5,
}: {
	background: string;
	base: string;
	level: number;
	minimum?: number;
}) => adjustForContrast({ background, base, target: contrastTarget({ level, minimum }) });

const ensureSurfaceContrast = ({
	foreground,
	minimum,
	surface,
}: {
	foreground: string;
	minimum: number;
	surface: string;
}) => {
	if (wcagContrast(foreground, surface) >= minimum) {
		return surface;
	}

	const endpoint = bestBlackOrWhite({ background: foreground });
	const interpolateSurface = interpolate([surface, endpoint], "oklch");

	return Array.from({ length: 16 }).reduce<{ high: number; low: number; result: string }>(
		(range) => {
			const amount = (range.low + range.high) / 2;
			const candidate = formatHex(interpolateSurface(amount));

			return wcagContrast(foreground, candidate) >= minimum
				? { high: amount, low: range.low, result: candidate }
				: { high: range.high, low: amount, result: range.result };
		},
		{ high: 1, low: 0, result: formatHex(interpolateSurface(1)) }
	).result;
};

const radiusByCorner = {
	rounded: "1rem",
	soft: "1.5rem",
	square: "0rem",
	subtle: "0.5rem",
} as const;

const visibleMinimum = 1.25;

export const projectBrandToWebsiteTheme = ({ brand: input }: { brand: BrandFoundationV1 }) => {
	const brand = brandFoundationSchema.parse(input);
	const { background, neutral, primary, secondary, tertiary } = brand.colors;

	const on = ({ background: surface, level, minimum }: { background: string; level: number; minimum?: number }) =>
		readable({ background: surface, base: neutral, level, minimum });

	const foreground = on({ background, level: 9 });
	const subtle = mix({ amount: 0.04, from: background, to: foreground });
	const featured = tertiary;
	const action = ensureSurfaceContrast({ foreground: background, minimum: visibleMinimum, surface: primary });
	const accent = ensureSurfaceContrast({ foreground: background, minimum: visibleMinimum, surface: secondary });
	const radius = radiusByCorner[brand.corners.style];

	return {
		buttons: { style: brand.buttons?.style ?? "solid" },
		colors: {
			accent,
			accentText: readable({ background, base: secondary, level: 7 }),
			action,
			border: on({ background, level: 2, minimum: 3 }),
			canvas: background,
			featured,
			foreground,
			muted: on({ background, level: 7 }),
			onAccent: on({ background: accent, level: 7, minimum: 3 }),
			onAction: on({ background: action, level: 7, minimum: 3 }),
			onFeatured: on({ background: featured, level: 9 }),
			onFeaturedMuted: on({ background: featured, level: 7 }),
			onMedia: "#ffffff",
			onMediaMuted: "rgb(255 255 255 / 0.85)",
			onSubtle: on({ background: subtle, level: 9 }),
			onSubtleMuted: on({ background: subtle, level: 7 }),
			subtle,
		},
		radii: { control: radius, media: radius },
		radius,
		typography: brand.typography,
	} satisfies WebsiteTheme;
};
