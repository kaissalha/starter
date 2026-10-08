import type { SiteNodeDefinition } from "../../../document/structure-schema";
import { contentFrame, flex, kicker, sectionBox, text } from "./section-parts";

const menuIntro = (): SiteNodeDefinition =>
	flex({
		children: [
			kicker(),
			flex({
				children: [
					flex({
						children: [
							text({
								appearance: "display-sm",
								element: "h2",
								layout: { maxInlineSize: "42rem" },
								pointer: "/copy/heading",
							}),
						],
						layout: { inlineSize: { base: "full", wide: "50%" } },
					}),
					flex({
						children: [text({ appearance: "body-md", pointer: "/copy/description", tone: "muted" })],
						layout: { inlineSize: { base: "full", wide: "50%" } },
					}),
				],
				direction: { base: "column", wide: "row" },
				gap: { base: "4sp", wide: "8sp" },
				justify: "between",
			}),
		],
		gap: "4sp",
	});

export const menuSectionRoot = ({ list }: { list: SiteNodeDefinition }) =>
	sectionBox({
		children: [
			contentFrame({ children: [menuIntro(), list], gap: "12sp", padding: { base: "16sp", compact: "20sp" } }),
		],
	});

export const menuItemText = ({ grow, index }: { grow?: number; index: number }) =>
	flex({
		children: [
			text({ appearance: "heading-sm", element: "h3", pointer: `/items/items/${index}/title` }),
			text({
				appearance: "body-md",
				layout: { maxInlineSize: "42rem" },
				pointer: `/items/items/${index}/description`,
				tone: "muted",
			}),
		],
		gap: "1sp",
		...(grow && { layout: { grow } }),
	});
