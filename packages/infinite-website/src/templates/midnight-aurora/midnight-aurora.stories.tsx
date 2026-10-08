import type { Meta, StoryObj } from "@storybook/react-vite";

import { midnightAuroraTemplate } from ".";
import { getTemplateStoryBrandArgs } from "../../storybook/fixtures/template-brands";
import { templateStoryMeta } from "../../storybook/template-story-controls";
import { midnightAuroraAssets } from "./assets";
import content from "./content.json";

const meta = {
	title: "Templates/MidnightAurora",
	...templateStoryMeta,
	args: {
		...getTemplateStoryBrandArgs({ templateId: "midnight-aurora" }),
		assets: midnightAuroraAssets,
		content,
		definition: midnightAuroraTemplate,
	},
} satisfies Meta<(typeof templateStoryMeta)["component"]>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
