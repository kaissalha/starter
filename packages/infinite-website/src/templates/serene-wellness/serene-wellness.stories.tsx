import type { Meta, StoryObj } from "@storybook/react-vite";

import { sereneWellnessTemplate } from ".";
import { getTemplateStoryBrandArgs } from "../../storybook/fixtures/template-brands";
import { templateStoryMeta } from "../../storybook/template-story-controls";
import { sereneWellnessAssets } from "./assets";
import content from "./content.json";

const meta = {
	title: "Templates/SereneWellness",
	...templateStoryMeta,
	args: {
		...getTemplateStoryBrandArgs({ templateId: "serene-wellness" }),
		assets: sereneWellnessAssets,
		content,
		definition: sereneWellnessTemplate,
	},
} satisfies Meta<(typeof templateStoryMeta)["component"]>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
