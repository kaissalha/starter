import type { AuthoringJsonValue } from "../../document/content-schema";
import { defineSection } from "../section-definition";
import { buttonGroup, media, pad, sectionContent, sectionRoot, splitIntro, text } from "./_shared/durable-parts";

const item = ({ index }: { index: number }) => ({
	props: {
		children: [
			media({
				layout: { blockSize: { base: "100sp", wide: "70sp" }, inlineSize: "full" },
				pointer: `/features/items/${index}`,
			}),
			{
				props: {
					children: [
						text({ appearance: "heading-sm", element: "h3", pointer: `/features/items/${index}/title` }),
						text({ appearance: "body-sm", pointer: `/features/items/${index}/description`, tone: "muted" }),
					],
					direction: "column",
					gap: "2sp",
				},
				type: "flex",
			},
		],
		direction: "column",
		gap: "4sp",
	},
	type: "flex",
});

export const featureGridSection = defineSection({
	category: "features",
	pattern: "feature-grid",
	repeaters: [
		{
			collection: "/features",
			createValues: ({ index }): Array<AuthoringJsonValue> => [item({ index })],
			initial: 6,
			max: 9,
			min: 2,
			target: "/props/children/0/props/children/1/props/children",
		},
	],
	root: sectionRoot({
		children: [
			sectionContent({
				children: [
					splitIntro({
						buttons: ["primary"],
						buttonsLayout: { visibility: { base: "removed", compact: "visible" } },
					}),
					{
						props: { children: [], columns: { base: 1, compact: 2, wide: 3 }, gap: "4sp" },
						type: "grid",
					},
					buttonGroup({
						layout: { visibility: { base: "visible", compact: "removed" } },
						variants: ["primary"],
					}),
				],
				gap: { base: "8sp", compact: "16sp" },
				padding: {
					base: pad({ block: "12sp", inline: "1.5rem" }),
					compact: pad({ block: "16sp", inline: "1.5rem" }),
				},
			}),
		],
	}),
});
