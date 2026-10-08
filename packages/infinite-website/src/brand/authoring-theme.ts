import { formatHex, interpolate, wcagContrast } from "culori";

import { getBrandFont, resolveBrandFontSelection, type BrandFoundationV1 } from "@starter/infinite-brand";

import { projectBrandToWebsiteTheme, type WebsiteTheme } from "./brand-projection";

const safeContrast = 4.5;

const largeContrast = 3;

const surfaces = ["canvas", "subtle", "featured", "tint", "action", "accent"] as const;

const tones = ["primary", "muted", "accent-text", "accent", "action", "featured"] as const;

type Surface = (typeof surfaces)[number];

type Tone = (typeof tones)[number];

const surfaceColors = ({ colors }: WebsiteTheme) =>
	({
		accent: colors.accent,
		action: colors.action,
		canvas: colors.canvas,
		featured: colors.featured,
		subtle: colors.subtle,
		tint: formatHex(interpolate([colors.canvas, colors.foreground], "rgb")(0.05)),
	}) satisfies Record<Surface, string>;

const toneColors = ({ colors }: WebsiteTheme, surface: Surface) => {
	const onSurface = {
		featured: { muted: colors.onFeaturedMuted, primary: colors.onFeatured },
		subtle: { muted: colors.onSubtleMuted, primary: colors.onSubtle },
	};

	const inherited =
		surface === "featured" || surface === "subtle"
			? onSurface[surface]
			: { muted: colors.muted, primary: colors.foreground };

	return {
		accent: surface === "accent" ? colors.onAccent : colors.accentText,
		"accent-text": colors.accent,
		action: colors.onAction,
		featured: colors.onFeatured,
		muted: inherited.muted,
		primary: inherited.primary,
	} satisfies Record<Tone, string>;
};

const fontName = ({ locale, role }: { locale: string; role: WebsiteTheme["typography"]["heading"] }) => {
	const { fontId } = resolveBrandFontSelection({ locale, role });

	return getBrandFont({ fontId })?.family ?? fontId;
};

export const describeWebsiteThemeForAuthoring = ({ brand, locale }: { brand: BrandFoundationV1; locale: string }) => {
	const theme = projectBrandToWebsiteTheme({ brand });
	const fills = surfaceColors(theme);

	return {
		buttons: theme.buttons.style,
		corners: { radius: theme.radius, style: brand.corners.style },
		fonts: {
			body: fontName({ locale, role: theme.typography.body }),
			heading: fontName({ locale, role: theme.typography.heading }),
		},
		surfaces: fills,
		textTones: Object.fromEntries(
			surfaces.map((surface) => {
				const colors = toneColors(theme, surface);
				const ratio = (tone: Tone) => wcagContrast(colors[tone], fills[surface]);

				return [
					surface,
					{
						avoid: tones.filter((tone) => ratio(tone) < largeContrast),
						largeOnly: tones.filter((tone) => ratio(tone) >= largeContrast && ratio(tone) < safeContrast),
						safe: tones.filter((tone) => ratio(tone) >= safeContrast),
					},
				];
			})
		),
	};
};
