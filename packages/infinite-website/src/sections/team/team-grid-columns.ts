import type { IconName, SiteNodeDefinition } from "../../document/structure-schema";
import { defineSection } from "../section-definition";
import { divider, flex, grid, itemMedia, sectionShell, symmetric, text } from "./_shared/nodes";
import { createSplitHeader } from "./_shared/split-header";

const socialPlatforms: Array<IconName> = ["linkedin", "x", "facebook", "instagram", "youtube"];

const createSocialAction = ({ index, link }: { index: number; link: number }) =>
	({
		props: {
			children: [
				{
					props: {
						label: { $text: `/members/items/${index}/socialLinks/items/${link}/label` },
						name: socialPlatforms[link] ?? "linkedin",
						size: { base: "5sp", compact: "3sp" },
						tone: "current",
					},
					type: "icon",
				},
			],
			fill: "transparent",
			foreground: "muted",
			href: { $link: `/members/items/${index}/socialLinks/items/${link}/link` },
			radius: "none",
		},
		type: "action",
	}) satisfies SiteNodeDefinition;

const createMember = ({ index }: { index: number }) =>
	flex({
		children: [
			itemMedia({
				collection: "members",
				index,
				layout: {
					blockSize: { base: "75sp", compact: "50sp" },
					inlineSize: { base: "full", compact: "50sp" },
					shrink: 0,
				},
			}),
			flex({
				children: [
					flex({
						children: [
							text({ appearance: "heading-sm", element: "h3", pointer: `/members/items/${index}/name` }),
							text({ appearance: "body-sm", pointer: `/members/items/${index}/role`, tone: "muted" }),
						],
						direction: "column",
						gap: "2sp",
					}),
					divider(),
					flex({
						children: [
							text({
								appearance: "body-md",
								pointer: `/members/items/${index}/description`,
								tone: "muted",
							}),
							flex({
								children: [],
								direction: "row",
								gap: "3sp",
								layout: { margin: { blockStart: "2sp" } },
							}),
						],
						direction: "column",
						gap: "2sp",
					}),
				],
				direction: "column",
				gap: "4sp",
				layout: { grow: 1 },
			}),
		],
		direction: { base: "column", compact: "row" },
		gap: { base: "6sp", wide: "8sp" },
	});

export const teamGridColumnsSection = defineSection({
	category: "team",
	pattern: "team-grid-columns",
	repeaters: [
		{
			collection: "/members",
			createValues: ({ index }) => [createMember({ index })],
			initial: 4,
			max: 6,
			min: 1,
			target: "/props/children/0/props/children/1/props/children",
		},
		{
			collection: "/members/*/socialLinks",
			createValues: ({ index, parentIndex }) => [createSocialAction({ index: parentIndex, link: index })],
			initial: 2,
			max: socialPlatforms.length,
			min: 0,
			target: "/0/props/children/1/props/children/2/props/children/1/props/children",
		},
	],
	root: sectionShell({
		children: [
			createSplitHeader({
				columnGap: "8sp",
				descriptionMaxWidth: "36rem",
				rowGap: { base: "6sp", compact: "8sp" },
			}),
			grid({ children: [], columns: { base: 1, wide: 2 }, gap: "6sp" }),
		],
		gap: { base: "8sp", compact: "16sp" },
		padding: { base: symmetric({ value: "12sp" }), compact: symmetric({ value: "16sp" }) },
	}),
});
