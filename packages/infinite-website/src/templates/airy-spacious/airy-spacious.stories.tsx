import type { Meta, StoryObj } from "@storybook/react-vite";

import { airySpaciousTemplate } from ".";
import { getTemplateStoryBrandArgs } from "../../storybook/fixtures/template-brands";
import { templateStoryMeta } from "../../storybook/template-story-controls";
import { airySpaciousAssets } from "./assets";
import content from "./content.json";

const meta = {
	title: "Templates/AirySpacious",
	...templateStoryMeta,
	args: {
		...getTemplateStoryBrandArgs({ templateId: "airy-spacious" }),
		assets: airySpaciousAssets,
		content,
		definition: airySpaciousTemplate,
	},
} satisfies Meta<(typeof templateStoryMeta)["component"]>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
