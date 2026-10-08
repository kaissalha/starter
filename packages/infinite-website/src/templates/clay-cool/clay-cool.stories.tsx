import type { Meta, StoryObj } from "@storybook/react-vite";

import { clayCoolTemplate } from ".";
import { getTemplateStoryBrandArgs } from "../../storybook/fixtures/template-brands";
import { templateStoryMeta } from "../../storybook/template-story-controls";
import { clayCoolAssets } from "./assets";
import content from "./content.json";

const meta = {
	title: "Templates/ClayCool",
	...templateStoryMeta,
	args: {
		...getTemplateStoryBrandArgs({ templateId: "clay-cool" }),
		assets: clayCoolAssets,
		content,
		definition: clayCoolTemplate,
	},
} satisfies Meta<(typeof templateStoryMeta)["component"]>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
