import type { Meta, StoryObj } from "@storybook/react-vite";

import { nordicEdgeTemplate } from ".";
import { getTemplateStoryBrandArgs } from "../../storybook/fixtures/template-brands";
import { templateStoryMeta } from "../../storybook/template-story-controls";
import { nordicEdgeAssets } from "./assets";
import content from "./content.json";

const meta = {
	title: "Templates/NordicEdge",
	...templateStoryMeta,
	args: {
		...getTemplateStoryBrandArgs({ templateId: "nordic-edge" }),
		assets: nordicEdgeAssets,
		content,
		definition: nordicEdgeTemplate,
	},
} satisfies Meta<(typeof templateStoryMeta)["component"]>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
