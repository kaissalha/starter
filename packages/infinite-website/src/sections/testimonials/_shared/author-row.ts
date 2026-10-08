import type { Length } from "../../../document/structure-schema";
import { flex, itemMedia, text } from "../../team/_shared/nodes";

export const createAuthorRow = ({ avatarSize, gap, index }: { avatarSize: Length; gap: Length; index: number }) =>
	flex({
		align: "center",
		children: [
			itemMedia({
				collection: "testimonials",
				index,
				layout: {
					aspectRatio: { height: 1, width: 1 },
					blockSize: avatarSize,
					inlineSize: avatarSize,
					shrink: 0,
				},
				radius: "full",
			}),
			flex({
				children: [
					text({ appearance: "body-md", pointer: `/testimonials/items/${index}/name` }),
					text({ appearance: "body-sm", pointer: `/testimonials/items/${index}/title`, tone: "muted" }),
				],
				direction: "column",
			}),
		],
		direction: "row",
		gap,
	});
