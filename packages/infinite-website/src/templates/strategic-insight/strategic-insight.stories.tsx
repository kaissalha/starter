import type { Meta, StoryObj } from "@storybook/react-vite";

import { strategicInsightTemplate } from ".";
import { getTemplateStoryBrandArgs } from "../../storybook/fixtures/template-brands";
import { templateStoryMeta } from "../../storybook/template-story-controls";
import { strategicInsightAssets } from "./assets";
import content from "./content.json";

const meta = {
	title: "Templates/StrategicInsight",
	...templateStoryMeta,
	args: {
		...getTemplateStoryBrandArgs({ templateId: "strategic-insight" }),
		assets: strategicInsightAssets,
		content,
		definition: strategicInsightTemplate,
	},
} satisfies Meta<(typeof templateStoryMeta)["component"]>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
