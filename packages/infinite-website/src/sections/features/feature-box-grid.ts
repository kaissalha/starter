import type { AuthoringJsonValue } from "../../document/content-schema";
import { defineSection } from "../section-definition";
import { button, pad, padSides, sectionContent, sectionRoot, text } from "./_shared/durable-parts";

const cell = ({ index }: { index: number }) => ({
	layout: { padding: { base: pad({ block: "6sp", inline: "6sp" }), compact: pad({ block: "8sp", inline: "8sp" }) } },
	props: {
		border: { color: "border", sides: ["inline-end", "block-end"], width: 1 },
		children: [
			text({ appearance: "label-md", pointer: `/features/items/${index}/number`, tone: "primary" }),
			{
				props: {
					children: [
						text({ appearance: "body-lg", element: "h3", pointer: `/features/items/${index}/title` }),
						text({ appearance: "body-sm", pointer: `/features/items/${index}/description`, tone: "muted" }),
					],
					direction: "column",
					gap: { base: "6sp", wide: "4sp" },
				},
				type: "flex",
			},
		],
		direction: "column",
		gap: { base: "8sp", compact: "6sp" },
	},
	type: "flex",
});

export const featureBoxGridSection = defineSection({
	category: "features",
	pattern: "feature-box-grid",
	repeaters: [
		{
			collection: "/features",
			createValues: ({ index }): Array<AuthoringJsonValue> => [cell({ index })],
			initial: 4,
			max: 12,
			min: 1,
			target: "/props/children/0/props/children/1/props/children/0/props/children",
		},
	],
	root: sectionRoot({
		children: [
			sectionContent({
				children: [
					{
						props: {
							align: "start",
							children: [
								{
									layout: { inlineSize: { base: "full", compact: "auto" }, maxInlineSize: "42rem" },
									props: {
										children: [
											text({ appearance: "heading-sm", element: "h2", pointer: "/copy/heading" }),
											text({
												appearance: "body-md",
												pointer: "/copy/description",
												tone: "muted",
											}),
										],
										direction: "column",
										gap: "2sp",
									},
									type: "flex",
								},
								{
									props: {
										children: [button({ index: 0 })],
										direction: { base: "column", compact: "row" },
										gap: "4sp",
										wrap: "wrap",
									},
									type: "flex",
								},
							],
							direction: { base: "column", compact: "row" },
							gap: { base: "8sp", compact: "16sp" },
							justify: "between",
						},
						type: "flex",
					},
					{
						layout: { inlineSize: "full", overflow: "hidden" },
						props: {
							border: { color: "border", width: 1 },
							children: [
								{
									layout: { margin: { blockEnd: "-1px", inlineEnd: "-1px" } },
									props: { children: [], columns: { base: 1, compact: 2, wide: 4 } },
									type: "grid",
								},
								{
									layout: { blockSize: "16sp" },
									props: { children: [], fill: "tint", pattern: "diagonal-slash" },
									type: "box",
								},
							],
							radius: "theme",
						},
						type: "box",
					},
				],
				gap: "12sp",
				padding: {
					base: padSides({ blockStart: "12sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" }),
					compact: padSides({ blockStart: "16sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" }),
				},
			}),
			{ layout: { blockSize: "1px" }, props: { children: [], fill: "border" }, type: "box" },
		],
	}),
});
