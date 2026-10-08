import type { SiteNodeDefinition } from "../../../document/structure-schema";
import { buttonRow, flex, frameLayout, pad, sectionBox, space, text } from "../../metrics/_shared/parts";
import { defineSection } from "../../section-definition";

export const blogSection = ({
	header,
	pattern,
	top,
}: {
	header: SiteNodeDefinition;
	pattern: string;
	top: { base: number; compact: number };
}) =>
	defineSection({
		category: "content",
		pattern,
		root: sectionBox({
			children: [
				flex({
					children: [
						header,
						text({
							appearance: "body-md",
							layout: { visibility: "removed" },
							pointer: "/copy/empty",
						}),
					],
					layout: frameLayout({ bottom: 0, top }),
				}),
			],
		}),
	});

export const blogTitleBlock = ({
	descriptionAppearance = "body-md",
	headingAppearance = "display-sm",
	maxInlineSize = "36rem",
}: {
	descriptionAppearance?: "body-md" | "body-sm";
	headingAppearance?: "display-sm" | "heading-sm";
	maxInlineSize?: string;
} = {}): SiteNodeDefinition =>
	flex({
		children: [
			text({ appearance: headingAppearance, element: "h2", pointer: "/copy/heading" }),
			text({ appearance: descriptionAppearance, pointer: "/copy/description", tone: "muted" }),
		],
		gap: space(headingAppearance === "display-sm" ? 4 : 2),
		layout: { maxInlineSize },
	});

export const blogHeaderRow = ({
	align,
	gap,
	padBottom,
	title,
}: {
	align: "center" | "end";
	gap: { base: number; compact: number };
	padBottom: { base: number; compact: number };
	title: SiteNodeDefinition;
}): SiteNodeDefinition =>
	flex({
		align: { base: "stretch", wide: align },
		children: [
			flex({ children: [title], layout: { inlineSize: { base: "full", wide: "50%" } } }),
			buttonRow({ appearances: ["outline"], layout: { shrink: 0 } }),
		],
		direction: { base: "column", wide: "row" },
		gap: space(gap),
		justify: "between",
		layout: { padding: pad({ bottom: padBottom }) },
	});
