import type { SiteNodeDefinition } from "../../../document/structure-schema";
import { buttonRow, flex, kicker, space, text } from "./parts";

export const splitIntro = ({
	buttonAppearance,
	descriptionMaxInlineSize,
}: {
	buttonAppearance: "outline" | "secondary";
	descriptionMaxInlineSize?: string;
}): SiteNodeDefinition =>
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
								layout: { maxInlineSize: "36rem" },
								pointer: "/copy/heading",
							}),
						],
						layout: { inlineSize: { base: "full", wide: "50%" } },
					}),
					flex({
						children: [
							text({
								appearance: "body-md",
								layout: descriptionMaxInlineSize
									? { maxInlineSize: descriptionMaxInlineSize }
									: undefined,
								pointer: "/copy/description",
								tone: "muted",
							}),
							buttonRow({ appearances: [buttonAppearance] }),
						],
						gap: space(8),
						layout: { inlineSize: { base: "full", wide: "50%" } },
					}),
				],
				direction: { base: "column", wide: "row" },
				gap: space({ base: 4, compact: 8 }),
				justify: "between",
			}),
		],
		gap: space(4),
	});
