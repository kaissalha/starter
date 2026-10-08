import { defineSection } from "../section-definition";
import { footerDivider, footerLink, footerRepeater, footerRoot, footerText } from "./_shared/durable-footer";

export const footerContactSplitSection = defineSection({
	category: "footer",
	pattern: "footer-contact-split",
	repeaters: [
		footerRepeater({
			collection: "socialLinks",
			create: ({ source }) => footerLink({ appearance: "body-md", source }),
			initial: 3,
			max: 6,
			min: 0,
			target: "/props/children/0/props/children/0/props/children/1/props/children/1/props/children",
		}),
		footerRepeater({
			collection: "legalLinks",
			create: ({ source }) => footerLink({ appearance: "body-sm", linkTone: "muted", source }),
			initial: 2,
			max: 4,
			min: 0,
			target: "/props/children/0/props/children/1/props/children/1/props/children/1/props/children",
		}),
	],
	root: footerRoot({
		children: [
			{
				layout: {},
				props: {
					children: [
						{
							layout: {},
							props: {
								align: "start",
								children: [
									footerText({
										appearance: "body-lg",
										content: "/copy/heading",
										element: "h2",
										italic: true,
									}),
									footerLink({
										appearance: "body-lg",
										border: true,
										italic: true,
										layout: { padding: { blockEnd: "2sp" } },
										source: "/actions/items/0",
									}),
								],
								direction: "column",
								gap: { base: "6sp", wide: "8sp" },
							},
							type: "flex",
						},
						{
							layout: {},
							props: {
								align: "start",
								children: [
									footerText({
										appearance: "body-sm",
										content: "/copy/socialTitle",
										element: "h3",
										tone: "muted",
									}),
									{
										layout: {},
										props: { align: "start", children: [], direction: "column", gap: "2sp" },
										type: "flex",
									},
								],
								direction: "column",
								gap: { base: "4sp", wide: "3sp" },
							},
							type: "flex",
						},
					],
					direction: { base: "column", compact: "row" },
					gap: { base: "6sp", compact: "8sp" },
					justify: "between",
				},
				type: "flex",
			},
			{
				layout: {},
				props: {
					align: "stretch",
					children: [
						footerDivider(),
						{
							layout: {},
							props: {
								align: { base: "start", compact: "center" },
								children: [
									footerText({ appearance: "body-sm", content: "/copy/copyright", tone: "muted" }),
									{
										layout: {},
										props: {
											align: { base: "start", compact: "center" },
											children: [],
											direction: { base: "column", compact: "row" },
											gap: { base: "2sp", compact: "6sp" },
										},
										type: "flex",
									},
								],
								direction: { base: "column", compact: "row" },
								gap: { base: "3sp", compact: "4sp" },
								justify: "between",
							},
							type: "flex",
						},
					],
					direction: "column",
					gap: { base: "6sp", compact: "4sp" },
				},
				type: "flex",
			},
		],
		contentLayout: {
			padding: {
				base: { blockEnd: "20sp", blockStart: "20sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" },
				compact: { blockEnd: "24sp", blockStart: "24sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" },
			},
		},
		gap: "16sp",
	}),
});
