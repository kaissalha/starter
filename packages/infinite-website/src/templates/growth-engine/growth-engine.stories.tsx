import type { Meta, StoryObj } from "@storybook/react-vite";

import { growthEngineTemplate } from ".";
import { getTemplateStoryBrandArgs } from "../../storybook/fixtures/template-brands";
import { templateStoryMeta } from "../../storybook/template-story-controls";
import { growthEngineAssets } from "./assets";
import content from "./content.json";

const meta = {
	title: "Templates/GrowthEngine",
	...templateStoryMeta,
	args: {
		...getTemplateStoryBrandArgs({ templateId: "growth-engine" }),
		assets: growthEngineAssets,
		content,
		definition: growthEngineTemplate,
	},
} satisfies Meta<(typeof templateStoryMeta)["component"]>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
