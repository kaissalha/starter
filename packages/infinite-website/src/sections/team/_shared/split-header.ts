import type { Length, Responsive } from "../../../document/structure-schema";
import { buttonGroup, flex, kicker, text } from "./nodes";

export const createSplitHeader = ({
	buttonVariants = [],
	columnGap,
	descriptionMaxWidth,
	rowAlign,
	rowGap,
}: {
	buttonVariants?: Array<"outline" | "primary" | "secondary">;
	columnGap: Length;
	descriptionMaxWidth?: Length;
	rowAlign?: "start";
	rowGap: Responsive<Length>;
}) =>
	flex({
		children: [
			kicker({ pointer: "/copy/kicker" }),
			flex({
				align: { base: "stretch", wide: rowAlign ?? "stretch" },
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
						direction: "column",
						layout: { inlineSize: { base: "full", wide: "50%" } },
					}),
					flex({
						children: [
							text({
								appearance: "body-md",
								layout: descriptionMaxWidth ? { maxInlineSize: descriptionMaxWidth } : {},
								pointer: "/copy/description",
								tone: "muted",
							}),
							...(buttonVariants.length > 0 ? [buttonGroup({ variants: buttonVariants })] : []),
						],
						direction: "column",
						gap: columnGap,
						layout: { inlineSize: { base: "full", wide: "50%" } },
					}),
				],
				direction: { base: "column", wide: "row" },
				gap: rowGap,
				justify: "between",
			}),
		],
		direction: "column",
		gap: "4sp",
	});
