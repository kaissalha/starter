import type { Layout, SiteNodeDefinition } from "../../document/structure-schema";
import { defineSection } from "../section-definition";
import {
	bannerActionsRepeater,
	bannerButtonRow,
	bannerContentLayout,
	bannerTextNode,
} from "./_shared/banner-copy-parts";
import { bannerImage } from "./_shared/banner-image-parts";

type Breakpoint = "base" | "compact" | "wide";

const orbitRadii = {
	base: [300, 390, 480],
	compact: [340, 476, 612],
	wide: [388, 543, 700],
} satisfies Record<Breakpoint, Array<number>>;

const frameSizes = {
	landscape: { base: [90, 63], compact: [120, 84], wide: [180, 126] },
	portrait: { base: [63, 90], compact: [84, 120], wide: [126, 180] },
	square: { base: [70, 70], compact: [90, 90], wide: [130, 130] },
} satisfies Record<string, Record<Breakpoint, [number, number]>>;

const orbitItems = [
	{ angle: 235, index: 0, kind: "image", orbit: 0, orientation: "portrait" },
	{ angle: 305, index: 1, kind: "image", orbit: 0, orientation: "square" },
	{ angle: 90, index: 2, kind: "image", orbit: 0, orientation: "landscape" },
	{ angle: 180, index: 0, kind: "keyword", orbit: 0 },
	{ angle: 0, index: 1, kind: "keyword", orbit: 1 },
	{ angle: 45, index: 2, kind: "keyword", orbit: 1 },
] as const;

const round = (value: number) => Number(value.toFixed(1));

const atEachBreakpoint = <TResult>(make: (breakpoint: Breakpoint) => TResult) => {
	return { base: make("base"), compact: make("compact"), wide: make("wide") };
};

const circle = ({ orbit }: { orbit: number }) => {
	return {
		layout: {
			blockSize: atEachBreakpoint((breakpoint) => orbitRadii[breakpoint][orbit] * 2),
			inlineSize: atEachBreakpoint((breakpoint) => orbitRadii[breakpoint][orbit] * 2),
			inset: atEachBreakpoint((breakpoint) => ({
				blockStart: -orbitRadii[breakpoint][orbit],
				inlineStart: -orbitRadii[breakpoint][orbit],
			})),
			position: "absolute",
		},
		props: {
			border: { color: "current", width: "1px" },
			children: [],
			decorative: true,
			foreground: "primary",
			opacity: 0.3,
			radius: "full",
		},
		type: "box",
	} satisfies SiteNodeDefinition;
};

const itemLayout = ({ angle, orbit, visible }: { angle: number; orbit: number; visible: boolean }) => {
	return {
		inset: atEachBreakpoint((breakpoint) => ({
			blockStart: round(Math.sin((angle * Math.PI) / 180) * orbitRadii[breakpoint][orbit]),
			inlineStart: round(Math.cos((angle * Math.PI) / 180) * orbitRadii[breakpoint][orbit]),
		})),
		position: "absolute",
		translate: { block: "-50%", inline: "-50%" },
		visibility: visible ? "visible" : { base: "removed", compact: "visible" },
		zIndex: 10,
	} satisfies Layout;
};

const imageItem = ({ index, orientation }: { index: number; orientation: keyof typeof frameSizes }) => {
	const sizes = frameSizes[orientation];

	return {
		layout: {
			blockSize: atEachBreakpoint((breakpoint) => sizes[breakpoint][1]),
			inlineSize: atEachBreakpoint((breakpoint) => sizes[breakpoint][0]),
			padding: { blockEnd: "1.5sp", blockStart: "1.5sp", inlineEnd: "1.5sp", inlineStart: "1.5sp" },
		},
		props: {
			children: [
				bannerImage({
					assetPath: `/media/items/${index}`,
					layout: { blockSize: "full", inlineSize: "full" },
				}),
			],
			fill: "featured",
			radius: "theme",
		},
		type: "box",
	} satisfies SiteNodeDefinition;
};

const keywordItem = ({ index }: { index: number }) => {
	return {
		layout: {
			padding: { blockEnd: "1sp", blockStart: "1sp", inlineEnd: "1.5sp", inlineStart: "1.5sp" },
		},
		props: {
			border: { color: "border", width: "1px" },
			children: [
				bannerTextNode({
					appearance: "label-sm",
					element: "span",
					pointer: `/keywords/items/${index}/text`,
				}),
			],
			fill: "subtle",
			radius: "theme",
		},
		type: "box",
	} satisfies SiteNodeDefinition;
};

const orbitNodes = () => {
	return orbitItems.map((item) => {
		const content =
			item.kind === "image"
				? imageItem({ index: item.index, orientation: item.orientation })
				: keywordItem({ index: item.index });

		return {
			layout: itemLayout({ angle: item.angle, orbit: item.orbit, visible: item.kind === "image" }),
			props: { children: [content] },
			type: "box",
		} satisfies SiteNodeDefinition;
	});
};

export const bannerOrbitSection = defineSection({
	category: "hero",
	pattern: "banner-orbit",
	repeaters: [
		bannerActionsRepeater({
			appearances: ["primary", "outline"],
			initial: 1,
			target: "/props/children/0/props/children/1/props/children/1/props/children",
		}),
	],
	root: {
		layout: { overflow: "hidden" },
		props: {
			children: [
				{
					layout: {
						...bannerContentLayout,
						minBlockSize: { base: 920, compact: 1160, wide: 1340 },
						padding: { base: { inlineEnd: "1.5rem", inlineStart: "1.5rem" } },
						position: "relative",
					},
					props: {
						align: "center",
						children: [
							{
								layout: {
									inset: { blockStart: "50%", inlineStart: "50%" },
									position: "absolute",
								},
								props: { children: [...[0, 1, 2].map((orbit) => circle({ orbit })), ...orbitNodes()] },
								type: "box",
							},
							{
								layout: {
									maxInlineSize: { base: 380, compact: 440, wide: 520 },
									padding: {
										base: { inlineEnd: "4sp", inlineStart: "4sp" },
										compact: { inlineEnd: "6sp", inlineStart: "6sp" },
										wide: { inlineEnd: "8sp", inlineStart: "8sp" },
									},
									position: "relative",
									zIndex: 20,
								},
								props: {
									align: "center",
									children: [
										{
											props: {
												align: "center",
												children: [
													bannerTextNode({
														align: "center",
														appearance: "display-sm",
														element: "h1",
														pointer: "/copy/heading",
													}),
													bannerTextNode({
														align: "center",
														appearance: "body-md",
														pointer: "/copy/description",
														tone: "muted",
													}),
												],
												direction: "column",
												gap: "4sp",
											},
											type: "flex",
										},
										bannerButtonRow({ justify: "center" }),
									],
									direction: "column",
									gap: "6sp",
									justify: "center",
								},
								type: "flex",
							},
						],
						direction: "column",
						justify: "center",
					},
					type: "flex",
				},
			],
			fill: "canvas",
		},
		type: "box",
	},
});
