import type { Meta, StoryObj } from "@storybook/react-vite";

import { urbanEdgeTemplate } from ".";
import { getTemplateStoryBrandArgs } from "../../storybook/fixtures/template-brands";
import { templateStoryMeta } from "../../storybook/template-story-controls";
import { urbanEdgeAssets } from "./assets";
import content from "./content.json";

const meta = {
	title: "Templates/UrbanEdge",
	...templateStoryMeta,
	args: {
		...getTemplateStoryBrandArgs({ templateId: "urban-edge" }),
		assets: urbanEdgeAssets,
		content,
		definition: urbanEdgeTemplate,
	},
} satisfies Meta<(typeof templateStoryMeta)["component"]>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
