import { defineSection } from "../section-definition";
import {
	flex,
	footerBrand,
	footerDivider,
	footerLink,
	footerRepeater,
	footerRoot,
	footerText,
	grid,
} from "./_shared/durable-footer";

export const footerLogoNavSection = defineSection({
	category: "footer",
	pattern: "footer-logo-nav",
	repeaters: [
		footerRepeater({
			collection: "navItems",
			create: ({ source }) => footerLink({ appearance: "body-sm", source }),
			initial: 5,
			max: 8,
			target: "/props/children/0/props/children/0/props/children/1/props/children",
		}),
		footerRepeater({
			collection: "legalLinks",
			create: ({ source }) =>
				footerLink({ appearance: "body-sm", decoration: "underline", linkTone: "muted", source }),
			initial: 3,
			max: 5,
			min: 0,
			target: "/props/children/0/props/children/2/props/children/1/props/children",
		}),
	],
	root: footerRoot({
		children: [
			grid({
				children: [
					footerBrand(),
					flex({
						align: { base: "center", compact: "start" },
						children: [],
						direction: { base: "column", compact: "row" },
						gap: { base: "2sp", compact: "8sp" },
						justify: { base: "start", compact: "end" },
					}),
				],
				columns: { base: 1, compact: 2 },
				gap: "6sp",
			}),
			footerDivider(),
			grid({
				children: [
					flex({
						align: "center",
						children: [footerText({ appearance: "body-sm", content: "/copy/copyright" })],
						direction: "row",
						justify: { base: "center", compact: "start" },
					}),
					flex({
						align: { base: "center", compact: "start" },
						children: [],
						direction: { base: "column", compact: "row" },
						gap: "4sp",
						justify: { base: "start", compact: "end" },
					}),
				],
				columns: { base: 1, compact: 2 },
				gap: "4sp",
				layout: { padding: { blockStart: "8sp" } },
			}),
		],
		contentLayout: {
			padding: {
				base: { blockEnd: "12sp", blockStart: "12sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" },
				compact: { blockEnd: "16sp", blockStart: "16sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" },
			},
		},
		gap: "12sp",
	}),
});
