import { defineSection } from "../section-definition";
import {
	flex,
	footerBrand,
	footerDivider,
	footerLink,
	footerRepeater,
	footerRoot,
	footerSocialRepeater,
	footerText,
	grid,
} from "./_shared/durable-footer";

const labelled = ({ label, value }: { label: string; value: string }) =>
	flex({
		children: [
			footerText({ appearance: "body-sm", content: label, tone: "primary" }),
			footerText({ appearance: "body-sm", content: value, tone: "muted" }),
		],
		direction: "column",
		gap: "2sp",
	});

export const footerInfoGridSection = defineSection({
	category: "footer",
	pattern: "footer-info-grid",
	repeaters: [
		footerRepeater({
			collection: "navItems",
			create: ({ source }) => footerLink({ appearance: "body-sm", source }),
			initial: 10,
			max: 20,
			target: "/props/children/0/props/children/0/props/children/1/props/children",
		}),
		footerSocialRepeater({
			initial: 3,
			target: "/props/children/0/props/children/0/props/children/0/props/children/2/props/children",
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
					flex({
						children: [
							footerBrand(),
							flex({
								children: [
									labelled({ label: "/copy/addressLabel", value: "/copy/address" }),
									labelled({ label: "/copy/contactLabel", value: "/copy/contact" }),
								],
								direction: "column",
								gap: "6sp",
							}),
							flex({
								children: [],
								direction: "row",
								gap: "2sp",
							}),
						],
						direction: "column",
						gap: "8sp",
					}),
					grid({
						autoFlow: "column",
						children: [],
						columns: 2,
						rows: Array.from({ length: 5 }, () => "max-content"),
					}),
				],
				columns: { base: 1, compact: 2, wide: [{ fraction: 1 }, "32rem"] },
				gap: "12sp",
			}),
			footerDivider(),
			grid({
				children: [
					footerText({ appearance: "body-sm", content: "/copy/copyright" }),
					flex({
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
