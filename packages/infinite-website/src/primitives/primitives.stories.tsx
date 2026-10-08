import type { Meta, StoryObj } from "@storybook/react-vite";

import type { SiteNode } from "../document/structure-schema";
import type { AssetMap } from "../rendering/render-node";
import { StoryPreview } from "../storybook/story-preview";

const assets: AssetMap = {
	studio: {
		src: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1600&q=80",
	},
	studioVideo: {
		poster: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1600&q=80",
		src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm",
		type: "video",
	},
	youtubeVideo: {
		src: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
		type: "video",
	},
};

const textNode: SiteNode = {
	id: "primitive_text",
	props: {
		content: "A clear message, composed from a small grammar.",
		element: "p",
		fontSize: "1.125rem",
		lineHeight: 1.6,
		wrap: "pretty",
	},
	type: "text",
};

const meta = {
	component: StoryPreview,
	parameters: { layout: "fullscreen" },
	title: "Primitives/Core grammar",
} satisfies Meta<typeof StoryPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Box: Story = {
	args: {
		node: {
			id: "primitive_box",
			layout: {
				maxInlineSize: "40rem",
				padding: { blockEnd: "2rem", blockStart: "2rem", inlineEnd: "2rem", inlineStart: "2rem" },
			},
			props: { children: [textNode], fill: "subtle", radius: "theme" },
			type: "box",
		},
	},
};

export const Flex: Story = {
	args: {
		node: {
			id: "primitive_flex",
			props: {
				children: [
					{ ...textNode, id: "primitive_flex_first" },
					{ ...textNode, id: "primitive_flex_second", props: { ...textNode.props, tone: "muted" } },
				],
				direction: { base: "column", compact: "row" },
				gap: "1rem",
			},
			type: "flex",
		},
	},
};

export const Grid: Story = {
	args: {
		node: {
			id: "primitive_grid",
			props: {
				children: ["Strategy", "Craft", "Delivery"].map((content, index) => ({
					id: `primitive_grid_${index}`,
					layout: {
						padding: { blockEnd: "2rem", blockStart: "2rem", inlineEnd: "1.5rem", inlineStart: "1.5rem" },
					},
					props: {
						children: [
							{
								id: `primitive_grid_${index}_label`,
								props: { content, element: "p" as const, weight: "semibold" as const },
								type: "text" as const,
							},
						],
						fill: "subtle" as const,
						radius: "theme" as const,
					},
					type: "box" as const,
				})),
				columns: { base: 1, compact: 3 },
				gap: "1rem",
			},
			type: "grid",
		},
	},
};

export const Text: Story = { args: { node: textNode } };

export const Media: Story = {
	args: {
		assets,
		node: {
			id: "primitive_media",
			layout: { aspectRatio: { height: 9, width: 16 }, inlineSize: "full", maxInlineSize: "48rem" },
			props: { alt: "A collaborative architecture studio", assetId: "studio", radius: "theme" },
			type: "media",
		},
	},
};

export const VideoMedia: Story = {
	args: {
		assets,
		node: {
			id: "primitive_video_media",
			layout: { aspectRatio: { height: 9, width: 16 }, inlineSize: "full", maxInlineSize: "48rem" },
			props: {
				alt: "Studio work in motion",
				assetId: "youtubeVideo",
				radius: "theme",
			},
			type: "media",
		},
	},
};

export const MediaContrastOverlay: Story = {
	args: {
		assets,
		node: {
			id: "primitive_media_overlay",
			layout: {
				aspectRatio: { base: { height: 5, width: 4 }, medium: { height: 9, width: 16 } },
				inlineSize: "full",
				maxInlineSize: "48rem",
				overflow: "hidden",
				position: "relative",
			},
			props: {
				children: [
					{
						id: "primitive_media_overlay_video",
						layout: {
							blockSize: "full",
							inlineSize: "full",
							inset: { blockEnd: 0, blockStart: 0, inlineEnd: 0, inlineStart: 0 },
							position: "absolute",
						},
						props: {
							alt: "A flower moving in the breeze",
							assetId: "studioVideo",
							overlay: { kind: "scrim", strength: "strong" },
							playback: "background",
						},
						type: "media",
					},
					{
						id: "primitive_media_overlay_content",
						layout: {
							blockSize: "full",
							inlineSize: "full",
							padding: {
								blockEnd: "2rem",
								blockStart: "2rem",
								inlineEnd: "2rem",
								inlineStart: "2rem",
							},
							position: "relative",
						},
						props: {
							children: [
								{
									id: "primitive_media_overlay_heading",
									props: {
										appearance: "display-xs",
										content: "Readable on every frame",
										element: "h2",
										tone: "primary",
									},
									type: "text",
								},
								{
									id: "primitive_media_overlay_body",
									props: {
										appearance: "body-md",
										content: "A strong scrim protects body-text contrast over changing imagery.",
										element: "p",
										tone: "muted",
									},
									type: "text",
								},
							],
							direction: "column",
							gap: "1rem",
							justify: "end",
						},
						type: "flex",
					},
				],
				foreground: "media",
				radius: "theme",
			},
			type: "box",
		},
	},
};

export const Icon: Story = {
	args: {
		node: {
			id: "primitive_icon",
			props: { label: "Continue", name: "chevron-end", size: "2rem", tone: "accent" },
			type: "icon",
		},
	},
};

export const Action: Story = {
	args: {
		node: {
			id: "primitive_action",
			layout: {
				padding: { blockEnd: "0.875rem", blockStart: "0.875rem", inlineEnd: "1.25rem", inlineStart: "1.25rem" },
			},
			props: {
				children: [
					{
						id: "primitive_action_label",
						props: { content: "Start a project", element: "span", weight: "semibold" },
						type: "text",
					},
				],
				fill: "action",
				foreground: "action",
				href: { href: "#contact", kind: "anchor" },
				radius: "theme",
			},
			type: "action",
		},
	},
};

export const Embed: Story = {
	args: {
		node: {
			id: "primitive_embed",
			layout: { aspectRatio: { height: 9, width: 16 }, inlineSize: "full", maxInlineSize: "48rem" },
			props: {
				config: { address: "Toronto, Ontario", zoom: 12 },
				fill: "subtle",
				label: "Map of Toronto, Ontario",
				provider: "google-map",
				radius: "theme",
			},
			type: "embed",
		},
	},
};

export const Carousel: Story = {
	args: {
		node: {
			id: "primitive_carousel",
			props: {
				controlGroups: [
					{
						align: "end",
						controls: [
							{
								appearance: { fill: "subtle", radius: "full" },
								kind: "previous",
								label: "Previous service",
							},
							{ appearance: { fill: "subtle", radius: "full" }, kind: "next", label: "Next service" },
						],
						gap: "0.5rem",
						id: "primitive_carousel_controls",
						placement: "after",
					},
				],
				gap: "1rem",
				label: "Selected services",
				slideBasis: { base: "85%", compact: "50%" },
				slides: ["Planning", "Construction", "Finishing"].map((content, index) => ({
					id: `primitive_carousel_slide_${index}`,
					layout: {
						minBlockSize: "16rem" as const,
						padding: { blockEnd: "2rem", blockStart: "2rem", inlineEnd: "2rem", inlineStart: "2rem" },
					},
					props: {
						children: [
							{
								id: `primitive_carousel_slide_${index}_label`,
								props: {
									content,
									element: "h3" as const,
									font: "brand" as const,
									fontSize: "2rem" as const,
								},
								type: "text" as const,
							},
						],
						fill: "subtle" as const,
						radius: "theme" as const,
					},
					type: "box" as const,
				})),
			},
			type: "carousel",
		},
	},
};

export const Disclosure: Story = {
	args: {
		node: {
			id: "primitive_disclosure",
			layout: { maxInlineSize: "48rem" },
			props: {
				items: ["How long does a project take?", "Do you provide an estimate?"].map((content, index) => ({
					id: `primitive_disclosure_${index}`,
					panel: [
						{
							id: `primitive_disclosure_${index}_panel`,
							props: {
								content:
									"We plan the scope with you first, then provide a clear schedule and written estimate.",
								element: "p" as const,
								tone: "muted" as const,
							},
							type: "text" as const,
						},
					],
					trigger: [
						{
							id: `primitive_disclosure_${index}_trigger`,
							props: {
								content,
								element: "span" as const,
								fontSize: "1.125rem" as const,
								weight: "semibold" as const,
							},
							type: "text" as const,
						},
					],
				})),
			},
			type: "disclosure",
		},
	},
};

export const NavigationMenu: Story = {
	args: {
		node: {
			id: "primitive_menu",
			props: {
				actions: [],
				brand: [
					{
						id: "primitive_menu_brand",
						props: {
							content: "North Studio",
							element: "span",
							font: "brand",
							fontSize: "1.5rem",
							weight: "semibold",
						},
						type: "text",
					},
				],
				fill: "canvas",
				items: ["Services", "Work", "About"].map((content, index) => ({
					href: { href: `#${content.toLowerCase()}`, kind: "anchor" as const },
					id: `primitive_menu_item_${index}`,
					trigger: [
						{
							id: `primitive_menu_item_${index}_label`,
							props: { content, element: "span" as const, fontSize: "0.9375rem" as const },
							type: "text" as const,
						},
					],
				})),
				label: "North Studio navigation",
				mobileLabel: "Open navigation",
			},
			type: "menu",
		},
	},
};

export const Masonry: Story = {
	args: {
		node: {
			id: "primitive_masonry",
			props: {
				children: (["10rem", "16rem", "12rem", "18rem", "11rem"] satisfies Array<`${number}rem`>).map(
					(blockSize, index) => ({
						id: `primitive_masonry_${index}`,
						layout: { blockSize },
						props: {
							children: [],
							fill: index % 2 === 0 ? ("subtle" as const) : ("featured" as const),
							radius: "theme" as const,
						},
						type: "box" as const,
					})
				),
				columns: { base: 1, compact: 3 },
				gap: "1rem",
			},
			type: "masonry",
		},
	},
};

export const Tabs: Story = {
	args: {
		node: {
			id: "primitive_tabs",
			layout: { maxInlineSize: "52rem" },
			props: {
				defaultValue: "residential",
				indicatorAppearance: { fill: "accent", radius: "full" },
				items: ["Residential", "Commercial", "Renovation"].map((content, index) => ({
					id: `primitive_tabs_${index}`,
					panel: [
						{
							id: `primitive_tabs_${index}_panel`,
							layout: {
								padding: {
									blockEnd: "2rem",
									blockStart: "2rem",
									inlineEnd: "2rem",
									inlineStart: "2rem",
								},
							},
							props: {
								children: [
									{
										id: `primitive_tabs_${index}_panel_text`,
										props: {
											content: `${content} projects receive a dedicated plan, schedule, and point of contact.`,
											element: "p" as const,
										},
										type: "text" as const,
									},
								],
								fill: "subtle" as const,
								radius: "theme" as const,
							},
							type: "box" as const,
						},
					],
					trigger: [
						{
							id: `primitive_tabs_${index}_trigger`,
							props: { content, element: "span" as const, weight: "semibold" as const },
							type: "text" as const,
						},
					],
					value: content.toLowerCase(),
				})),
				label: "Service details",
				listAppearance: { gap: "1.5rem" },
				tabAppearance: {
					padding: {
						blockEnd: "0.75rem",
						blockStart: "0.75rem",
						inlineEnd: "0.125rem",
						inlineStart: "0.125rem",
					},
				},
			},
			type: "tabs",
		},
	},
};
