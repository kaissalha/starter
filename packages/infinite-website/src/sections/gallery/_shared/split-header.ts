import type { SiteNodeDefinition } from "../../../document/structure-schema";
import { buttons, flex, kicker, text } from "./section-parts";

const centered = { margin: { inlineEnd: "auto", inlineStart: "auto" } } as const;

export const splitHeader = ({
	center,
	hasButtons = true,
	hasKicker = true,
}: {
	center: boolean;
	hasButtons?: boolean;
	hasKicker?: boolean;
}): SiteNodeDefinition => {
	const align = center ? "center" : "start";
	const columnSize = { inlineSize: center ? "full" : { base: "full", wide: "50%" } } as const;

	return flex({
		align: center ? "center" : undefined,
		children: [
			...(hasKicker ? [kicker({ align })] : []),
			flex({
				align,
				children: [
					flex({
						children: [
							text({
								align,
								appearance: "display-sm",
								element: "h2",
								layout: { maxInlineSize: "36rem", ...(center && centered) },
								pointer: "/copy/heading",
								tone: "primary",
							}),
						],
						gap: "8sp",
						layout: columnSize,
					}),
					flex({
						align: center ? { base: "stretch", compact: "center" } : undefined,
						children: [
							text({
								align,
								appearance: "body-md",
								layout: { maxInlineSize: "42rem", ...(center && centered) },
								pointer: "/copy/description",
								tone: "muted",
							}),
							...(hasButtons ? [buttons({ align })] : []),
						],
						gap: "8sp",
						layout: columnSize,
					}),
				],
				direction: center ? "column" : { base: "column", wide: "row" },
				gap: "6sp",
			}),
		],
		gap: "4sp",
	});
};
