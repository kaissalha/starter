import { defineSection } from "../section-definition";
import {
	flex,
	footerDivider,
	footerLink,
	footerRepeater,
	footerRoot,
	footerSocialRepeater,
	footerText,
	grid,
} from "./_shared/durable-footer";

const cell = ({
	child,
	justify,
}: {
	child: Parameters<typeof flex>[0]["children"][number];
	justify: "center" | "end" | "start";
}) => flex({ children: [child], direction: "row", justify: { base: "center", wide: justify } });

export const footerLogoHighlightSection = defineSection({
	category: "footer",
	pattern: "footer-logo-highlight",
	repeaters: [
		footerRepeater({
			collection: "navItems",
			create: ({ source }) => footerLink({ appearance: "body-sm", source }),
			initial: 5,
			max: 8,
			target: "/props/children/0/props/children/0/props/children/0/props/children",
		}),
		footerSocialRepeater({
			initial: 3,
			target: "/props/children/0/props/children/3/props/children/2/props/children/0/props/children",
		}),
	],
	root: footerRoot({
		children: [
			flex({
				children: [
					flex({
						align: "center",
						children: [],
						direction: { base: "column", compact: "row" },
						gap: { base: "2sp", compact: "8sp" },
						justify: { base: "start", compact: "center" },
						layout: { padding: { base: { blockStart: 0 }, compact: { blockStart: "4sp" } } },
					}),
					footerDivider(),
				],
				direction: "column",
				gap: "6sp",
			}),
			flex({
				children: [footerText({ appearance: "heading-lg", content: "/copy/brand" })],
				direction: "row",
				justify: "center",
			}),
			footerDivider(),
			grid({
				align: "center",
				children: [
					cell({
						child: footerText({ appearance: "body-sm", content: "/copy/copyright", tone: "muted" }),
						justify: "start",
					}),
					cell({
						child: footerText({ appearance: "body-sm", content: "/copy/address", tone: "muted" }),
						justify: "center",
					}),
					cell({
						child: flex({
							children: [],
							direction: "row",
							gap: "2sp",
						}),
						justify: "end",
					}),
				],
				columns: { base: 1, wide: 3 },
				gap: { base: "2sp", compact: "4sp", wide: "8sp" },
				justify: "stretch",
				layout: { padding: { base: { blockStart: "2sp" }, compact: { blockEnd: "6sp", blockStart: "6sp" } } },
			}),
		],
		contentLayout: {
			padding: {
				base: { blockEnd: "8sp", blockStart: "8sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" },
				compact: { blockEnd: "10sp", blockStart: "10sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" },
			},
		},
		gap: { base: "6sp", compact: "12sp" },
	}),
});
