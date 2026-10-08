import type { Meta, StoryObj } from "@storybook/react-vite";

import { sparkleHomeTemplate } from ".";
import { getTemplateStoryBrandArgs } from "../../storybook/fixtures/template-brands";
import { templateStoryMeta } from "../../storybook/template-story-controls";
import { sparkleHomeAssets } from "./assets";
import content from "./content.json";

const meta = {
	title: "Templates/SparkleHome",
	...templateStoryMeta,
	args: {
		...getTemplateStoryBrandArgs({ templateId: "sparkle-home" }),
		assets: sparkleHomeAssets,
		content,
		definition: sparkleHomeTemplate,
	},
} satisfies Meta<(typeof templateStoryMeta)["component"]>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		fontPairing: "minimal",
	},
};
