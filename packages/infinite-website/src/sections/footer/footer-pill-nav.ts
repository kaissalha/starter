import type { SiteNodeDefinition } from "../../document/structure-schema";
import { defineSection } from "../section-definition";
import {
	flex,
	footerBrand,
	footerDivider,
	footerRepeater,
	footerRoot,
	footerText,
	grid,
} from "./_shared/durable-footer";

const pill = ({ source }: { source: string }) =>
	({
		layout: { padding: { blockEnd: "1sp", blockStart: "1sp", inlineEnd: "2.5sp", inlineStart: "2.5sp" } },
		props: {
			border: { color: "border", width: "1px" },
			children: [
				{
					props: {
						appearance: "label-sm",
						content: { $text: `${source}/label` },
						element: "span",
						tone: "current",
					},
					type: "text",
				},
			],
			fill: "transparent",
			foreground: "primary",
			href: { $link: `${source}/link` },
			radius: "theme",
		},
		type: "action",
	}) satisfies SiteNodeDefinition;

const gutter = { inlineEnd: "1.5rem", inlineStart: "1.5rem" } as const;

export const footerPillNavSection = defineSection({
	category: "footer",
	pattern: "footer-pill-nav",
	repeaters: [
		footerRepeater({
			collection: "navItems",
			create: ({ source }) => pill({ source }),
			initial: 7,
			max: 9,
			target: "/props/children/0/props/children/0/props/children/1/props/children",
		}),
	],
	root: footerRoot({
		children: [
			flex({
				children: [
					flex({
						children: [footerBrand()],
						direction: "row",
						layout: { visibility: { base: "visible", compact: "removed" } },
					}),
					grid({
						align: "start",
						autoFlow: { base: "row", compact: "column" },
						children: [],
						columnGap: "10sp",
						columns: { base: 1, compact: 2 },
						justify: "start",
						layout: { maxInlineSize: "36rem" },
						rowGap: "2sp",
						rows: { base: 1, compact: 4 },
					}),
				],
				direction: "column",
				gap: "8sp",
				layout: {
					padding: {
						base: { blockEnd: "8sp", blockStart: "8sp", ...gutter },
						compact: { blockEnd: "10sp", blockStart: "10sp", ...gutter },
					},
				},
			}),
			footerDivider(),
			flex({
				align: { base: "start", compact: "end" },
				children: [
					flex({
						children: [footerBrand()],
						direction: "row",
						layout: { visibility: { base: "removed", compact: "visible" } },
					}),
					footerText({ appearance: "body-sm", content: "/copy/copyright", tone: "muted" }),
				],
				direction: { base: "column", compact: "row" },
				gap: "8sp",
				justify: "between",
				layout: {
					padding: {
						base: { blockEnd: "6sp", blockStart: "6sp", ...gutter },
						compact: { blockEnd: "8sp", blockStart: "8sp", ...gutter },
					},
				},
				pattern: "diagonal-slash",
			}),
		],
		contentLayout: {},
	}),
});
