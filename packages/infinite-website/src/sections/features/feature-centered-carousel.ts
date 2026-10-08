import type { AuthoringJsonValue } from "../../document/content-schema";
import type { SiteNodeDefinition } from "../../document/structure-schema";
import { defineSection } from "../section-definition";
import { carouselOverflowViewport, clippedSectionLayout } from "./_shared/durable-carousel";
import { button, heading, kicker, media, pad, sectionContent, sectionRoot, text } from "./_shared/durable-parts";

const fullInset = { blockEnd: 0, blockStart: 0, inlineEnd: 0, inlineStart: 0 };

const slide = ({ index }: { index: number }): SiteNodeDefinition => {
	const pointer = `/features/items/${index}`;

	return {
		props: {
			children: [
				{
					layout: {
						aspectRatio: { height: 3, width: 4 },
						inlineSize: "full",
						overflow: "hidden",
						position: "relative",
					},
					props: {
						children: [
							media({
								layout: {
									blockSize: "full",
									inlineSize: "full",
									inset: fullInset,
									position: "absolute",
								},
								pointer,
							}),
							{
								layout: {
									inset: fullInset,
									padding: pad({ block: "6sp", inline: "6sp" }),
									position: "absolute",
									visibility: { base: "removed", compact: "visible" },
								},
								props: {
									children: [
										{
											layout: {
												maxInlineSize: { base: "80%", wide: "48rem" },
												padding: pad({ block: "4sp", inline: "5sp" }),
											},
											props: {
												children: [
													text({
														appearance: "heading-md",
														element: "h3",
														pointer: `${pointer}/title`,
														tone: "media",
													}),
													text({
														appearance: "body-sm",
														pointer: `${pointer}/description`,
														tone: "media",
													}),
												],
												direction: "column",
												fill: "black",
												fillOpacity: 0.7,
												gap: "1sp",
												radius: "theme",
											},
											type: "flex",
										},
									],
								},
								type: "box",
							},
						],
						radius: "theme",
					},
					type: "box",
				},
				{
					layout: { margin: { blockStart: "4sp" }, visibility: { base: "visible", compact: "removed" } },
					props: {
						children: [
							text({ appearance: "heading-sm", element: "h3", pointer: `${pointer}/title` }),
							text({ appearance: "body-sm", pointer: `${pointer}/description`, tone: "muted" }),
						],
						direction: "column",
						gap: "1sp",
					},
					type: "flex",
				},
			],
			direction: "column",
		},
		type: "flex",
	};
};

export const featureCenteredCarouselSection = defineSection({
	category: "features",
	pattern: "feature-centered-carousel",
	repeaters: [
		{
			collection: "/features",
			createValues: ({ index }): Array<AuthoringJsonValue> => [slide({ index })],
			initial: 5,
			max: 8,
			min: 2,
			target: "/props/children/0/props/children/1/props/slides",
		},
	],
	root: sectionRoot({
		children: [
			sectionContent({
				align: "stretch",
				children: [
					{
						props: {
							align: "center",
							children: [
								{
									props: {
										align: "center",
										children: [
											kicker({ align: "center" }),
											heading({ align: "center", layout: { maxInlineSize: "48rem" } }),
										],
										direction: "column",
										gap: "4sp",
									},
									type: "flex",
								},
								{
									props: {
										align: "center",
										children: [
											text({
												align: "center",
												appearance: "body-md",
												layout: { maxInlineSize: "42rem" },
												pointer: "/copy/description",
												tone: "muted",
											}),
											button({}),
										],
										direction: "column",
										gap: "6sp",
									},
									type: "flex",
								},
							],
							direction: "column",
							gap: "6sp",
						},
						type: "flex",
					},
					{
						props: {
							autoplay: { delay: 3000, pauseOnHover: true },
							controlGroups: [
								{
									align: "center",
									controls: [
										{
											active: { blockSize: "2sp", inlineSize: "6sp", opacity: 1 },
											appearance: { foreground: "primary" },
											inactive: { blockSize: "2sp", inlineSize: "2sp", opacity: 0.3 },
											kind: "indicators",
											label: { $text: "/accessibility/indicatorsLabel" },
											spacing: "2sp",
										},
									],
									placement: "after",
								},
							],
							controlsGap: "6sp",
							gap: "6sp",
							inactiveOpacity: 0.4,
							label: { $text: "/accessibility/carouselLabel" },
							options: { align: "center", loop: true },
							slideBasis: { base: "92%", compact: "88%", wide: "85%" },
							slides: [],
							viewportLayout: carouselOverflowViewport,
						},
						type: "carousel",
					},
				],
				gap: { base: "8sp", compact: "12sp" },
				padding: {
					base: pad({ block: "16sp", inline: "1.5rem" }),
					compact: pad({ block: "20sp", inline: "1.5rem" }),
				},
			}),
		],
		layout: clippedSectionLayout,
	}),
});
