import { z } from "zod";

import {
	brandFontPairings,
	brandFoundationSchema,
	brandUpdateSchema,
	canonicalLocaleKeySchema,
	getBrandFont,
	localeSchema,
	type BrandLocale,
} from "@starter/infinite-brand";

import { resolveLinkPageEmbed, resolveYouTubeVideoId } from "./link-page-embeds";

export const linkPageSlug = "links";

export const linkPageLocaleSchema = localeSchema;

export const linkPageLimits = {
	bio: 240,
	blocks: 50,
	buttonLabel: 60,
	collectionLinks: 100,
	label: 80,
	listItems: 20,
	socials: 12,
	tagline: 80,
	text: 1000,
	title: 80,
	videoTitle: 120,
} as const;

export const linkPageHexColorSchema = z
	.string()
	.regex(/^#[\dA-Fa-f]{6}$/u, "Must be a six-digit hexadecimal color")
	.toLowerCase();

const ratioSchema = z.number().min(0).max(1);

const hasText = (value: string | undefined): value is string => value !== undefined && value.trim().length > 0;

const localizedTextSchema = ({ max, required }: { max: number; required: boolean }) => {
	const record = z.partialRecord(canonicalLocaleKeySchema, z.string().trim().max(max));

	return required
		? record.refine((copy) => Object.values(copy).some(hasText), "At least one localized value is required")
		: record;
};

const isHttpUrl = (value: string) => {
	if (!URL.canParse(value)) {
		return false;
	}

	const { protocol } = new URL(value);

	return protocol === "http:" || protocol === "https:";
};

export const httpUrlSchema = z.url().refine(isHttpUrl, "URLs must use HTTP or HTTPS");

const linkTargetSchema = z
	.string()
	.trim()
	.refine(
		(value) => /^\/(?![/\\])[^\s\\]*$/u.test(value) || isHttpUrl(value),
		"Must be an HTTP(S) URL or a same-domain path starting with /"
	);

export const isLinkPageHref = (value: string) => linkTargetSchema.safeParse(value).success;

const contactUrlSchema = z
	.string()
	.trim()
	.refine(
		(value) =>
			/^mailto:[^\s@]+@[^\s@]+$/iu.test(value) ||
			/^(?:tel|sms):(?=.*\d)\+?[\d\s()-]{5,}$/u.test(value) ||
			isHttpUrl(value),
		"Must be an HTTP(S), mailto:, tel: or sms: link"
	);

export const linkPageSocialPlatforms = [
	"instagram",
	"tiktok",
	"x",
	"youtube",
	"facebook",
	"linkedin",
	"threads",
	"snapchat",
	"pinterest",
	"spotify",
	"whatsapp",
	"telegram",
	"github",
	"email",
	"website",
	"amazon",
	"applemusic",
	"applepodcasts",
	"bandcamp",
	"behance",
	"bluesky",
	"buymeacoffee",
	"cashapp",
	"discord",
	"goodreads",
	"kofi",
	"newsletter",
	"patreon",
	"paypal",
	"phone",
	"reddit",
	"sms",
	"soundcloud",
	"strava",
	"tidal",
	"twitch",
	"venmo",
	"vimeo",
	"youtubemusic",
] as const;

const linkPageSocialPlatformSchema = z.enum(linkPageSocialPlatforms);

const linkPageSocialSchema = z.strictObject({
	id: z.uuid(),
	platform: linkPageSocialPlatformSchema,
	url: contactUrlSchema,
});

export const linkPageLinkDesigns = {
	advanced: [
		"advanced-01",
		"advanced-02",
		"advanced-03",
		"advanced-04",
		"advanced-05",
		"advanced-06",
		"advanced-07",
		"advanced-08",
	],
	buttons: [
		"buttons-01",
		"buttons-02",
		"buttons-03",
		"buttons-04",
		"buttons-05",
		"buttons-06",
		"buttons-07",
		"buttons-08",
		"buttons-09",
		"buttons-10",
	],
	cards: [
		"cards-01",
		"cards-02",
		"cards-03",
		"cards-04",
		"cards-05",
		"cards-06",
		"cards-07",
		"cards-08",
		"cards-09",
		"cards-10",
		"cards-11",
		"cards-12",
		"cards-13",
	],
} as const;

const linkPageLinkDesignSchema = z.enum([
	...linkPageLinkDesigns.buttons,
	...linkPageLinkDesigns.cards,
	...linkPageLinkDesigns.advanced,
]);

export type LinkPageLinkDesign = z.infer<typeof linkPageLinkDesignSchema>;

export const linkPageLinkLayouts = ["classic", "featured"] as const;

export const linkPageCollectionDisplays = ["stack", "grid", "carousel"] as const;

export const linkPageSocialDisplays = ["icons", "chips"] as const;

export const linkPageBlockKinds = [
	"link",
	"header",
	"text",
	"video",
	"collection",
	"socials",
	"tabs",
	"embed",
	"form",
	"marquee",
	"announcement",
	"faq",
	"testimonials",
	"countdown",
] as const;

export const linkPageLinkAligns = ["start", "center", "end"] as const;

export const linkPageLinkAnimations = ["pulse", "shake", "tada", "jump", "swing", "jello", "rubber"] as const;

export const linkPageTextFormats = ["plain", "rich"] as const;

export const linkPageFormFieldTypes = ["email", "text", "phone", "textarea"] as const;

export const linkPageMarqueeStyles = ["plain", "ribbon"] as const;

export const linkPageTabsStyles = ["pills", "menu"] as const;

export const linkPageAnnouncementLayouts = ["banner", "card"] as const;

export const linkPageSectionAlignments = ["inherit", "center", "start"] as const;

export const linkPageSectionStyles = ["plain", "card", "band"] as const;

export const linkPageButtonStyles = ["solid", "outline", "glass"] as const;

export const linkPageButtonShadows = ["none", "subtle", "strong", "hard"] as const;

export const linkPageButtonTextTransforms = ["none", "uppercase"] as const;

export const linkPageButtonEffects = ["none", "flat", "concave", "convex", "inset", "frosted"] as const;

const linkPageButtonAppearanceSchema = z.strictObject({
	borderWidth: ratioSchema.optional(),
	colors: z.strictObject({
		border: linkPageHexColorSchema.nullable().optional(),
		button: linkPageHexColorSchema.nullable(),
		cta: linkPageHexColorSchema.nullable().optional(),
		ctaText: linkPageHexColorSchema.nullable().optional(),
		label: linkPageHexColorSchema.nullable().optional(),
		labelText: linkPageHexColorSchema.nullable().optional(),
		shadow: linkPageHexColorSchema.nullable(),
		text: linkPageHexColorSchema.nullable(),
	}),
	design: linkPageLinkDesignSchema.optional(),
	effect: z.enum(linkPageButtonEffects).optional(),
	opacity: z.number().min(0).max(100).optional(),
	radius: ratioSchema.optional(),
	shadow: z.enum(linkPageButtonShadows),
	shadowStrength: ratioSchema.optional(),
	showImages: z.boolean().optional(),
	spacing: ratioSchema.optional(),
	style: z.enum([...linkPageButtonStyles, "soft"]),
	textTransform: z.enum(linkPageButtonTextTransforms).optional(),
});

const linkPageSurfaceAppearanceSchema = z.strictObject({
	backgroundColor: linkPageHexColorSchema.nullable(),
	foregroundColor: linkPageHexColorSchema.nullable(),
	style: z.enum(linkPageSectionStyles),
});

const linkPageSectionAppearanceSchema = linkPageSurfaceAppearanceSchema.extend({
	alignment: z.enum(linkPageSectionAlignments),
	buttons: linkPageButtonAppearanceSchema.nullable(),
});

export type LinkPageButtonAppearance = z.infer<typeof linkPageButtonAppearanceSchema>;

export type LinkPageSectionAppearance = z.infer<typeof linkPageSectionAppearanceSchema>;

export type LinkPageSurfaceAppearance = z.infer<typeof linkPageSurfaceAppearanceSchema>;

export const defaultLinkPageSectionAppearance: LinkPageSectionAppearance = {
	alignment: "inherit",
	backgroundColor: null,
	buttons: null,
	foregroundColor: null,
	style: "plain",
};

const defaultLinkPageHeaderAppearance: LinkPageSurfaceAppearance = {
	backgroundColor: null,
	foregroundColor: null,
	style: "plain",
};

const blockBase = {
	appearance: linkPageSectionAppearanceSchema.default(defaultLinkPageSectionAppearance),
	enabled: z.boolean(),
	id: z.uuid(),
};

const linkPageLinkStyleSchema = z.strictObject({
	border: linkPageHexColorSchema.optional(),
	borderWidth: ratioSchema.optional(),
	button: linkPageHexColorSchema.optional(),
	cta: linkPageHexColorSchema.optional(),
	ctaText: linkPageHexColorSchema.optional(),
	label: linkPageHexColorSchema.optional(),
	labelText: linkPageHexColorSchema.optional(),
	radius: ratioSchema.optional(),
	shadowStrength: ratioSchema.optional(),
	text: linkPageHexColorSchema.optional(),
});

const linkPageLinkSchema = z
	.strictObject({
		...blockBase,
		align: z.enum(linkPageLinkAligns).optional(),
		animation: z.enum(linkPageLinkAnimations).optional(),
		badge: localizedTextSchema({ max: linkPageLimits.buttonLabel, required: false }).optional(),
		cta: localizedTextSchema({ max: linkPageLimits.buttonLabel, required: false }).optional(),
		description: localizedTextSchema({ max: linkPageLimits.bio, required: false }).optional(),
		design: linkPageLinkDesignSchema.optional(),
		emoji: z.string().trim().min(1).max(8).optional(),
		imageUrl: httpUrlSchema.nullable().optional(),
		kind: z.literal("link"),
		label: localizedTextSchema({ max: linkPageLimits.label, required: false }),
		layout: z.enum(linkPageLinkLayouts),
		style: linkPageLinkStyleSchema.optional(),
		url: linkTargetSchema,
	})
	.refine(
		(link) => Boolean(link.imageUrl) || Object.values(link.label).some(hasText),
		"Links without an image need a label"
	);

const linkPageHeaderBlockSchema = z.strictObject({
	...blockBase,
	kind: z.literal("header"),
	text: localizedTextSchema({ max: linkPageLimits.label, required: true }),
});

const linkPageTextBlockSchema = z
	.strictObject({
		...blockBase,
		button: z
			.strictObject({
				label: localizedTextSchema({ max: linkPageLimits.buttonLabel, required: true }),
				url: linkTargetSchema,
			})
			.nullable(),
		format: z.enum(linkPageTextFormats).optional(),
		kind: z.literal("text"),
		text: localizedTextSchema({ max: linkPageLimits.text, required: true }),
	})
	.refine(
		(block) =>
			block.format !== "rich" ||
			Object.values(block.text).every((text) =>
				[...(text ?? "").matchAll(/\[[^\]]+\]\(([^)]+)\)/gu)].every(
					([, href]) => href !== undefined && isLinkPageHref(href)
				)
			),
		"Rich text links must be HTTP(S) URLs or same-domain paths"
	);

const itemBase = { id: z.uuid() };

const linkPageTabsBlockSchema = z.strictObject({
	...blockBase,
	items: z
		.array(
			z.strictObject({
				...itemBase,
				label: localizedTextSchema({ max: linkPageLimits.buttonLabel, required: true }),
				url: linkTargetSchema,
			})
		)
		.min(1)
		.max(linkPageLimits.socials),
	kind: z.literal("tabs"),
	style: z.enum(linkPageTabsStyles).optional(),
});

const linkPageEmbedBlockSchema = z.strictObject({
	...blockBase,
	kind: z.literal("embed"),
	title: localizedTextSchema({ max: linkPageLimits.videoTitle, required: false }),
	url: httpUrlSchema.refine((value) => resolveLinkPageEmbed(value) !== null, "Must be a supported media link"),
});

const linkPageFormBlockSchema = z.strictObject({
	...blockBase,
	action: z
		.url()
		.refine((value) => URL.canParse(value) && new URL(value).protocol === "https:", "URLs must use HTTPS"),
	description: localizedTextSchema({ max: linkPageLimits.bio, required: false }),
	fields: z
		.array(
			z.strictObject({
				...itemBase,
				label: localizedTextSchema({ max: linkPageLimits.buttonLabel, required: true }),
				required: z.boolean(),
				type: z.enum(linkPageFormFieldTypes),
			})
		)
		.min(1)
		.max(8),
	kind: z.literal("form"),
	submitLabel: localizedTextSchema({ max: linkPageLimits.buttonLabel, required: false }),
	title: localizedTextSchema({ max: linkPageLimits.label, required: false }),
});

const linkPageMarqueeBlockSchema = z.strictObject({
	...blockBase,
	colors: z.strictObject({ ribbon: linkPageHexColorSchema, text: linkPageHexColorSchema }).nullable(),
	kind: z.literal("marquee"),
	separator: z.string().trim().max(4),
	speed: ratioSchema,
	style: z.enum(linkPageMarqueeStyles),
	text: localizedTextSchema({ max: linkPageLimits.label, required: true }),
	uppercase: z.boolean(),
});

const linkPageAnnouncementBlockSchema = z.strictObject({
	...blockBase,
	button: z
		.strictObject({
			label: localizedTextSchema({ max: linkPageLimits.buttonLabel, required: true }),
			url: linkTargetSchema,
		})
		.nullable(),
	colors: z.strictObject({ background: linkPageHexColorSchema, text: linkPageHexColorSchema }).nullable(),
	description: localizedTextSchema({ max: linkPageLimits.bio, required: false }),
	kind: z.literal("announcement"),
	layout: z.enum(linkPageAnnouncementLayouts),
	title: localizedTextSchema({ max: linkPageLimits.label, required: true }),
});

const linkPageFaqBlockSchema = z.strictObject({
	...blockBase,
	description: localizedTextSchema({ max: linkPageLimits.bio, required: false }),
	items: z
		.array(
			z.strictObject({
				...itemBase,
				answer: localizedTextSchema({ max: linkPageLimits.text, required: true }),
				question: localizedTextSchema({ max: linkPageLimits.label, required: true }),
			})
		)
		.min(1)
		.max(linkPageLimits.listItems),
	kind: z.literal("faq"),
	title: localizedTextSchema({ max: linkPageLimits.label, required: false }),
});

const linkPageTestimonialsBlockSchema = z.strictObject({
	...blockBase,
	description: localizedTextSchema({ max: linkPageLimits.bio, required: false }),
	items: z
		.array(
			z.strictObject({
				...itemBase,
				company: localizedTextSchema({ max: linkPageLimits.label, required: false }),
				imageUrl: httpUrlSchema.nullable(),
				name: localizedTextSchema({ max: linkPageLimits.label, required: true }),
				quote: localizedTextSchema({ max: linkPageLimits.text, required: true }),
				url: httpUrlSchema.nullable(),
			})
		)
		.min(1)
		.max(linkPageLimits.listItems),
	kind: z.literal("testimonials"),
	title: localizedTextSchema({ max: linkPageLimits.label, required: false }),
});

const linkPageCountdownBlockSchema = z.strictObject({
	...blockBase,
	description: localizedTextSchema({ max: linkPageLimits.bio, required: false }),
	endedMessage: localizedTextSchema({ max: linkPageLimits.label, required: false }),
	endsAt: z.iso.datetime({ offset: true }),
	kind: z.literal("countdown"),
	title: localizedTextSchema({ max: linkPageLimits.label, required: false }),
});

const linkPageVideoBlockSchema = z.strictObject({
	...blockBase,
	kind: z.literal("video"),
	title: localizedTextSchema({ max: linkPageLimits.videoTitle, required: false }),
	url: httpUrlSchema.refine((value) => resolveYouTubeVideoId(value) !== null, "Must be a YouTube video link"),
});

const linkPageCollectionBlockSchema = z.strictObject({
	...blockBase,
	collapsible: z.boolean().optional(),
	design: linkPageLinkDesignSchema.optional(),
	display: z.enum(linkPageCollectionDisplays),
	kind: z.literal("collection"),
	links: z.array(linkPageLinkSchema).max(linkPageLimits.collectionLinks),
	title: localizedTextSchema({ max: linkPageLimits.label, required: false }),
});

const linkPageSocialsBlockSchema = z.strictObject({
	...blockBase,
	display: z.enum(linkPageSocialDisplays).optional(),
	items: z.array(linkPageSocialSchema).max(linkPageLimits.socials),
	kind: z.literal("socials"),
});

export const linkPageBlockSchema = z.discriminatedUnion("kind", [
	linkPageLinkSchema,
	linkPageHeaderBlockSchema,
	linkPageTextBlockSchema,
	linkPageVideoBlockSchema,
	linkPageCollectionBlockSchema,
	linkPageSocialsBlockSchema,
	linkPageTabsBlockSchema,
	linkPageEmbedBlockSchema,
	linkPageFormBlockSchema,
	linkPageMarqueeBlockSchema,
	linkPageAnnouncementBlockSchema,
	linkPageFaqBlockSchema,
	linkPageTestimonialsBlockSchema,
	linkPageCountdownBlockSchema,
]);

export const linkPageWallpaperStyles = ["fill", "gradient", "split", "mesh", "animated", "pattern", "image"] as const;

export const linkPageWallpaperPatterns = ["polka", "stripe", "waves", "zigzag"] as const;

export const linkPageGradientDirections = ["up", "down"] as const;

export const linkPageWallpaperShaders = ["mesh", "neuro"] as const;

export const linkPageDividerRules = ["none", "solid", "dashed", "dotted", "double"] as const;

export const linkPageProfileDesigns = {
	bold: ["bold-01", "bold-02", "bold-03", "bold-04"],
	creative: ["creative-01", "creative-02", "creative-03", "creative-04"],
	minimal: ["minimal-01", "minimal-02", "minimal-03", "minimal-04"],
	studio: ["centered", "banner", "headshot", "business"],
} as const;

export const linkPageProfileLayouts = [
	"classic",
	"hero",
	...linkPageProfileDesigns.minimal,
	...linkPageProfileDesigns.creative,
	...linkPageProfileDesigns.bold,
	...linkPageProfileDesigns.studio,
] as const;

export const linkPageStudioLayouts = linkPageProfileDesigns.studio;

export const linkPageTitleSizes = ["small", "large"] as const;

export const linkPageAlignments = ["center", "start"] as const;

const linkPageFontSchema = z
	.strictObject({
		fontId: z.string().regex(/^[a-z\d]+(?:-[a-z\d]+)*$/u),
		italic: z.boolean().optional(),
		weight: z.number().int().min(100).max(1000),
	})
	.refine((font) => {
		const entry = getBrandFont({ fontId: font.fontId });

		return entry !== undefined && font.weight >= entry.weight.min && font.weight <= entry.weight.max;
	}, "Must be a catalog font with a supported weight");

const linkPageWallpaperSchema = z.strictObject({
	animation: z
		.strictObject({
			brightness: ratioSchema.optional(),
			colors: z.array(linkPageHexColorSchema).min(1).max(4),
			intensity: ratioSchema,
			scale: z.number().min(0.1).max(4),
			shader: z.enum(linkPageWallpaperShaders),
			speed: z.number().min(0).max(2),
			swirl: ratioSchema.optional(),
		})
		.optional(),
	color: linkPageHexColorSchema.optional(),
	desktopColor: linkPageHexColorSchema.optional(),
	gradient: z
		.strictObject({
			angle: z.number().min(0).max(360),
			stops: z
				.array(z.strictObject({ color: linkPageHexColorSchema, position: z.number().min(0).max(100) }))
				.min(2)
				.max(6),
		})
		.optional(),
	gradientColors: z.tuple([linkPageHexColorSchema, linkPageHexColorSchema, linkPageHexColorSchema]).optional(),
	gradientDirection: z.enum(linkPageGradientDirections),
	imageUrl: httpUrlSchema.nullable().optional(),
	noise: z.boolean().optional(),
	overlay: z.strictObject({ amount: ratioSchema, color: linkPageHexColorSchema }).optional(),
	pattern: z.enum(linkPageWallpaperPatterns),
	style: z.enum(linkPageWallpaperStyles),
});

const linkPageBannerSchema = linkPageWallpaperSchema
	.omit({ desktopColor: true })
	.extend({ fade: z.boolean().optional() });

export const linkPageAppearanceSchema = z.strictObject({
	banner: linkPageBannerSchema.nullable().optional(),
	brandOverride: brandUpdateSchema.nullable(),
	buttons: linkPageButtonAppearanceSchema,
	divider: z
		.strictObject({
			rule: z.enum(linkPageDividerRules),
			ruleWidth: ratioSchema,
			size: ratioSchema,
			spaceAbove: ratioSchema,
			spaceBelow: ratioSchema,
		})
		.nullable()
		.optional(),
	header: linkPageSurfaceAppearanceSchema.default(defaultLinkPageHeaderAppearance),
	profileImage: z
		.strictObject({
			border: ratioSchema,
			borderColor: linkPageHexColorSchema,
			shadow: ratioSchema,
			size: ratioSchema,
		})
		.nullable()
		.optional(),
	sheet: z.strictObject({ color: linkPageHexColorSchema, fade: z.boolean() }).nullable().optional(),
	socialIconSize: ratioSchema.optional(),
	socialsAtBottom: z.boolean().optional(),
	themeId: z.string().trim().min(1).max(40).nullable(),
	titleColor: linkPageHexColorSchema.nullable(),
	typography: z.strictObject({ body: linkPageFontSchema, heading: linkPageFontSchema }).nullable().optional(),
	wallpaper: linkPageWallpaperSchema,
});

export const linkPageProfileSchema = z.strictObject({
	actions: z.strictObject({ contact: z.boolean(), search: z.boolean(), share: z.boolean() }).optional(),
	alignment: z.enum(linkPageAlignments),
	bannerUrl: httpUrlSchema.nullable().optional(),
	bio: localizedTextSchema({ max: linkPageLimits.bio, required: false }),
	imageUrl: httpUrlSchema.nullable(),
	layout: z.enum(linkPageProfileLayouts),
	tagline: localizedTextSchema({ max: linkPageLimits.tagline, required: false }).optional(),
	title: localizedTextSchema({ max: linkPageLimits.title, required: true }),
	titleSize: z.enum(linkPageTitleSizes),
	verified: z.boolean().optional(),
});

const collectBlockIds = (blocks: Array<z.infer<typeof linkPageBlockSchema>>) =>
	blocks.flatMap((block) => [
		block.id,
		...(block.kind === "collection" ? block.links.map((link) => link.id) : []),
		...("items" in block ? block.items.map((item) => item.id) : []),
		...(block.kind === "form" ? block.fields.map((field) => field.id) : []),
	]);

export const linkPageDocumentSchema = z.compile(
	z
		.strictObject({
			appearance: linkPageAppearanceSchema,
			blocks: z.array(linkPageBlockSchema).max(linkPageLimits.blocks + 1),
			headerBlockIds: z
				.array(z.uuid())
				.max(linkPageLimits.blocks + 1)
				.default([]),
			profile: linkPageProfileSchema,
			redirectBlockId: z.uuid().nullable(),
			schemaVersion: z.literal(1),
		})
		.superRefine((document, context) => {
			const seen = new Set<string>();
			const blockIds = new Set(document.blocks.map((block) => block.id));

			const linkIds = new Set(
				document.blocks.flatMap((block) => {
					if (block.kind === "link") {
						return [block.id];
					}

					return block.kind === "collection" ? block.links.map((link) => link.id) : [];
				})
			);

			for (const id of collectBlockIds(document.blocks)) {
				if (seen.has(id)) {
					context.addIssue({ code: "custom", message: "Block IDs must be unique", path: ["blocks"] });
				}

				seen.add(id);
			}

			if (document.blocks.filter((block) => block.kind === "socials").length > 1) {
				context.addIssue({ code: "custom", message: "Only one social section is allowed", path: ["blocks"] });
			}

			if (document.blocks.filter((block) => block.kind !== "socials").length > linkPageLimits.blocks) {
				context.addIssue({ code: "custom", message: "Too many content sections", path: ["blocks"] });
			}

			if (document.redirectBlockId && !linkIds.has(document.redirectBlockId)) {
				context.addIssue({
					code: "custom",
					message: "Redirect must reference a link",
					path: ["redirectBlockId"],
				});
			}

			const linked = new Set<string>();

			for (const [index, id] of document.headerBlockIds.entries()) {
				if (!blockIds.has(id)) {
					context.addIssue({
						code: "custom",
						message: "Header links must reference an existing section",
						path: ["headerBlockIds", index],
					});
				}

				if (linked.has(id)) {
					context.addIssue({
						code: "custom",
						message: "Header links must be unique",
						path: ["headerBlockIds", index],
					});
				}

				linked.add(id);
			}
		})
		.meta({ id: "LinkPageDocument" })
);

const linkPagePublicationSchema = z.strictObject({
	hasUnpublishedChanges: z.boolean(),
	publishedAt: z.string().nullable(),
});

export const linkPageStateSchema = z.compile(
	z
		.strictObject({
			document: linkPageDocumentSchema,
			id: z.uuid().nullable(),
			inheritedBrand: brandFoundationSchema,
			publication: linkPagePublicationSchema,
			updatedAt: z.string().nullable(),
		})
		.meta({ id: "LinkPageState" })
);

const publishedLinkPageSchema = z.compile(
	z
		.strictObject({
			brand: brandFoundationSchema,
			document: linkPageDocumentSchema,
			publishedAt: z.string(),
		})
		.meta({ id: "PublishedLinkPage" })
);

export type LinkPageDocument = z.infer<typeof linkPageDocumentSchema>;

export type LinkPageAppearance = LinkPageDocument["appearance"];

export type LinkPageBanner = z.infer<typeof linkPageBannerSchema>;

export type LinkPageProfile = LinkPageDocument["profile"];

export type LinkPageBlock = z.infer<typeof linkPageBlockSchema>;

export type LinkPageBlockKind = LinkPageBlock["kind"];

export type LinkPageLink = z.infer<typeof linkPageLinkSchema>;

export type LinkPageCollectionBlock = z.infer<typeof linkPageCollectionBlockSchema>;

export type LinkPageSocialsBlock = z.infer<typeof linkPageSocialsBlockSchema>;

export type LinkPageSocial = z.infer<typeof linkPageSocialSchema>;

export type LinkPageSocialPlatform = z.infer<typeof linkPageSocialPlatformSchema>;

export type LinkPageLocale = BrandLocale;

export type LinkPageFont = z.infer<typeof linkPageFontSchema>;

export type LinkPageWallpaper = z.infer<typeof linkPageWallpaperSchema>;

export type LinkPageStudioLayout = (typeof linkPageStudioLayouts)[number];

export type LinkPageState = z.infer<typeof linkPageStateSchema>;

export type PublishedLinkPage = z.infer<typeof publishedLinkPageSchema>;

export type LocalizedLinkPageText = Partial<Record<string, string>>;

export const defaultLinkPageBrand = brandFoundationSchema.parse({
	colors: {
		background: "#ffffff",
		neutral: "#18181b",
		primary: "#6857d4",
		secondary: "#10b981",
		tertiary: "#ede9fe",
	},
	corners: { style: "rounded" },
	defaultLocale: "en",
	locales: ["en", "ar"],
	schemaVersion: 1,
	typography: { catalogVersion: 1, ...brandFontPairings.minimal },
});

export const defaultLinkPageAppearance: LinkPageAppearance = {
	brandOverride: null,
	buttons: { colors: { button: null, shadow: null, text: null }, shadow: "none", style: "solid" },
	header: defaultLinkPageHeaderAppearance,
	themeId: null,
	titleColor: null,
	wallpaper: { gradientDirection: "down", pattern: "polka", style: "fill" },
};
