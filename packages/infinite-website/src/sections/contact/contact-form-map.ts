import { googleMapSettingsSchema } from "../../document/structure-schema";
import { defineSection } from "../section-definition";
import { contactForm, contentLayout, flex, formIntro, grid, mapEmbed, sectionRoot, space } from "./_shared/blocks";

export const contactFormMapSection = defineSection({
	category: "contact",
	pattern: "contact-form-map",
	root: sectionRoot({
		children: [
			grid({
				children: [
					flex({
						children: [
							flex({
								children: [formIntro(), contactForm({ submitWidth: "fit" })],
								direction: "column",
								gap: space(8),
								layout: { inlineSize: "full" },
							}),
						],
						direction: "column",
						justify: "center",
					}),
					mapEmbed({
						layout: {
							aspectRatio: {
								base: { height: 1, width: 1 },
								compact: { height: 3, width: 4 },
								wide: "auto",
							},
						},
					}),
				],
				columns: { base: 1, wide: 2 },
				gap: space(16),
				layout: contentLayout(),
			}),
		],
	}),
	settings: googleMapSettingsSchema,
});
