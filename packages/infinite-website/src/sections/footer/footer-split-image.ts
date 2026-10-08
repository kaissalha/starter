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

const group = ({ children, title }: { children: Parameters<typeof flex>[0]["children"]; title: string }) =>
	flex({
		children: [footerText({ appearance: "title-sm", content: title, element: "h3" }), ...children],
		direction: "column",
		gap: "3sp",
	});

export const footerSplitImageSection = defineSection({
	category: "footer",
	pattern: "footer-split-image",
	repeaters: [
		footerRepeater({
			collection: "navItems",
			create: ({ source }) => footerLink({ appearance: "body-sm", linkTone: "muted", source }),
			initial: 5,
			max: 8,
			target: "/props/children/0/props/children/0/props/children/1/props/children/0/props/children/1/props/children",
		}),
		footerRepeater({
			collection: "socialLinks",
			create: ({ source }) => footerLink({ appearance: "body-sm", linkTone: "muted", source }),
			initial: 3,
			max: 6,
			min: 0,
			target: "/props/children/0/props/children/0/props/children/1/props/children/2/props/children/1/props/children",
		}),
	],
	root: footerRoot({
		children: [
			flex({
				children: [
					flex({
						children: [
							footerBrand(),
							footerText({ appearance: "body-sm", content: "/copy/description", tone: "muted" }),
							footerDivider(),
							footerText({ appearance: "body-sm", content: "/copy/copyright", tone: "muted" }),
						],
						direction: "column",
						gap: "4sp",
						layout: { inlineSize: { base: "full", compact: "50%", wide: "33.3333%" }, shrink: 0 },
					}),
					grid({
						children: [
							group({
								children: [flex({ children: [], direction: "column", gap: "2sp" })],
								title: "/copy/navTitle",
							}),
							group({
								children: [
									footerText({ appearance: "body-sm", content: "/copy/address", tone: "muted" }),
								],
								title: "/copy/addressTitle",
							}),
							group({
								children: [flex({ children: [], direction: "column", gap: "2sp" })],
								title: "/copy/socialTitle",
							}),
						],
						columns: { base: 1, wide: 3 },
						gap: { base: "6sp", wide: "8sp" },
						layout: { grow: 1, inlineSize: { base: "full", compact: "50%", wide: "auto" } },
					}),
				],
				direction: { base: "column", compact: "row" },
				gap: "16sp",
				justify: "between",
				layout: {
					padding: {
						base: { blockEnd: "12sp", blockStart: "12sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" },
						compact: { blockEnd: "16sp", blockStart: "16sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" },
					},
				},
			}),
			{
				layout: { blockSize: { base: "20sp", compact: "32sp" }, inlineSize: "full" },
				props: {
					alt: { $text: "/media/items/0/alt" },
					assetId: { $asset: "/media/items/0/assetId" },
					fill: "subtle",
					fit: "cover",
				},
				type: "media",
			},
		],
		contentLayout: {},
	}),
});
