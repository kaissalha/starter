import type { Meta, StoryObj } from "@storybook/react-vite";

import { artisanCraftTemplate } from ".";
import { getTemplateStoryBrandArgs } from "../../storybook/fixtures/template-brands";
import { templateStoryMeta } from "../../storybook/template-story-controls";
import { artisanCraftAssets } from "./assets";
import content from "./content.json";

const meta = {
	title: "Templates/ArtisanCraft",
	...templateStoryMeta,
	args: {
		...getTemplateStoryBrandArgs({ templateId: "artisan-craft" }),
		assets: artisanCraftAssets,
		content,
		definition: artisanCraftTemplate,
	},
} satisfies Meta<(typeof templateStoryMeta)["component"]>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
