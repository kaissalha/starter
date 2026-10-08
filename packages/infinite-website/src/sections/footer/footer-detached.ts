import { defineSection } from "../section-definition";
import {
	flex,
	footerBrand,
	footerDivider,
	footerLink,
	footerSocialRepeater,
	footerText,
	grid,
} from "./_shared/durable-footer";

const navGroup = ({ group }: { group: number }) =>
	flex({
		border: { color: "border", sides: ["inline-start"], width: "1px" },
		children: [
			footerText({ appearance: "body-sm-em", content: `/navGroups/items/${group}/label` }),
			flex({ children: [], direction: "column", gap: "2sp" }),
		],
		direction: "column",
		gap: "5sp",
		layout: {
			padding: {
				base: { blockEnd: "8sp", blockStart: "8sp", inlineEnd: "8sp", inlineStart: "8sp" },
				compact: { blockEnd: "6sp", blockStart: "6sp", inlineEnd: "6sp", inlineStart: "6sp" },
			},
		},
	});

export const footerDetachedSection = defineSection({
	category: "footer",
	pattern: "footer-detached",
	repeaters: [
		{
			collection: "/navGroups",
			createValues: ({ index }) => [navGroup({ group: index })],
			initial: 4,
			max: 6,
			min: 1,
			target: "/props/children/0/props/children/0/props/children/0/props/children",
		},
		{
			collection: "/navGroups/*/navItems",
			createValues: ({ index, parentIndex }) => [
				footerLink({
					appearance: "body-sm",
					linkTone: "muted",
					source: `/navGroups/items/${parentIndex}/navItems/items/${index}`,
				}),
			],
			initial: 4,
			max: 10,
			min: 1,
			target: "/0/props/children/1/props/children",
		},
		footerSocialRepeater({
			initial: 3,
			target: "/props/children/0/props/children/0/props/children/2/props/children/1/props/children",
		}),
	],
	root: {
		layout: {},
		props: {
			children: [
				{
					layout: {
						inlineSize: "full",
						margin: { inlineEnd: "auto", inlineStart: "auto" },
						maxInlineSize: "96rem",
						padding: { blockEnd: "6sp", blockStart: "6sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" },
					},
					props: {
						children: [
							flex({
								children: [
									grid({
										children: [],
										columns: { base: 1, compact: 2, wide: 4 },
										layout: { margin: { inlineStart: "-1px" } },
									}),
									footerDivider(),
									flex({
										align: { base: "center", compact: "end" },
										children: [
											footerBrand(),
											flex({
												children: [],
												direction: "row",
												gap: "2sp",
											}),
										],
										direction: { base: "column", compact: "row" },
										gap: "8sp",
										justify: "between",
										layout: {
											minBlockSize: { base: "auto", compact: "50sp" },
											padding: {
												base: {
													blockEnd: "8sp",
													blockStart: "8sp",
													inlineEnd: "8sp",
													inlineStart: "8sp",
												},
												compact: {
													blockEnd: "6sp",
													blockStart: "6sp",
													inlineEnd: "6sp",
													inlineStart: "6sp",
												},
											},
										},
									}),
								],
								direction: "column",
								fill: "subtle",
								layout: { overflow: "hidden" },
								radius: "theme",
							}),
						],
						direction: "column",
					},
					type: "flex",
				},
			],
			fill: "canvas",
		},
		type: "box",
	},
});
