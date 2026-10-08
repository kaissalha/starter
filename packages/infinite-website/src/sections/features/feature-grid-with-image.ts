import type { AuthoringJsonValue } from "../../document/content-schema";
import { defineSection } from "../section-definition";
import {
	buttonGroup,
	heading,
	kicker,
	media,
	pad,
	padSides,
	sectionContent,
	sectionRoot,
	text,
} from "./_shared/durable-parts";

const item = ({ index }: { index: number }) => ({
	props: {
		children: [
			text({ appearance: "heading-sm", element: "h3", pointer: `/features/items/${index}/title` }),
			text({ appearance: "body-sm", pointer: `/features/items/${index}/description`, tone: "muted" }),
		],
		direction: "column",
		gap: "2sp",
	},
	type: "flex",
});

export const featureGridWithImageSection = defineSection({
	category: "features",
	pattern: "feature-grid-with-image",
	repeaters: [
		{
			collection: "/features",
			createValues: ({ index }): Array<AuthoringJsonValue> => [item({ index })],
			initial: 4,
			max: 8,
			min: 2,
			target: "/props/children/0/props/children/1/props/children/1/props/children",
		},
	],
	root: sectionRoot({
		children: [
			sectionContent({
				align: { base: "center", wide: "stretch" },
				children: [
					media({
						layout: {
							blockSize: { base: "72sp", wide: "auto" },
							grow: 0,
							inlineSize: { base: "full", wide: "50cqw" },
							margin: { base: { inlineEnd: 0 }, wide: { inlineEnd: "viewport-bleed-offset" } },
							order: { base: 1, wide: 2 },
							shrink: 0,
						},
						pointer: "/media/items/0",
						radius: "none",
					}),
					{
						layout: {
							grow: 1,
							order: { base: 2, wide: 1 },
							padding: {
								base: padSides({ blockEnd: "12sp", inlineEnd: "6sp", inlineStart: "6sp" }),
								compact: padSides({ blockEnd: "16sp", inlineEnd: "6sp", inlineStart: "6sp" }),
								wide: pad({ block: "16sp" }),
							},
						},
						props: {
							align: "start",
							children: [
								{
									props: {
										children: [
											{
												props: {
													children: [kicker({}), heading({})],
													direction: "column",
													gap: "4sp",
												},
												type: "flex",
											},
											{
												layout: { maxInlineSize: "42rem" },
												props: {
													children: [
														text({
															appearance: "body-md",
															pointer: "/copy/description",
															tone: "muted",
														}),
														buttonGroup({ variants: ["primary"] }),
													],
													direction: "column",
													gap: "6sp",
												},
												type: "flex",
											},
										],
										direction: "column",
										gap: "6sp",
									},
									type: "flex",
								},
								{
									layout: { inlineSize: "full" },
									props: { children: [], columns: { base: 1, compact: 2 }, gap: "8sp" },
									type: "grid",
								},
							],
							direction: "column",
							gap: { base: "8sp", compact: "12sp" },
						},
						type: "flex",
					},
				],
				direction: { base: "column", wide: "row" },
				gap: { base: "8sp", compact: "12sp" },
				padding: pad({ block: 0, inline: "1.5rem" }),
			}),
		],
	}),
});
