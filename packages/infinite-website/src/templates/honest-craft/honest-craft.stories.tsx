import type { Meta, StoryObj } from "@storybook/react-vite";

import { honestCraftTemplate } from ".";
import { getTemplateStoryBrandArgs } from "../../storybook/fixtures/template-brands";
import { templateStoryMeta } from "../../storybook/template-story-controls";
import { honestCraftAssets } from "./assets";
import content from "./content.json";

const meta = {
	title: "Templates/HonestCraft",
	...templateStoryMeta,
	args: {
		...getTemplateStoryBrandArgs({ templateId: "honest-craft" }),
		assets: honestCraftAssets,
		content,
		definition: honestCraftTemplate,
	},
} satisfies Meta<(typeof templateStoryMeta)["component"]>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
