import { jsonObjectSchema, type AuthoringJsonValue } from "../../../document/content-schema";
import type {
	BoxAppearance,
	Foreground,
	IconName,
	Layout,
	Length,
	SiteNodeDefinition,
} from "../../../document/structure-schema";
import type { SectionRepeater } from "../../section-definition";
import { socialIconFromItem } from "../../social-icon";

type MenuNode = Extract<SiteNodeDefinition, { type: "menu" }>;

type MenuItem = MenuNode["props"]["items"][number];

export const headerBrand = ({ tone = "primary" }: { tone?: Foreground } = {}) =>
	({
		layout: { inlineSize: "max-content", shrink: 0 },
		props: {
			content: { $text: "/copy/header-main-brand" },
			element: "span",
			font: "body",
			fontSize: { base: "1.25rem", compact: "1.5rem", wide: "1.5625rem" },
			tone,
			weight: "theme",
		},
		type: "text",
	}) satisfies SiteNodeDefinition;

const buttonSizes = {
	sm: {
		appearance: "body-sm-em",
		padding: { blockEnd: "2sp", blockStart: "2sp", inlineEnd: "4sp", inlineStart: "4sp" },
	},
	xs: {
		appearance: "body-xs-em",
		padding: { blockEnd: "1sp", blockStart: "1sp", inlineEnd: "2.5sp", inlineStart: "2.5sp" },
	},
} as const;

export const headerButton = ({
	index,
	size = "sm",
	variant,
}: {
	index: number;
	size?: keyof typeof buttonSizes;
	variant: "outline" | "primary";
}) =>
	({
		layout: { padding: buttonSizes[size].padding },
		props: {
			...(variant === "outline" && { border: { color: "current", width: "1px" } }),
			children: [
				{
					props: {
						appearance: buttonSizes[size].appearance,
						content: { $text: `/actions/items/${index}/label` },
						element: "span",
						tone: "current",
					},
					type: "text",
				},
			],
			fill: variant === "primary" ? "action" : "transparent",
			...(variant === "primary" && { foreground: "action" }),
			href: { $link: `/actions/items/${index}/link` },
			radius: "theme",
		},
		type: "action",
	}) satisfies SiteNodeDefinition;

export const headerSocialAction = ({ icon, index }: { icon: IconName; index: number }) =>
	({
		layout: { padding: { inlineEnd: "0.5sp", inlineStart: "0.5sp" } },
		props: {
			children: [
				{
					props: {
						label: { $text: `/socialLinks/items/${index}/label` },
						name: icon,
						size: "3sp",
						tone: "current",
					},
					type: "icon",
				},
			],
			fill: "transparent",
			foreground: "muted",
			href: { $link: `/socialLinks/items/${index}/link` },
			radius: "none",
		},
		type: "action",
	}) satisfies SiteNodeDefinition;

const chevron = ({ layout, size, tone }: { layout?: Layout; size: Length; tone: Foreground }) =>
	({
		...(layout && { layout }),
		props: { name: "chevron-down", size, tone },
		type: "icon",
	}) satisfies SiteNodeDefinition;

export const headerPanelLink = ({
	index,
	parent,
	tone = "primary",
}: {
	index: number;
	parent: number;
	tone?: Foreground;
}) =>
	({
		layout: { padding: { blockEnd: "2sp", blockStart: "2sp", inlineEnd: "3sp", inlineStart: "3sp" } },
		props: {
			children: [
				{
					props: {
						appearance: "body-sm",
						content: { $text: `/navigation/items/${parent}/dropdown/items/${index}/label` },
						element: "span",
						tone: "current",
					},
					type: "text",
				},
			],
			fill: "transparent",
			foreground: tone,
			href: { $link: `/navigation/items/${parent}/dropdown/items/${index}/link` },
			radius: "theme",
		},
		type: "action",
	}) satisfies SiteNodeDefinition;

const dropdownCount = ({ item }: { item?: AuthoringJsonValue }) => {
	const object = jsonObjectSchema.safeParse(item);

	return object.success && Array.isArray(object.data.dropdown) ? object.data.dropdown.length : 0;
};

export const headerNavigationItem = ({
	appearance = "body-sm",
	chevronLayout,
	index,
	item,
	itemLayout,
	mobileAppearance = "heading-sm",
	tone,
}: {
	appearance?: "body-md" | "body-sm" | "label-md";
	chevronLayout?: Layout;
	index: number;
	item?: AuthoringJsonValue;
	itemLayout?: Layout;
	mobileAppearance?: "heading-md" | "heading-sm";
	tone: Foreground;
}) => {
	const hasPanel = item === undefined || dropdownCount({ item }) > 0;

	const menuItem: MenuItem = {
		href: { $link: `/navigation/items/${index}/link` },
		mobileTrigger: [
			{
				props: {
					appearance: mobileAppearance,
					content: { $text: `/navigation/items/${index}/label` },
					element: "span",
					tone: "primary",
				},
				type: "text",
			},
			...(hasPanel ? [chevron({ size: "5sp", tone: "primary" })] : []),
		],
		trigger: [
			{
				...(itemLayout && { layout: itemLayout }),
				props: {
					appearance,
					content: { $text: `/navigation/items/${index}/label` },
					element: "span",
					tone,
				},
				type: "text",
			},
			...(hasPanel ? [chevron({ layout: chevronLayout, size: "2sp", tone })] : []),
		],
		...(hasPanel && { panel: [] }),
	};

	return menuItem;
};

const menuBase = "/props/children/0/props/children/0/props";

export const headerRepeaters = ({
	actions,
	navigation,
	panelLink,
	socials,
}: {
	actions: { create: ({ index }: { index: number }) => SiteNodeDefinition; initial: number; max?: number };
	navigation: {
		create: ({ index, item }: { index: number; item?: AuthoringJsonValue }) => MenuItem;
		initial: number;
		max?: number;
	};
	panelLink: ({ index, parent }: { index: number; parent: number }) => SiteNodeDefinition;
	socials?: { create: ({ icon, index }: { icon: IconName; index: number }) => SiteNodeDefinition; initial: number };
}): Array<SectionRepeater> => [
	{
		collection: "/navigation",
		createValues: ({ index, item }) => [navigation.create({ index, item })],
		editable: false,
		initial: navigation.initial,
		max: navigation.max ?? 8,
		min: 1,
		target: `${menuBase}/items`,
	},
	{
		collection: "/navigation/*/dropdown",
		createValues: ({ index, parentIndex }) => [panelLink({ index, parent: parentIndex })],
		editable: false,
		initial: 2,
		max: 8,
		min: 0,
		target: "/0/panel",
	},
	{
		collection: "/actions",
		createValues: ({ index }) => [actions.create({ index })],
		initial: actions.initial,
		max: actions.max ?? 2,
		min: 0,
		target: `${menuBase}/actions`,
	},
	...(socials
		? [
				{
					collection: "/socialLinks",
					createValues: ({ index, item }: { index: number; item?: AuthoringJsonValue }) => [
						socials.create({
							icon: socialIconFromItem({ fallback: socialFallbacks[index] ?? "instagram", item }),
							index,
						}),
					],
					initial: socials.initial,
					max: 6,
					min: 0,
					target: `${menuBase}/socialActions`,
				},
			]
		: []),
];

const socialFallbacks: Array<IconName> = ["facebook", "instagram", "x", "linkedin", "youtube", "pinterest"];

export const headerPopupAppearance = {
	border: { color: "border", width: "1px" },
	fill: "canvas",
	padding: { blockEnd: "0.5rem", blockStart: "0.5rem", inlineEnd: "0.5rem", inlineStart: "0.5rem" },
	radius: "theme",
} satisfies MenuNode["props"]["popupAppearance"];

export const headerMenu = ({
	layout,
	props,
}: {
	layout?: Layout;
	props: Omit<MenuNode["props"], "label" | "mobileLabel" | "popupAppearance">;
}) =>
	({
		...(layout && { layout }),
		props: {
			label: { $text: "/accessibility/navigationLabel" },
			mobileLabel: { $text: "/accessibility/mobileNavigationLabel" },
			popupAppearance: headerPopupAppearance,
			...props,
		},
		type: "menu",
	}) satisfies SiteNodeDefinition;

export const headerContainer = ({
	containerLayout,
	fullBleed = false,
	menu,
	rootAppearance = { fill: "canvas" },
	rootLayout,
}: {
	containerLayout?: Layout;
	fullBleed?: boolean;
	menu: SiteNodeDefinition;
	rootAppearance?: Pick<BoxAppearance, "fill" | "fillOpacity" | "foreground">;
	rootLayout?: Layout;
}) =>
	({
		...(rootLayout && { layout: rootLayout }),
		props: {
			children: [
				{
					layout: {
						grow: 1,
						inlineSize: "full",
						margin: { inlineEnd: "auto", inlineStart: "auto" },
						...(!fullBleed && { maxInlineSize: "96rem" }),
						padding: {
							base: { blockEnd: 0, blockStart: 0, inlineEnd: "1rem", inlineStart: "1rem" },
							wide: { inlineEnd: "1.5rem", inlineStart: "1.5rem" },
						},
						position: "relative",
						...containerLayout,
					},
					props: { children: [menu], direction: "column", justify: "start" },
					type: "flex",
				},
			],
			...rootAppearance,
		},
		type: "box",
	}) satisfies SiteNodeDefinition;
