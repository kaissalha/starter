import type { SiteNodeDefinition } from "../../document/structure-schema";
import { defineSection } from "../section-definition";
import { flex, footerBrand, footerLink, footerRepeater, footerRoot, footerText, grid } from "./_shared/durable-footer";

const navRow = ({ source }: { source: string }) =>
	({
		layout: {
			inlineSize: "full",
			padding: { blockEnd: "6sp", blockStart: "6sp", inlineEnd: "6sp", inlineStart: "6sp" },
		},
		props: {
			border: { color: "border", sides: ["block-end"], width: "1px" },
			children: [
				{
					layout: { inlineSize: "full" },
					props: {
						align: "center",
						children: [
							{
								props: {
									appearance: "body-md",
									content: { $text: `${source}/label` },
									element: "span",
									tone: "current",
								},
								type: "text",
							},
							{ props: { name: "arrow-up-right", size: "4sp", tone: "accent-text" }, type: "icon" },
						],
						direction: "row",
						justify: "between",
					},
					type: "flex",
				},
			],
			fill: "transparent",
			foreground: "primary",
			href: { $link: `${source}/link` },
			radius: "none",
		},
		type: "action",
	}) satisfies SiteNodeDefinition;

export const footerEditorialSplitSection = defineSection({
	category: "footer",
	pattern: "footer-editorial-split",
	repeaters: [
		footerRepeater({
			collection: "socialLinks",
			create: ({ source }) => footerLink({ appearance: "body-sm", linkTone: "muted", source }),
			initial: 3,
			max: 6,
			min: 0,
			target: "/props/children/0/props/children/0/props/children/0/props/children/1/props/children/0/props/children",
		}),
		footerRepeater({
			collection: "legalLinks",
			create: ({ source }) =>
				footerLink({ appearance: "body-sm", decoration: "underline", linkTone: "muted", source }),
			initial: 3,
			max: 5,
			min: 0,
			target: "/props/children/0/props/children/0/props/children/0/props/children/1/props/children/1/props/children",
		}),
		footerRepeater({
			collection: "navItems",
			create: ({ source }) => navRow({ source }),
			initial: 4,
			max: 8,
			target: "/props/children/0/props/children/0/props/children/1/props/children/0/props/children",
		}),
	],
	root: footerRoot({
		children: [
			grid({
				children: [
					flex({
						border: { color: "border", sides: ["inline-start"], width: "1px" },
						children: [
							flex({
								children: [
									footerBrand(),
									footerText({ appearance: "body-sm", content: "/copy/copyright", tone: "muted" }),
								],
								direction: "column",
								gap: "2sp",
							}),
							flex({
								children: [
									flex({ children: [], direction: "row", gap: "4sp", wrap: "wrap" }),
									flex({ children: [], direction: "row", gap: "6sp", wrap: "wrap" }),
								],
								direction: "column",
								gap: "4sp",
							}),
						],
						direction: "column",
						gap: "12sp",
						justify: "between",
						layout: {
							padding: {
								base: { blockEnd: "8sp", blockStart: "8sp", inlineEnd: "6sp", inlineStart: "6sp" },
								compact: { blockEnd: "10sp", blockStart: "10sp", inlineEnd: "6sp", inlineStart: "6sp" },
							},
						},
					}),
					flex({
						border: { color: "border", sides: ["inline-start", "inline-end"], width: "1px" },
						children: [
							flex({ children: [], direction: "column" }),
							{
								layout: { blockSize: "165px", inlineSize: "full" },
								props: {
									alt: { $text: "/media/items/0/alt" },
									assetId: { $asset: "/media/items/0/assetId" },
									fill: "subtle",
									fit: "cover",
								},
								type: "media",
							},
						],
						direction: "column",
						layout: {
							padding: {
								base: { blockEnd: "8sp", blockStart: "8sp" },
								compact: { blockEnd: "10sp", blockStart: "10sp" },
							},
						},
					}),
				],
				columns: { base: 1, wide: 2 },
			}),
		],
		contentLayout: { padding: { base: { inlineEnd: "1.5rem", inlineStart: "1.5rem" } } },
	}),
});
