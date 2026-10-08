import { z } from "zod";

import { brandCornerStyleSchema, brandFontPairingIdSchema } from "@starter/infinite-brand";

import {
	linkPageAppearanceSchema,
	linkPageHexColorSchema,
	linkPageProfileLayouts,
	type LinkPageDocument,
} from "./contracts";
import { customerThemeIds } from "./customer-theme-ids";
import customerThemes from "./customer-themes.json";

export const linkPageThemeCategories = [
	"featured",
	"music-performance",
	"digital-creators",
	"art-design",
	"fashion-beauty",
	"tech-gaming",
	"video-photography",
	"fitness-coaching",
	"travel-real-estate",
	"influencers-bloggers",
	"brands-commerce",
	"communities",
	"food-drink",
	"apps-services",
] as const;

const linkPageThemeSchema = linkPageAppearanceSchema
	.pick({
		banner: true,
		buttons: true,
		divider: true,
		profileImage: true,
		socialIconSize: true,
		socialsAtBottom: true,
		titleColor: true,
		typography: true,
		wallpaper: true,
	})
	.partial({ titleColor: true })
	.extend({
		category: z.enum(linkPageThemeCategories),
		colors: z.strictObject({
			background: linkPageHexColorSchema,
			neutral: linkPageHexColorSchema,
			primary: linkPageHexColorSchema,
			secondary: linkPageHexColorSchema,
			tertiary: linkPageHexColorSchema,
		}),
		cornerStyle: brandCornerStyleSchema,
		description: z.string().min(1),
		fontPairingId: brandFontPairingIdSchema,
		headerLayout: z.enum(linkPageProfileLayouts),
		id: z.enum(customerThemeIds),
	});

export type LinkPageTheme = z.infer<typeof linkPageThemeSchema>;

export const linkPageThemes: ReadonlyArray<LinkPageTheme> = z.array(linkPageThemeSchema).parse(customerThemes);

export const applyLinkPageTheme = ({
	document,
	theme,
}: {
	document: LinkPageDocument;
	theme: LinkPageTheme;
}): LinkPageDocument => ({
	...document,
	appearance: {
		...document.appearance,
		banner: theme.banner ?? null,
		brandOverride: { colors: theme.colors, cornerStyle: theme.cornerStyle, fontPairingId: theme.fontPairingId },
		buttons: theme.buttons,
		divider: theme.divider ?? null,
		profileImage: theme.profileImage ?? null,
		socialIconSize: theme.socialIconSize,
		socialsAtBottom: theme.socialsAtBottom,
		themeId: theme.id,
		titleColor: theme.titleColor ?? null,
		typography: theme.typography ?? null,
		wallpaper: theme.wallpaper,
	},
	profile: { ...document.profile, layout: theme.headerLayout },
});
