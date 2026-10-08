import { defineSection } from "../section-definition";
import {
	box,
	contactForm,
	contentLayout,
	description,
	flex,
	grid,
	heading,
	sectionRoot,
	space,
} from "./_shared/blocks";

export const contactFormWatermarkSection = defineSection({
	category: "contact",
	pattern: "contact-form-watermark",
	root: sectionRoot({
		children: [
			flex({
				children: [
					grid({
						children: [heading({ appearance: "heading-sm" }), description({ appearance: "body-sm" })],
						columns: { base: 1, compact: 2 },
						gap: space(6),
					}),
					contactForm({ columns: 2, layout: { inlineSize: "full" }, submitWidth: "fit" }),
					box({
						children: [
							{
								layout: { translate: { block: "35%" } },
								props: {
									align: "center",
									appearance: "watermark",
									content: { $text: "/copy/watermark" },
									element: "p",
									font: "brand",
									style: "italic",
									tone: "muted",
								},
								type: "text",
							},
						],
						decorative: true,
						layout: {
							inset: { blockEnd: 0, inlineEnd: 0, inlineStart: 0 },
							overflow: "hidden",
							position: "absolute",
							visibility: { base: "removed", compact: "visible" },
						},
						opacity: 0.2,
					}),
				],
				direction: "column",
				gap: space(12),
				layout: {
					...contentLayout(),
					padding: {
						base: { blockEnd: "20sp", blockStart: "20sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" },
						compact: { blockEnd: "18cqi", blockStart: "24sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" },
						wide: { blockEnd: "15rem", blockStart: "24sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" },
					},
					position: "relative",
				},
			}),
		],
		layout: { overflow: "hidden", position: "relative" },
	}),
});
