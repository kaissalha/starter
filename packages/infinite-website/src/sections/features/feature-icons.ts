import type { AuthoringJsonValue } from "../../document/content-schema";
import type { IconName } from "../../document/structure-schema";
import { defineSection } from "../section-definition";
import { pad, sectionContent, sectionRoot, text } from "./_shared/durable-parts";

const icons = ["check-circle", "calendar", "check", "location-pin"] satisfies Array<IconName>;

const item = ({ index }: { index: number }) => ({
	props: {
		align: "start",
		children: [
			{
				layout: { padding: pad({ block: "2sp", inline: "2sp" }) },
				props: {
					children: [
						{
							props: {
								filled: true,
								name: icons[index % icons.length] ?? "check",
								size: "8sp",
								tone: "primary",
							},
							type: "icon",
						},
					],
					fill: "featured",
					radius: "theme",
				},
				type: "box",
			},
			{
				props: {
					children: [
						text({ appearance: "heading-sm", element: "h3", pointer: `/features/items/${index}/title` }),
						text({ appearance: "body-md", pointer: `/features/items/${index}/description`, tone: "muted" }),
					],
					direction: "column",
					gap: "2sp",
				},
				type: "flex",
			},
		],
		direction: "column",
		gap: "6sp",
	},
	type: "flex",
});

export const featureIconsSection = defineSection({
	category: "features",
	pattern: "feature-icons",
	repeaters: [
		{
			collection: "/features",
			createValues: ({ index }): Array<AuthoringJsonValue> => [item({ index })],
			initial: 4,
			max: 8,
			min: 1,
			target: "/props/children/0/props/children/0/props/children",
		},
	],
	root: sectionRoot({
		children: [
			sectionContent({
				children: [
					{ props: { children: [], columns: { base: 1, compact: 2, wide: 4 }, gap: "6sp" }, type: "grid" },
				],
				padding: {
					base: pad({ block: "16sp", inline: "1.5rem" }),
					compact: pad({ block: "20sp", inline: "1.5rem" }),
				},
			}),
		],
	}),
});
