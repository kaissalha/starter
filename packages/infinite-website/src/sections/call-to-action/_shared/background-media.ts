import type { MediaOverlay, SiteNodeDefinition } from "../../../document/structure-schema";

export const backgroundMedia = ({ overlay }: { overlay: MediaOverlay }) => {
	return {
		layout: {
			blockSize: "full",
			inlineSize: "full",
			inset: { blockEnd: 0, blockStart: 0, inlineEnd: 0, inlineStart: 0 },
			position: "absolute",
		},
		props: {
			alt: { $text: "/media/items/0/alt" },
			assetId: { $asset: "/media/items/0/assetId" },
			fill: "subtle",
			overlay,
			playback: "background",
			radius: "none",
		},
		type: "media",
	} satisfies SiteNodeDefinition;
};
