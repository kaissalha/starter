import type { Layout, MediaOverlay, SiteNodeDefinition } from "../../../document/structure-schema";
import type { SectionRepeater } from "../../section-definition";
import { bannerAction, type BannerButtonAppearance } from "./banner-copy-parts";

export const bannerImage = ({
	assetPath = "/media/items/0",
	imageOpacity,
	layout,
	overlay,
	radius = "theme",
}: {
	assetPath?: string;
	imageOpacity?: number;
	layout?: Layout;
	overlay?: MediaOverlay;
	radius?: "none" | "theme";
}) => {
	return {
		...(layout && { layout }),
		props: {
			alt: { $text: `${assetPath}/alt` },
			assetId: { $asset: `${assetPath}/assetId` },
			fill: "subtle",
			fit: "cover",
			...(imageOpacity !== undefined && { imageOpacity }),
			objectAlign: "center",
			...(overlay && { overlay }),
			radius,
		},
		type: "media",
	} satisfies SiteNodeDefinition;
};

export const bannerBackgroundImage = ({
	assetPath = "/media/items/0",
	overlay,
}: {
	assetPath?: string;
	overlay?: MediaOverlay;
}) => {
	return bannerImage({
		assetPath,
		layout: {
			blockSize: "full",
			inlineSize: "full",
			inset: { blockEnd: 0, blockStart: 0, inlineEnd: 0, inlineStart: 0 },
			position: "absolute",
		},
		overlay,
		radius: "none",
	});
};

type SpacingBlock = [start: number, end: number];

const spacingEdges = ({ block: [start, end], inline }: { block: SpacingBlock; inline: string }) => {
	return { blockEnd: `${end}sp`, blockStart: `${start}sp`, inlineEnd: inline, inlineStart: inline };
};

export const sectionPadding = ({
	base,
	compact,
	inline = "1.5rem",
	wide,
}: {
	base: SpacingBlock;
	compact?: SpacingBlock;
	inline?: string;
	wide?: SpacingBlock;
}) => {
	return {
		base: spacingEdges({ block: base, inline }),
		...(compact && { compact: spacingEdges({ block: compact, inline }) }),
		...(wide && { wide: spacingEdges({ block: wide, inline }) }),
	} satisfies Layout["padding"];
};

export const evenPadding = (steps: number) => {
	return { blockEnd: `${steps}sp`, blockStart: `${steps}sp`, inlineEnd: `${steps}sp`, inlineStart: `${steps}sp` };
};

export const bannerSmallActionsRepeater = ({
	appearances,
	initial,
	target,
}: {
	appearances: Array<BannerButtonAppearance>;
	initial: number;
	target: string;
}) => {
	return {
		collection: "/actions",
		createValues: ({ index }) => [
			bannerAction({
				appearance: appearances[index] ?? "secondary",
				index,
				layout: { padding: { blockEnd: "2sp", blockStart: "2sp", inlineEnd: "4sp", inlineStart: "4sp" } },
				onMedia: true,
			}),
		],
		initial,
		max: appearances.length,
		min: 1,
		target,
	} satisfies SectionRepeater;
};

export const bannerImageTile = ({ assetPath, layout }: { assetPath: string; layout: Layout }) => {
	return {
		layout: { ...layout, overflow: "hidden", position: "relative" },
		props: { children: [bannerBackgroundImage({ assetPath })], radius: "theme" },
		type: "box",
	} satisfies SiteNodeDefinition;
};

export const bannerStretchActionsRepeater = ({
	appearances,
	initial = appearances.length,
	target,
}: {
	appearances: Array<BannerButtonAppearance>;
	initial?: number;
	target: string;
}) => {
	return {
		collection: "/actions",
		createValues: ({ index }) => [
			bannerAction({
				appearance: appearances[index] ?? "secondary",
				index,
				layout: { inlineSize: { base: "full", compact: "auto" } },
			}),
		],
		initial,
		max: appearances.length,
		min: 1,
		target,
	} satisfies SectionRepeater;
};
