import { defineSection } from "../section-definition";
import {
	contactForm,
	contentLayout,
	description,
	flex,
	heading,
	iconText,
	kicker,
	sectionRoot,
	space,
} from "./_shared/blocks";

export const contactFormTextSection = defineSection({
	category: "contact",
	pattern: "contact-form-text",
	root: sectionRoot({
		children: [
			flex({
				align: "center",
				children: [
					flex({
						align: "center",
						children: [
							kicker({ align: "center" }),
							flex({
								align: "center",
								children: [heading({ align: "center" }), description({ align: "center" })],
								direction: "column",
								gap: space(6),
							}),
							flex({
								children: [
									iconText({ icon: "email", pointer: "/copy/email" }),
									iconText({ icon: "phone", pointer: "/copy/phone" }),
									iconText({ icon: "location-pin", pointer: "/copy/address" }),
								],
								direction: "column",
								gap: space(3),
							}),
						],
						direction: "column",
						gap: space(4),
						layout: { maxInlineSize: "36rem" },
					}),
					contactForm({ layout: { inlineSize: "full", maxInlineSize: "42rem" }, submitWidth: "fit" }),
				],
				direction: "column",
				gap: space(8),
				justify: "center",
				layout: contentLayout(),
			}),
		],
	}),
});
