import type { SiteNodeDefinition } from "../../document/structure-schema";
import { defineSection } from "../section-definition";
import { splitIntro } from "./_shared/metrics-intro";
import { flex, frameLayout, grid, pad, sectionBox, space, text } from "./_shared/parts";

const card = ({ index }: { index: number }): SiteNodeDefinition =>
	flex({
		children: [
			text({ appearance: "heading-lg", pointer: `/items/items/${index}/metric` }),
			text({ appearance: "body-md", pointer: `/items/items/${index}/title` }),
		],
		fill: index === 0 ? "featured" : "tint",
		gap: space(18),
		justify: "between",
		layout: { padding: pad({ x: 6, y: 6 }) },
		radius: "theme",
	});

export const metricsCardHighlightSection = defineSection({
	category: "metrics",
	pattern: "metrics-card-highlight",
	repeaters: [
		{
			collection: "/items",
			createValues: ({ index }) => [card({ index })],
			initial: 4,
			max: 4,
			min: 2,
			target: "/props/children/0/props/children/1/props/children",
		},
	],
	root: sectionBox({
		children: [
			flex({
				children: [
					splitIntro({ buttonAppearance: "outline", descriptionMaxInlineSize: "42rem" }),
					grid({ children: [], columns: { base: 1, compact: 2, wide: 4 }, gap: space(4) }),
				],
				gap: space({ base: 8, compact: 16 }),
				layout: frameLayout({ y: { base: 16, compact: 20 } }),
			}),
		],
	}),
});
