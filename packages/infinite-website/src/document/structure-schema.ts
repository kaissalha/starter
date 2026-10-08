import { z } from "zod";

import {
	behaviorKeySchema,
	decimalValueSchema,
	siteBehaviorValueFormatSchema,
	type SiteBehaviorValueFormatV1,
} from "../behavior/contracts";
import { siteDocumentResourceLimits } from "../resource-limits";
import {
	anchorSchema,
	assetReferenceSchema,
	entityIdSchema,
	linkReferenceSchema,
	type LinkValue,
	patternKeySchema,
	settingReferenceSchema,
	textReferenceSchema,
	type AssetReference,
	type LinkReference,
	type SettingReference,
	type TextReference,
} from "./content-schema";

export const pixelLengthSchema = z.compile(z.number());

export const lengthSchema = z.compile(
	z.union([
		pixelLengthSchema,
		z.enum([
			"auto",
			"full",
			"viewport",
			"viewport-minus-gutter",
			"bleed-offset",
			"viewport-bleed-offset",
			"min-content",
			"max-content",
			"fit-content",
		]),
		z.string().regex(/^(?:0|-?(?:\d+|\d*\.\d+)(?:px|em|rem|%|cqi|cqw|svh|vh|sp))$/u),
	])
);

export const translateLengthSchema = z.compile(
	z.union([pixelLengthSchema, z.string().regex(/^(?:0|-?(?:\d+|\d*\.\d+)(?:px|em|rem|%|cqi|cqw|svh|vh))$/u)])
);

const responsive = <TSchema extends z.ZodType>(schema: TSchema) =>
	z.union([
		schema,
		z.strictObject({
			base: schema,
			compact: schema.optional(),
			medium: schema.optional(),
			wide: schema.optional(),
		}),
	]);

const responsiveLengthSchema = responsive(lengthSchema);

const edges = <TSchema extends z.ZodType>(schema: TSchema) =>
	z.strictObject({
		blockEnd: schema.optional(),
		blockStart: schema.optional(),
		inlineEnd: schema.optional(),
		inlineStart: schema.optional(),
	});

export const alignmentSchema = z.compile(z.enum(["start", "center", "end"]));

export const crossAlignmentSchema = z.compile(z.enum(["start", "center", "end", "stretch"]));

const surfaceSchema = z.enum(["canvas", "subtle", "featured", "tint", "transparent"]);

export const fillSchema = z.compile(
	z.enum(["canvas", "subtle", "featured", "tint", "transparent", "border", "action", "accent", "black", "current"])
);

export const foregroundSchema = z.compile(
	z.enum(["primary", "muted", "media", "featured", "action", "accent", "accent-text", "current"])
);

const cornerRadiusSchema = z.union([z.enum(["none", "theme", "full"]), lengthSchema]);

export const radiusSchema = z.compile(
	z.union([
		cornerRadiusSchema,
		z.strictObject({
			endEnd: cornerRadiusSchema.optional(),
			endStart: cornerRadiusSchema.optional(),
			startEnd: cornerRadiusSchema.optional(),
			startStart: cornerRadiusSchema.optional(),
		}),
	])
);

export const typographyAppearanceSchema = z.compile(
	z.enum([
		"display-2xl",
		"display-xl",
		"display-lg",
		"display-md",
		"display-sm",
		"display-xs",
		"heading-lg",
		"heading-md",
		"heading-sm",
		"heading-xs",
		"title-lg",
		"title-md",
		"title-sm",
		"title-xs",
		"body-lg",
		"body-md",
		"body-sm",
		"body-xs",
		"body-lg-em",
		"body-md-em",
		"body-sm-em",
		"body-xs-em",
		"label-lg",
		"label-md",
		"label-sm",
		"code",
		"watermark",
	])
);

export const siteNodeLayoutFields = {
	aspectRatio: responsive(
		z.union([z.literal("auto"), z.strictObject({ height: z.number().positive(), width: z.number().positive() })])
	).optional(),
	blockSize: responsiveLengthSchema.optional(),
	gridColumn: responsive(z.strictObject({ span: z.number().int().positive(), start: z.number().int() })).optional(),
	gridRow: responsive(z.strictObject({ span: z.number().int().positive(), start: z.number().int() })).optional(),
	grow: z.number().nonnegative().optional(),
	inlineSize: responsiveLengthSchema.optional(),
	inset: responsive(edges(lengthSchema)).optional(),
	margin: responsive(edges(lengthSchema)).optional(),
	maxBlockSize: responsiveLengthSchema.optional(),
	maxInlineSize: responsiveLengthSchema.optional(),
	minBlockSize: responsiveLengthSchema.optional(),
	minInlineSize: responsiveLengthSchema.optional(),
	order: responsive(z.number().int()).optional(),
	overflow: responsive(z.enum(["visible", "hidden", "clip", "auto", "scroll"])).optional(),
	padding: responsive(edges(lengthSchema)).optional(),
	position: responsive(z.enum(["static", "relative", "absolute", "sticky", "fixed"])).optional(),
	shrink: z.number().nonnegative().optional(),
	translate: responsive(
		z.strictObject({ block: translateLengthSchema.optional(), inline: translateLengthSchema.optional() })
	).optional(),
	visibility: responsive(z.enum(["visible", "hidden", "removed"])).optional(),
	zIndex: z.number().int().optional(),
};

export const layoutSchema = z.compile(z.strictObject(siteNodeLayoutFields).meta({ id: "SiteNodeLayout" }));

export const borderSchema = z.compile(
	z.strictObject({
		color: z.enum(["border", "accent", "action", "current"]),
		sides: z.array(z.enum(["block-start", "inline-end", "block-end", "inline-start"])).optional(),
		width: lengthSchema,
	})
);

export const siteBoxAppearanceFields = {
	background: z
		.strictObject({
			angle: z.number(),
			kind: z.literal("linear-gradient"),
			stops: z.array(
				z.strictObject({
					color: z.enum(["transparent", "black", "featured"]),
					opacity: z.number().min(0).max(1).optional(),
					position: z.number(),
				})
			),
		})
		.optional(),
	border: borderSchema.optional(),
	fill: fillSchema.optional(),
	fillOpacity: responsive(z.number().min(0).max(1)).optional(),
	foreground: foregroundSchema.optional(),
	opacity: z.number().min(0).max(1).optional(),
	pattern: z.enum(["diagonal-slash"]).optional(),
	radius: radiusSchema.optional(),
};

export const siteTextAppearanceFields = {
	align: responsive(alignmentSchema).optional(),
	appearance: typographyAppearanceSchema.optional(),
	decoration: z.enum(["underline", "line-through"]).optional(),
	font: z.enum(["brand", "body", "mono"]).optional(),
	fontSize: responsiveLengthSchema.optional(),
	lineHeight: z.number().positive().optional(),
	style: z.enum(["normal", "italic"]).optional(),
	tone: foregroundSchema.optional(),
	tracking: lengthSchema.optional(),
	transform: z.enum(["none", "uppercase"]).optional(),
	weight: z.enum(["light", "normal", "medium", "semibold", "bold", "theme"]).optional(),
	wrap: z.enum(["normal", "balance", "pretty"]).optional(),
};

export const siteTextNodeFields = {
	element: z.enum(["p", "span", "h1", "h2", "h3", "h4"]).optional(),
	scrollReveal: z.boolean().optional(),
};

export const boxAppearanceSchema = z.compile(z.strictObject(siteBoxAppearanceFields).meta({ id: "SiteBoxAppearance" }));

export const textAppearanceSchema = z.compile(
	z.strictObject(siteTextAppearanceFields).meta({ id: "SiteTextAppearance" })
);

const gridTrackSchema = z.union([
	z.strictObject({ fraction: z.number().positive() }),
	z.strictObject({
		max: z.union([lengthSchema, z.strictObject({ fraction: z.number().positive() })]),
		min: lengthSchema,
	}),
	lengthSchema,
]);

export const siteFlexPropsFields = {
	align: responsive(crossAlignmentSchema).optional(),
	direction: responsive(z.enum(["row", "row-reverse", "column", "column-reverse"])),
	gap: responsiveLengthSchema.optional(),
	justify: responsive(z.enum(["start", "center", "end", "between", "around", "evenly"])).optional(),
	wrap: responsive(z.enum(["nowrap", "wrap", "wrap-reverse"])).optional(),
};

export const flexPropsSchema = z.compile(z.strictObject(siteFlexPropsFields).meta({ id: "SiteFlexProps" }));

export const siteGridPropsFields = {
	align: responsive(crossAlignmentSchema).optional(),
	autoFlow: responsive(z.enum(["row", "column", "dense"])).optional(),
	columnGap: responsiveLengthSchema.optional(),
	columns: responsive(z.union([z.number().int().positive(), z.array(gridTrackSchema)])),
	gap: responsiveLengthSchema.optional(),
	justify: responsive(crossAlignmentSchema).optional(),
	rowGap: responsiveLengthSchema.optional(),
	rows: responsive(z.union([z.number().int().positive(), z.array(gridTrackSchema)])).optional(),
};

export const gridPropsSchema = z.compile(z.strictObject(siteGridPropsFields).meta({ id: "SiteGridProps" }));

export const mediaOverlaySchema = z.discriminatedUnion("kind", [
	z.strictObject({
		kind: z.literal("scrim"),
		strength: z.enum(["subtle", "medium", "strong"]),
	}),
	z.strictObject({
		angle: z.number(),
		kind: z.literal("linear-gradient"),
		stops: z
			.array(
				z.strictObject({
					opacity: z.number().min(0).max(1),
					position: z.number().min(0).max(100),
				})
			)
			.min(2),
	}),
]);

export const videoPlaybackSchema = z.compile(z.enum(["player", "background"]));

export const iconNameSchema = z.compile(
	z.enum([
		"chevron-down",
		"chevron-start",
		"chevron-end",
		"menu",
		"plus",
		"email",
		"phone",
		"location-pin",
		"instagram",
		"facebook",
		"pinterest",
		"x",
		"linkedin",
		"youtube",
		"arrow-end",
		"arrow-start",
		"arrow-up-right",
		"calendar",
		"check",
		"check-circle",
		"clock",
		"dot",
		"minus",
		"quote",
		"x-mark",
	])
);

export const siteMediaAppearanceFields = {
	...siteBoxAppearanceFields,
	clip: z.boolean().optional(),
	contentScale: z.number().positive().optional(),
	filter: z.enum(["grayscale", "silhouette", "silhouette-light"]).optional(),
	fit: z.enum(["cover", "contain"]).optional(),
	focal: z.strictObject({ x: z.number(), y: z.number() }).optional(),
	hoverOpacity: z.number().min(0).max(1).optional(),
	imageOpacity: z.number().min(0).max(1).optional(),
	intrinsicInlineSize: z.boolean().optional(),
	objectAlign: alignmentSchema.optional(),
	overlay: mediaOverlaySchema.optional(),
	playback: videoPlaybackSchema.optional(),
};

export const siteIconAppearanceFields = {
	filled: z.boolean().optional(),
	name: iconNameSchema,
	size: responsiveLengthSchema.optional(),
	tone: foregroundSchema.optional(),
};

export const siteActionAppearanceFields = { ...siteBoxAppearanceFields, ...siteTextAppearanceFields };

export const googleMapSettingsSchema = z
	.strictObject({ map: z.strictObject({ type: z.enum(["roadmap", "satellite"]), zoom: z.number().min(0).max(22) }) })
	.default({ map: { type: "roadmap", zoom: 15 } });

export type Responsive<T> = T | { base: T; compact?: T; medium?: T; wide?: T };

export type Edges<T> = {
	blockEnd?: T;
	blockStart?: T;
	inlineEnd?: T;
	inlineStart?: T;
};

export type Alignment = z.infer<typeof alignmentSchema>;

export type Border = z.infer<typeof borderSchema>;

export type BoxAppearance = z.infer<typeof boxAppearanceSchema>;

export type CrossAlignment = z.infer<typeof crossAlignmentSchema>;

export type Fill = z.infer<typeof fillSchema>;

export type Foreground = z.infer<typeof foregroundSchema>;

export type Layout = z.infer<typeof layoutSchema>;

export type Length = z.infer<typeof lengthSchema>;

export type MediaOverlay = z.infer<typeof mediaOverlaySchema>;

export type Radius = z.infer<typeof radiusSchema>;

export type Surface = z.infer<typeof surfaceSchema>;

export type TextAppearance = z.infer<typeof textAppearanceSchema>;

export type TypographyAppearance = z.infer<typeof typographyAppearanceSchema>;

export type TranslateLength = z.infer<typeof translateLengthSchema>;

export type VideoPlayback = z.infer<typeof videoPlaybackSchema>;

export type AssetRef = { alt: string; assetId: string };

export type FocalPoint = { x: number; y: number };

export type ResolvedLink = { href: string; kind: LinkValue["kind"] };

export type GridTrack = { fraction: number } | { max: Length | { fraction: number }; min: Length } | Length;

type ResolvedNodeContent = { asset: string; link: ResolvedLink; text: string };

type PersistedNodeContent = { asset: AssetReference; link: LinkReference; text: TextReference };

type NodeContent = PersistedNodeContent | ResolvedNodeContent;

type SettingValue<TContent extends NodeContent, TValue> =
	| TValue
	| (TContent extends PersistedNodeContent ? SettingReference : never);

type BaseNode = { id: string; key?: string; layout?: Layout; visibleWhen?: string };

export type BoxHoverReveal<TContent extends NodeContent = ResolvedNodeContent> = {
	backdrop: Array<SiteNode<TContent>>;
	cover: BoxAppearance;
	replacement: Array<SiteNode<TContent>>;
	replacementForeground?: Foreground;
};

export type BoxScrollReveal = { animation: "rise" | "zoom" | "fade"; delayMs?: number; durationMs?: number };

export type BoxNode<TContent extends NodeContent = ResolvedNodeContent> = BaseNode & {
	props: BoxAppearance & {
		children: Array<SiteNode<TContent>>;
		decorative?: boolean;
		hoverReveal?: BoxHoverReveal<TContent>;
		reveal?: BoxScrollReveal;
	};
	type: "box";
};

export type FlexNode<TContent extends NodeContent = ResolvedNodeContent> = BaseNode & {
	props: BoxAppearance & z.infer<typeof flexPropsSchema> & { children: Array<SiteNode<TContent>> };
	type: "flex";
};

export type GridNode<TContent extends NodeContent = ResolvedNodeContent> = BaseNode & {
	props: BoxAppearance & z.infer<typeof gridPropsSchema> & { children: Array<SiteNode<TContent>> };
	type: "grid";
};

export type TextNode<TContent extends NodeContent = ResolvedNodeContent> = BaseNode & {
	props: TextAppearance & {
		content: TContent["text"];
		element?: "p" | "span" | "h1" | "h2" | "h3" | "h4";
		scrollReveal?: boolean;
	};
	type: "text";
};

export type FieldNode<TContent extends NodeContent = ResolvedNodeContent> = BaseNode & {
	props: {
		children: Array<SiteNode<TContent>>;
		disabledWhen?: string;
		emptyValue?: string;
		invalid?: TContent["text"];
		placeholder?: TContent["text"];
		slot: string;
	};
	type: "field";
};

export type ValueNode<TContent extends NodeContent = ResolvedNodeContent> = BaseNode & {
	props: {
		children: Array<SiteNode<TContent>>;
		format: SettingValue<TContent, SiteBehaviorValueFormatV1>;
		unavailable: TContent["text"];
		value: string;
	};
	type: "value";
};

export type TriggerNode<TContent extends NodeContent = ResolvedNodeContent> = BaseNode & {
	props: { children: Array<SiteNode<TContent>>; disabledWhen?: string; event: string; label: TContent["text"] };
	type: "trigger";
};

export type MediaNode<TContent extends NodeContent = ResolvedNodeContent> = BaseNode & {
	props: BoxAppearance & {
		alt: TContent["text"];
		assetId: TContent["asset"];
		clip?: boolean;
		contentScale?: number;
		filter?: "grayscale" | "silhouette" | "silhouette-light";
		fit?: "cover" | "contain";
		focal?: FocalPoint;
		hoverOpacity?: number;
		imageOpacity?: number;
		intrinsicInlineSize?: boolean;
		objectAlign?: Alignment;
		overlay?: MediaOverlay;
		playback?: VideoPlayback;
	};
	type: "media";
};

export type IconName = z.infer<typeof iconNameSchema>;

export type IconNode<TContent extends NodeContent = ResolvedNodeContent> = BaseNode & {
	props: { filled?: boolean; label?: TContent["text"]; name: IconName; size?: Responsive<Length>; tone?: Foreground };
	type: "icon";
};

export type ActionNode<TContent extends NodeContent = ResolvedNodeContent> = BaseNode & {
	props: BoxAppearance & TextAppearance & { children: Array<SiteNode<TContent>>; href: TContent["link"] };
	type: "action";
};

type ContactFormLabelKey =
	| "anotherLabel"
	| "emailLabel"
	| "error"
	| "messageLabel"
	| "nameLabel"
	| "pendingLabel"
	| "submitLabel"
	| "success";

export type EmbedNode<TContent extends NodeContent = ResolvedNodeContent> = BaseNode & {
	props: BoxAppearance &
		(
			| {
					config: {
						address: TContent["text"];
						coordinates?: SettingValue<TContent, { lat: number; lng: number }>;
						mapType?: SettingValue<TContent, "roadmap" | "satellite">;
						zoom?: SettingValue<TContent, number>;
					};
					effect?: { intensity: number; kind: "tint" };
					label: TContent["text"];
					provider: "google-map";
			  }
			| {
					config: {
						columns?: 1 | 2;
						labels: { [Key in ContactFormLabelKey]: TContent["text"] } & { phoneLabel?: TContent["text"] };
						submitWidth?: "fit" | "full";
					};
					label: TContent["text"];
					provider: "contact-form";
			  }
		);
	type: "embed";
};

export type CarouselControl<TContent extends NodeContent = ResolvedNodeContent> =
	| {
			appearance?: BoxAppearance;
			corners?: "pill" | "round" | "square";
			icon?: "arrow" | "chevron";
			iconSize?: Length;
			kind: "previous" | "next";
			label: TContent["text"];
			size?: Responsive<Length>;
			stretch?: boolean;
			visibility?: Responsive<"visible" | "hidden" | "removed">;
	  }
	| {
			active: { blockSize: Length; inlineSize: Length; opacity: number };
			appearance?: BoxAppearance & { gap?: Length; padding?: Edges<Length> };
			inactive: { blockSize: Length; inlineSize: Length; opacity: number };
			kind: "indicators";
			label: TContent["text"];
			spacing?: Length;
			visibility?: Responsive<"visible" | "hidden" | "removed">;
	  }
	| {
			appearance?: BoxAppearance & TextAppearance & { padding?: Edges<Length> };
			bar?: Length;
			kind: "counter";
			pad?: number;
			separator?: string;
			visibility?: Responsive<"visible" | "hidden" | "removed">;
	  };

export type CarouselNode<TContent extends NodeContent = ResolvedNodeContent> = BaseNode & {
	props: {
		autoplay?: { delay: number; pauseOnFocus?: boolean; pauseOnHover?: boolean };
		controlGroups: Array<{
			align: Alignment;
			appearance?: BoxAppearance;
			controls: Array<CarouselControl<TContent>>;
			gap?: Length;
			id: string;
			layout?: Layout;
			placement: "before" | "after" | "header";
		}>;
		controlsGap?: Responsive<Length>;
		edgeFade?: { size?: Length };
		gap?: Responsive<Length>;
		header?: BoxAppearance &
			z.infer<typeof flexPropsSchema> & { children: Array<SiteNode<TContent>>; layout?: Layout };
		inactiveOpacity?: number;
		inactiveScale?: number;
		label: TContent["text"];
		marquee?: { direction?: "backward" | "forward"; pauseOnHover?: boolean; speed: number };
		options?: {
			align?: Alignment;
			axis?: "x" | "y";
			containScroll?: "trim-snaps" | "keep-snaps" | false;
			draggable?: boolean;
			duration?: number;
			loop?: boolean;
			slidesToScroll?: number | "auto";
			startIndex?: number;
			transition?: "fade" | "slide";
		};
		slideBasis: Responsive<Length>;
		slideEffect?: {
			aspectRatio?: { center: number; edge: number; side: number };
			opacity?: { side: number };
		};
		slides: Array<SiteNode<TContent>>;
		slideSizing?: "exact" | "gap-inclusive";
		trackLayout?: Layout;
		viewportLayout?: Layout;
	};
	type: "carousel";
};

export type DisclosureNode<TContent extends NodeContent = ResolvedNodeContent> = BaseNode & {
	props: {
		defaultOpen?: "none" | "first";
		divider?: boolean | "between";
		items: Array<{ id: string; panel: Array<SiteNode<TContent>>; trigger: Array<SiteNode<TContent>> }>;
		multiple?: boolean;
		openIndicator?: "none" | "rotate-45" | "rotate-180";
		panelPadding?: Responsive<Length>;
		triggerPadding?: Responsive<Length>;
	};
	type: "disclosure";
};

export type MenuNode<TContent extends NodeContent = ResolvedNodeContent> = BaseNode & {
	props: BoxAppearance & {
		actions: Array<SiteNode<TContent>>;
		align?: Alignment;
		brand: Array<SiteNode<TContent>>;
		collapseAt?: "compact" | "medium" | "wide" | "always";
		itemAppearance?: BoxAppearance & { padding?: Edges<Length> };
		itemGap?: Length;
		items: Array<{
			href: TContent["link"];
			id: string;
			mobileTrigger?: Array<SiteNode<TContent>>;
			panel?: Array<SiteNode<TContent>>;
			trigger: Array<SiteNode<TContent>>;
		}>;
		label: TContent["text"];
		menuTriggerSide?: "start" | "end";
		mobileLabel: TContent["text"];
		mobileTriggerAppearance?: BoxAppearance;
		popupAppearance?: BoxAppearance & { padding?: Edges<Length> };
		showMenuDivider?: boolean;
		socialActions?: Array<SiteNode<TContent>>;
	};
	type: "menu";
};

export type MasonryNode<TContent extends NodeContent = ResolvedNodeContent> = BaseNode & {
	props: { children: Array<SiteNode<TContent>>; columns: Responsive<number>; gap?: Responsive<Length> };
	type: "masonry";
};

export type TabDecorationScope = "all" | "first" | "last" | "not-first" | "not-last";

export type TabDecoration =
	| {
			appearance?: BoxAppearance;
			axis?: "inline" | "block" | "both" | "none";
			kind: "fill";
			layout?: Layout;
			scope?: TabDecorationScope;
			source: "static" | "active" | "completed" | "autoplay" | "timer";
			transitionMs?: number;
	  }
	| {
			appearance?: BoxAppearance;
			kind: "ring";
			layout?: Layout;
			scope?: TabDecorationScope;
			size: Length;
			source: "active" | "completed" | "autoplay" | "timer";
			thickness?: number;
			transitionMs?: number;
	  };

export type TabsNode<TContent extends NodeContent = ResolvedNodeContent> = BaseNode & {
	props: {
		activateOnFocus?: boolean;
		activeShift?: Length;
		arrangement?: z.infer<typeof gridPropsSchema>;
		autoplay?: { intervalMs: number; pauseOnHover?: boolean; startDelayMs?: number };
		crossfadeMs?: number;
		decorations?: Array<TabDecoration>;
		defaultValue?: string;
		detailMode?: "collapse" | "fade";
		expandActive?: { inactiveSize: Length };
		inactiveOpacity?: number;
		indicator?: boolean;
		indicatorAppearance?: BoxAppearance;
		indicatorThickness?: Length;
		itemAppearance?: BoxAppearance & { padding?: Edges<Length> };
		itemFlex?: Partial<z.infer<typeof flexPropsSchema>>;
		itemLayout?: Layout;
		items: Array<{
			detail?: Array<SiteNode<TContent>>;
			disabled?: boolean;
			id: string;
			panel: Array<SiteNode<TContent>>;
			trigger: Array<SiteNode<TContent>>;
			value: string;
		}>;
		label: TContent["text"];
		lead?: Array<SiteNode<TContent>>;
		listAppearance?: BoxAppearance & { gap?: Length; padding?: Edges<Length> };
		listLayout?: Layout;
		listPlacement?: "before" | "after";
		loopFocus?: boolean;
		openIndicator?: "none" | "rotate-180";
		orientation?: "horizontal" | "vertical";
		panels?: "swap" | "crossfade" | "track";
		panelsLayout?: Layout;
		slideBasis?: Responsive<Length>;
		slideGap?: Responsive<Length>;
		tabAppearance?: BoxAppearance & { padding?: Edges<Length> };
	};
	type: "tabs";
};

export type SiteNode<TContent extends NodeContent = ResolvedNodeContent> =
	| ActionNode<TContent>
	| BoxNode<TContent>
	| CarouselNode<TContent>
	| DisclosureNode<TContent>
	| EmbedNode<TContent>
	| FieldNode<TContent>
	| FlexNode<TContent>
	| GridNode<TContent>
	| IconNode<TContent>
	| MasonryNode<TContent>
	| MediaNode<TContent>
	| MenuNode<TContent>
	| TabsNode<TContent>
	| TextNode<TContent>
	| TriggerNode<TContent>
	| ValueNode<TContent>;

export type PersistedSiteNode = SiteNode<PersistedNodeContent>;

type WithoutEntityIds<T> =
	T extends ReadonlyArray<infer TItem>
		? Array<WithoutEntityIds<TItem>>
		: T extends object
			? { [TKey in keyof T as TKey extends "id" ? never : TKey]: WithoutEntityIds<T[TKey]> }
			: T;

export type SiteNodeDefinition = WithoutEntityIds<PersistedSiteNode>;

export const sectionCategories = [
	"header",
	"hero",
	"content",
	"features",
	"logos",
	"gallery",
	"showcase",
	"metrics",
	"testimonials",
	"team",
	"pricing",
	"faq",
	"call-to-action",
	"contact",
	"location",
	"embed",
	"footer",
] as const;

export const nodeKeySchema = z.compile(z.string().regex(/^[a-z][a-z0-9-]{0,63}$/u));

const baseNodeFields = {
	id: entityIdSchema,
	key: nodeKeySchema.optional(),
	layout: layoutSchema.optional(),
	visibleWhen: behaviorKeySchema.optional(),
};

const childNodesSchema: z.ZodType<Array<PersistedSiteNode>> = z.lazy(() => z.array(siteNodeSchema));

const carouselControlSchema = z.discriminatedUnion("kind", [
	z.strictObject({
		appearance: z.strictObject(siteBoxAppearanceFields).optional(),
		corners: z.enum(["pill", "round", "square"]).optional(),
		icon: z.enum(["arrow", "chevron"]).optional(),
		iconSize: lengthSchema.optional(),
		kind: z.enum(["previous", "next"]),
		label: textReferenceSchema,
		size: responsiveLengthSchema.optional(),
		stretch: z.boolean().optional(),
		visibility: responsive(z.enum(["visible", "hidden", "removed"])).optional(),
	}),
	z.strictObject({
		active: z.strictObject({ blockSize: lengthSchema, inlineSize: lengthSchema, opacity: z.number() }),
		appearance: z
			.strictObject({
				...siteBoxAppearanceFields,
				gap: lengthSchema.optional(),
				padding: edges(lengthSchema).optional(),
			})
			.optional(),
		inactive: z.strictObject({ blockSize: lengthSchema, inlineSize: lengthSchema, opacity: z.number() }),
		kind: z.literal("indicators"),
		label: textReferenceSchema,
		spacing: lengthSchema.optional(),
		visibility: responsive(z.enum(["visible", "hidden", "removed"])).optional(),
	}),
	z.strictObject({
		appearance: z
			.strictObject({
				...siteBoxAppearanceFields,
				...siteTextAppearanceFields,
				padding: edges(lengthSchema).optional(),
			})
			.optional(),
		bar: lengthSchema.optional(),
		kind: z.literal("counter"),
		pad: z.number().int().nonnegative().optional(),
		separator: z.string().optional(),
		visibility: responsive(z.enum(["visible", "hidden", "removed"])).optional(),
	}),
]);

const tabDecorationScopeSchema = z.enum(["all", "first", "last", "not-first", "not-last"]);

const tabDecorationSchema = z.discriminatedUnion("kind", [
	z.strictObject({
		appearance: z.strictObject(siteBoxAppearanceFields).optional(),
		axis: z.enum(["inline", "block", "both", "none"]).optional(),
		kind: z.literal("fill"),
		layout: layoutSchema.optional(),
		scope: tabDecorationScopeSchema.optional(),
		source: z.enum(["static", "active", "completed", "autoplay", "timer"]),
		transitionMs: z.number().int().min(0).max(5000).optional(),
	}),
	z.strictObject({
		appearance: z.strictObject(siteBoxAppearanceFields).optional(),
		kind: z.literal("ring"),
		layout: layoutSchema.optional(),
		scope: tabDecorationScopeSchema.optional(),
		size: lengthSchema,
		source: z.enum(["active", "completed", "autoplay", "timer"]),
		thickness: z.number().min(1).max(20).optional(),
		transitionMs: z.number().int().min(0).max(5000).optional(),
	}),
]);

const siteNodeSchemas = [
	z.strictObject({
		...baseNodeFields,
		props: z.strictObject({
			...siteBoxAppearanceFields,
			children: childNodesSchema,
			decorative: z.boolean().optional(),
			hoverReveal: z
				.strictObject({
					backdrop: childNodesSchema,
					cover: z.strictObject(siteBoxAppearanceFields),
					replacement: childNodesSchema,
					replacementForeground: foregroundSchema.optional(),
				})
				.optional(),
			reveal: z
				.strictObject({
					animation: z.enum(["rise", "zoom", "fade"]),
					delayMs: z.number().int().min(0).max(2000).optional(),
					durationMs: z.number().int().min(100).max(2000).optional(),
				})
				.optional(),
		}),
		type: z.literal("box"),
	}),
	z.strictObject({
		...baseNodeFields,
		props: flexPropsSchema.extend({ ...siteBoxAppearanceFields, children: childNodesSchema }),
		type: z.literal("flex"),
	}),
	z.strictObject({
		...baseNodeFields,
		props: gridPropsSchema.extend({ ...siteBoxAppearanceFields, children: childNodesSchema }),
		type: z.literal("grid"),
	}),
	z.strictObject({
		...baseNodeFields,
		props: z.strictObject({
			...siteTextAppearanceFields,
			...siteTextNodeFields,
			content: textReferenceSchema,
		}),
		type: z.literal("text"),
	}),
	z.strictObject({
		...baseNodeFields,
		props: z.strictObject({
			children: childNodesSchema,
			disabledWhen: behaviorKeySchema.optional(),
			emptyValue: decimalValueSchema.optional(),
			invalid: textReferenceSchema.optional(),
			placeholder: textReferenceSchema.optional(),
			slot: behaviorKeySchema,
		}),
		type: z.literal("field"),
	}),
	z.strictObject({
		...baseNodeFields,
		props: z.strictObject({
			children: childNodesSchema,
			emphasis: z.enum(["primary", "secondary"]).optional(),
			format: z.union([siteBehaviorValueFormatSchema, settingReferenceSchema]),
			unavailable: textReferenceSchema,
			value: behaviorKeySchema,
		}),
		type: z.literal("value"),
	}),
	z.strictObject({
		...baseNodeFields,
		props: z.strictObject({
			children: childNodesSchema,
			disabledWhen: behaviorKeySchema.optional(),
			event: behaviorKeySchema,
			label: textReferenceSchema,
		}),
		type: z.literal("trigger"),
	}),
	z.strictObject({
		...baseNodeFields,
		props: z.strictObject({
			...siteMediaAppearanceFields,
			alt: textReferenceSchema,
			assetId: assetReferenceSchema,
		}),
		type: z.literal("media"),
	}),
	z.strictObject({
		...baseNodeFields,
		props: z.strictObject({
			...siteIconAppearanceFields,
			label: textReferenceSchema.optional(),
		}),
		type: z.literal("icon"),
	}),
	z.strictObject({
		...baseNodeFields,
		props: z.strictObject({
			...siteActionAppearanceFields,
			children: childNodesSchema,
			href: linkReferenceSchema,
		}),
		type: z.literal("action"),
	}),
	z.strictObject({
		...baseNodeFields,
		props: z.discriminatedUnion("provider", [
			z.strictObject({
				...siteBoxAppearanceFields,
				config: z.strictObject({
					address: textReferenceSchema,
					coordinates: z
						.union([z.strictObject({ lat: z.number(), lng: z.number() }), settingReferenceSchema])
						.optional(),
					mapType: z.union([z.enum(["roadmap", "satellite"]), settingReferenceSchema]).optional(),
					zoom: z.union([z.number(), settingReferenceSchema]).optional(),
				}),
				effect: z.strictObject({ intensity: z.number(), kind: z.literal("tint") }).optional(),
				label: textReferenceSchema,
				provider: z.literal("google-map"),
			}),
			z.strictObject({
				...siteBoxAppearanceFields,
				config: z.strictObject({
					columns: z.union([z.literal(1), z.literal(2)]).optional(),
					labels: z.strictObject({
						anotherLabel: textReferenceSchema,
						emailLabel: textReferenceSchema,
						error: textReferenceSchema,
						messageLabel: textReferenceSchema,
						nameLabel: textReferenceSchema,
						pendingLabel: textReferenceSchema,
						phoneLabel: textReferenceSchema.optional(),
						submitLabel: textReferenceSchema,
						success: textReferenceSchema,
					}),
					submitWidth: z.enum(["fit", "full"]).optional(),
				}),
				label: textReferenceSchema,
				provider: z.literal("contact-form"),
			}),
		]),
		type: z.literal("embed"),
	}),
	z.strictObject({
		...baseNodeFields,
		props: z.strictObject({
			autoplay: z
				.strictObject({
					delay: z.number().min(1000).max(60_000),
					pauseOnFocus: z.boolean().optional(),
					pauseOnHover: z.boolean().optional(),
				})
				.optional(),
			controlGroups: z.array(
				z.strictObject({
					align: alignmentSchema,
					appearance: z.strictObject(siteBoxAppearanceFields).optional(),
					controls: z.array(carouselControlSchema),
					gap: lengthSchema.optional(),
					id: entityIdSchema,
					layout: layoutSchema.optional(),
					placement: z.enum(["before", "after", "header"]),
				})
			),
			controlsGap: responsiveLengthSchema.optional(),
			edgeFade: z.strictObject({ size: lengthSchema.optional() }).optional(),
			gap: responsiveLengthSchema.optional(),
			header: flexPropsSchema
				.extend({ ...siteBoxAppearanceFields, children: childNodesSchema, layout: layoutSchema.optional() })
				.optional(),
			inactiveOpacity: z.number().min(0).max(1).optional(),
			inactiveScale: z.number().positive().max(2).optional(),
			label: textReferenceSchema,
			marquee: z
				.strictObject({
					direction: z.enum(["backward", "forward"]).optional(),
					pauseOnHover: z.boolean().optional(),
					speed: z.number().positive().max(10),
				})
				.optional(),
			options: z
				.strictObject({
					align: alignmentSchema.optional(),
					axis: z.enum(["x", "y"]).optional(),
					containScroll: z.union([z.enum(["trim-snaps", "keep-snaps"]), z.literal(false)]).optional(),
					draggable: z.boolean().optional(),
					duration: z.number().positive().optional(),
					loop: z.boolean().optional(),
					slidesToScroll: z.union([z.number().int().positive(), z.literal("auto")]).optional(),
					startIndex: z.number().int().nonnegative().optional(),
					transition: z.enum(["fade", "slide"]).optional(),
				})
				.optional(),
			slideBasis: responsiveLengthSchema,
			slideEffect: z
				.strictObject({
					aspectRatio: z
						.strictObject({
							center: z.number().positive(),
							edge: z.number().positive(),
							side: z.number().positive(),
						})
						.optional(),
					opacity: z.strictObject({ side: z.number().min(0).max(1) }).optional(),
				})
				.optional(),
			slides: childNodesSchema,
			slideSizing: z.enum(["exact", "gap-inclusive"]).optional(),
			trackLayout: layoutSchema.optional(),
			viewportLayout: layoutSchema.optional(),
		}),
		type: z.literal("carousel"),
	}),
	z.strictObject({
		...baseNodeFields,
		props: z.strictObject({
			defaultOpen: z.enum(["none", "first"]).optional(),
			divider: z.union([z.boolean(), z.literal("between")]).optional(),
			items: z.array(
				z.strictObject({
					id: entityIdSchema,
					panel: childNodesSchema,
					trigger: childNodesSchema,
				})
			),
			multiple: z.boolean().optional(),
			openIndicator: z.enum(["none", "rotate-45", "rotate-180"]).optional(),
			panelPadding: responsiveLengthSchema.optional(),
			triggerPadding: responsiveLengthSchema.optional(),
		}),
		type: z.literal("disclosure"),
	}),
	z.strictObject({
		...baseNodeFields,
		props: z.strictObject({
			...siteBoxAppearanceFields,
			actions: childNodesSchema,
			align: alignmentSchema.optional(),
			brand: childNodesSchema,
			collapseAt: z.enum(["compact", "medium", "wide", "always"]).optional(),
			itemAppearance: z
				.strictObject({ ...siteBoxAppearanceFields, padding: edges(lengthSchema).optional() })
				.optional(),
			itemGap: lengthSchema.optional(),
			items: z.array(
				z.strictObject({
					href: linkReferenceSchema,
					id: entityIdSchema,
					mobileTrigger: childNodesSchema.optional(),
					panel: childNodesSchema.optional(),
					trigger: childNodesSchema,
				})
			),
			label: textReferenceSchema,
			menuTriggerSide: z.enum(["start", "end"]).optional(),
			mobileLabel: textReferenceSchema,
			mobileTriggerAppearance: z.strictObject(siteBoxAppearanceFields).optional(),
			popupAppearance: z
				.strictObject({ ...siteBoxAppearanceFields, padding: edges(lengthSchema).optional() })
				.optional(),
			showMenuDivider: z.boolean().optional(),
			socialActions: childNodesSchema.optional(),
		}),
		type: z.literal("menu"),
	}),
	z.strictObject({
		...baseNodeFields,
		props: z.strictObject({
			children: childNodesSchema,
			columns: responsive(z.number().int().positive()),
			gap: responsiveLengthSchema.optional(),
		}),
		type: z.literal("masonry"),
	}),
	z.strictObject({
		...baseNodeFields,
		props: z.strictObject({
			activateOnFocus: z.boolean().optional(),
			activeShift: lengthSchema.optional(),
			arrangement: z.strictObject(siteGridPropsFields).optional(),
			autoplay: z
				.strictObject({
					intervalMs: z.number().int().min(1000).max(30_000),
					pauseOnHover: z.boolean().optional(),
					startDelayMs: z.number().int().min(0).max(5000).optional(),
				})
				.optional(),
			crossfadeMs: z.number().int().min(0).max(3000).optional(),
			decorations: z.array(tabDecorationSchema).max(6).optional(),
			defaultValue: z.string().optional(),
			detailMode: z.enum(["collapse", "fade"]).optional(),
			expandActive: z.strictObject({ inactiveSize: lengthSchema }).optional(),
			inactiveOpacity: z.number().min(0).max(1).optional(),
			indicator: z.boolean().optional(),
			indicatorAppearance: z.strictObject(siteBoxAppearanceFields).optional(),
			indicatorThickness: lengthSchema.optional(),
			itemAppearance: z
				.strictObject({ ...siteBoxAppearanceFields, padding: edges(lengthSchema).optional() })
				.optional(),
			itemFlex: z.strictObject(siteFlexPropsFields).partial().optional(),
			itemLayout: layoutSchema.optional(),
			items: z.array(
				z.strictObject({
					detail: childNodesSchema.optional(),
					disabled: z.boolean().optional(),
					id: entityIdSchema,
					panel: childNodesSchema,
					trigger: childNodesSchema,
					value: z.string(),
				})
			),
			label: textReferenceSchema,
			lead: childNodesSchema.optional(),
			listAppearance: z
				.strictObject({
					...siteBoxAppearanceFields,
					gap: lengthSchema.optional(),
					padding: edges(lengthSchema).optional(),
				})
				.optional(),
			listLayout: layoutSchema.optional(),
			listPlacement: z.enum(["before", "after"]).optional(),
			loopFocus: z.boolean().optional(),
			openIndicator: z.enum(["none", "rotate-180"]).optional(),
			orientation: z.enum(["horizontal", "vertical"]).optional(),
			panels: z.enum(["swap", "crossfade", "track"]).optional(),
			panelsLayout: layoutSchema.optional(),
			slideBasis: responsiveLengthSchema.optional(),
			slideGap: responsiveLengthSchema.optional(),
			tabAppearance: z
				.strictObject({ ...siteBoxAppearanceFields, padding: edges(lengthSchema).optional() })
				.optional(),
		}),
		type: z.literal("tabs"),
	}),
] as const;

export const siteNodeSchema: z.ZodType<PersistedSiteNode> = z.lazy(() => z.discriminatedUnion("type", siteNodeSchemas));

export const sectionSourceSchema = z.compile(z.strictObject({ pattern: patternKeySchema }));

export const siteSectionSchema = z.strictObject({
	anchor: anchorSchema,
	category: z.enum(sectionCategories),
	contentId: entityIdSchema,
	id: entityIdSchema,
	root: siteNodeSchema.refine((node) => node.type === "box", "A section root must be a box node"),
	settings: z.record(z.string().min(1), z.json()).optional(),
	source: sectionSourceSchema.optional(),
});

export const sitePageStructureSchema = z.strictObject({
	home: z.boolean(),
	id: entityIdSchema,
	sections: z.array(siteSectionSchema).max(siteDocumentResourceLimits.sections),
});

export const siteLayoutStructureSchema = z.strictObject({
	footer: z.array(siteSectionSchema).max(siteDocumentResourceLimits.sections),
	header: z.array(siteSectionSchema).max(siteDocumentResourceLimits.sections),
});

export const siteStructureSchema = z.strictObject({
	layout: siteLayoutStructureSchema,
	pages: z.array(sitePageStructureSchema).min(1).max(siteDocumentResourceLimits.pages),
});

export const coreNodeTypes = [
	"box",
	"flex",
	"grid",
	"text",
	"media",
	"icon",
	"action",
	"embed",
	"field",
	"carousel",
	"disclosure",
	"menu",
	"masonry",
	"tabs",
	"trigger",
	"value",
] as const;

export type CoreNodeType = (typeof coreNodeTypes)[number];

export type SectionCategory = (typeof sectionCategories)[number];

export type SiteLayoutStructure = z.infer<typeof siteLayoutStructureSchema>;

export type SitePageStructure = z.infer<typeof sitePageStructureSchema>;

export type SiteSection = z.infer<typeof siteSectionSchema>;

export type SiteStructure = z.infer<typeof siteStructureSchema>;
