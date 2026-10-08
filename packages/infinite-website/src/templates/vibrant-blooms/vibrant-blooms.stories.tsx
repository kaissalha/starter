import type { Meta, StoryObj } from "@storybook/react-vite";

import { vibrantBloomsTemplate } from ".";
import { getTemplateStoryBrandArgs } from "../../storybook/fixtures/template-brands";
import { templateStoryMeta } from "../../storybook/template-story-controls";
import { vibrantBloomsAssets } from "./assets";
import content from "./content.json";

const meta = {
	title: "Templates/VibrantBlooms",
	...templateStoryMeta,
	args: {
		...getTemplateStoryBrandArgs({ templateId: "vibrant-blooms" }),
		assets: vibrantBloomsAssets,
		content,
		definition: vibrantBloomsTemplate,
	},
} satisfies Meta<(typeof templateStoryMeta)["component"]>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
