import type {
	Foreground,
	IconName,
	Layout,
	Length,
	Responsive,
	SiteNodeDefinition,
	TypographyAppearance,
} from "../../../document/structure-schema";
import type { SectionRepeater } from "../../section-definition";
import { socialIconFromItem } from "../../social-icon";

export const footerLink = ({
	appearance,
	border,
	decoration,
	italic = false,
	layout,
	linkTone = "primary",
	source,
}: {
	appearance: TypographyAppearance;
	border?: boolean;
	decoration?: "underline";
	italic?: boolean;
	layout?: Layout;
	linkTone?: Foreground;
	source: string;
}) =>
	({
		layout: { inlineSize: "fit-content", ...layout },
		props: {
			...(border && { border: { color: "current", sides: ["block-end"], width: "1px" } }),
			children: [
				{
					props: {
						appearance,
						content: { $text: `${source}/label` },
						...(decoration && { decoration }),
						element: "span",
						...(italic && { style: "italic" }),
						tone: "current",
					},
					type: "text",
				},
			],
			fill: "transparent",
			foreground: linkTone,
			href: { $link: `${source}/link` },
			radius: "none",
			...(italic && { style: "italic" }),
		},
		type: "action",
	}) satisfies SiteNodeDefinition;

export const footerText = ({
	appearance,
	content,
	element = "p",
	italic = false,
	tone = "primary",
}: {
	appearance: TypographyAppearance;
	content: string;
	element?: "h2" | "h3" | "p" | "span";
	italic?: boolean;
	tone?: Foreground;
}) =>
	({
		props: {
			appearance,
			content: { $text: content },
			element,
			...(element.startsWith("h") && { font: "brand" }),
			...(italic && { style: "italic" }),
			tone,
		},
		type: "text",
	}) satisfies SiteNodeDefinition;

export const footerDivider = () =>
	({
		layout: { blockSize: "1px", inlineSize: "full" },
		props: { children: [], decorative: true, fill: "border" },
		type: "box",
	}) satisfies SiteNodeDefinition;

export const footerRoot = ({
	children,
	contentLayout,
	gap,
	rootFill = "canvas",
}: {
	children: Array<SiteNodeDefinition>;
	contentLayout: Layout;
	gap?: Responsive<Length>;
	rootFill?: "canvas" | "subtle" | "featured";
}) =>
	({
		layout: {},
		props: {
			children: [
				{
					layout: {
						inlineSize: "full",
						margin: { inlineEnd: "auto", inlineStart: "auto" },
						maxInlineSize: "96rem",
						...contentLayout,
					},
					props: { children, direction: "column", gap },
					type: "flex",
				},
			],
			fill: rootFill,
		},
		type: "box",
	}) satisfies SiteNodeDefinition;

export const footerRepeater = ({
	collection,
	create,
	initial,
	max,
	min = 1,
	target,
}: {
	collection: string;
	create: ({ source }: { source: string }) => SiteNodeDefinition;
	initial: number;
	max: number;
	min?: number;
	target: string;
}) => ({
	collection: `/${collection}`,
	createValues: ({ index }: { index: number }) => [create({ source: `/${collection}/items/${index}` })],
	initial,
	max,
	min,
	target,
});

type FlexProps = Extract<SiteNodeDefinition, { type: "flex" }>["props"];

type GridProps = Extract<SiteNodeDefinition, { type: "grid" }>["props"];

export const flex = ({
	children,
	layout = {},
	...props
}: Omit<FlexProps, "children"> & { children: Array<SiteNodeDefinition>; layout?: Layout }) =>
	({ layout, props: { children, ...props }, type: "flex" }) satisfies SiteNodeDefinition;

export const grid = ({
	children,
	layout = {},
	...props
}: Omit<GridProps, "children"> & { children: Array<SiteNodeDefinition>; layout?: Layout }) =>
	({ layout, props: { children, ...props }, type: "grid" }) satisfies SiteNodeDefinition;

export const footerIcon = ({ icon, source }: { icon: IconName; source: string }) =>
	({
		layout: { padding: { inlineEnd: "0.5sp", inlineStart: "0.5sp" } },
		props: {
			children: [
				{
					props: {
						label: { $text: `${source}/label` },
						name: icon,
						size: { base: "4.5sp", wide: "3sp" },
						tone: "current",
					},
					type: "icon",
				},
			],
			fill: "transparent",
			foreground: "primary",
			href: { $link: `${source}/link` },
			radius: "none",
		},
		type: "action",
	}) satisfies SiteNodeDefinition;

export const footerBrand = () => footerText({ appearance: "title-md", content: "/copy/brand" });

const socialFallbacks: Array<IconName> = ["facebook", "instagram", "x", "linkedin", "youtube", "pinterest"];

export const footerSocialRepeater = ({
	collection = "socialLinks",
	initial,
	target,
}: {
	collection?: string;
	initial: number;
	target: string;
}): SectionRepeater => ({
	collection: `/${collection}`,
	createValues: ({ index, item }) => [
		footerIcon({
			icon: socialIconFromItem({ fallback: socialFallbacks[index] ?? "instagram", item }),
			source: `/${collection}/items/${index}`,
		}),
	],
	initial,
	max: 6,
	min: 0,
	target,
});
