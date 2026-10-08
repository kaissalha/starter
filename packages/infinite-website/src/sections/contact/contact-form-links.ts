import { defineSection } from "../section-definition";
import {
	contactForm,
	contentLayout,
	flex,
	formIntro,
	grid,
	iconItem,
	linkAction,
	sectionRoot,
	space,
	text,
} from "./_shared/blocks";

const label = (pointer: string) => text({ appearance: "body-md-em", pointer });

export const contactFormLinksSection = defineSection({
	category: "contact",
	pattern: "contact-form-links",
	root: sectionRoot({
		children: [
			flex({
				children: [
					formIntro({ layout: { maxInlineSize: "56rem" } }),
					grid({
						children: [
							contactForm({ submitWidth: "fit" }),
							flex({
								children: [
									iconItem({
										children: [label("/copy/emailLabel"), linkAction({ index: 0 })],
										icon: "email",
									}),
									iconItem({
										children: [label("/copy/phoneLabel"), linkAction({ index: 1 })],
										icon: "phone",
									}),
									iconItem({
										children: [
											label("/copy/addressLabel"),
											text({ appearance: "body-md", pointer: "/copy/address", tone: "muted" }),
											linkAction({ index: 2 }),
										],
										icon: "location-pin",
									}),
								],
								direction: "column",
								gap: space(8),
								layout: { maxInlineSize: { base: "full", compact: "36rem" } },
							}),
						],
						columns: { base: 1, wide: 2 },
						gap: space(16),
					}),
				],
				direction: "column",
				gap: space({ base: 8, compact: 16 }),
				layout: contentLayout(),
			}),
		],
	}),
});
