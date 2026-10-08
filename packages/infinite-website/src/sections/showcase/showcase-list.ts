import { box, contentFrame, flex, kicker, sectionBox, text } from "../gallery/_shared/section-parts";
import { defineSection } from "../section-definition";

export const showcaseListSection = defineSection({
	category: "showcase",
	pattern: "showcase-list",
	repeaters: [
		{
			collection: "/items",
			createValues: ({ index }) => [
				box({
					children: [
						text({ appearance: "display-sm", pointer: `/items/items/${index}/name`, tone: "muted" }),
					],
					opacity: 0.5,
				}),
			],
			initial: 7,
			max: 14,
			min: 3,
			target: "/props/children/0/props/children/1/props/children",
		},
	],
	root: sectionBox({
		children: [
			contentFrame({
				children: [
					flex({
						children: [
							kicker(),
							flex({
								children: [
									text({
										appearance: "display-md",
										element: "h2",
										layout: { maxInlineSize: "36rem" },
										pointer: "/copy/heading",
										tone: "primary",
									}),
									text({
										appearance: "body-md",
										layout: { maxInlineSize: "42rem" },
										pointer: "/copy/description",
										tone: "muted",
									}),
								],
								gap: "6sp",
							}),
						],
						gap: "4sp",
					}),
					flex({ children: [], gap: "3sp" }),
				],
				gap: "12sp",
				padding: { base: "16sp", compact: "20sp" },
			}),
		],
	}),
});
