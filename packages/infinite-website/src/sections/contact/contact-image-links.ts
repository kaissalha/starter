import { defineSection } from "../section-definition";
import {
	contentLayout,
	flex,
	formIntro,
	grid,
	iconItem,
	linkAction,
	media,
	sectionRoot,
	space,
	text,
} from "./_shared/blocks";

const label = (pointer: string) => text({ appearance: "body-md-em", pointer });

export const contactImageLinksSection = defineSection({
	category: "contact",
	pattern: "contact-image-links",
	root: sectionRoot({
		children: [
			flex({
				children: [
					formIntro({ descriptionAppearance: "body-lg", layout: { maxInlineSize: "36rem" } }),
					grid({
						children: [
							flex({
								children: [
									iconItem({
										children: [label("/copy/emailLabel"), linkAction({ index: 0 })],
										icon: "email",
										pill: "subtle",
									}),
									iconItem({
										children: [label("/copy/phoneLabel"), linkAction({ index: 1 })],
										icon: "phone",
										pill: "subtle",
									}),
									iconItem({
										children: [
											label("/copy/addressLabel"),
											text({ appearance: "body-md", pointer: "/copy/address", tone: "muted" }),
											linkAction({ index: 2 }),
										],
										icon: "location-pin",
										pill: "subtle",
									}),
								],
								direction: "column",
								gap: space(8),
							}),
							media({
								layout: {
									aspectRatio: { base: { height: 3, width: 4 }, wide: "auto" },
									minBlockSize: space(96),
									minInlineSize: 0,
								},
								radius: "theme",
							}),
						],
						columns: { base: 1, wide: ["36rem", { fraction: 1 }] },
						gap: space(16),
					}),
				],
				direction: "column",
				gap: space(16),
				layout: contentLayout(),
			}),
		],
	}),
});
