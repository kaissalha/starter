import type { Meta, StoryObj } from "@storybook/react-vite";

import { trueExposureTemplate } from ".";
import { getTemplateStoryBrandArgs } from "../../storybook/fixtures/template-brands";
import { templateStoryMeta } from "../../storybook/template-story-controls";
import { trueExposureAssets } from "./assets";
import content from "./content.json";

const meta = {
	title: "Templates/TrueExposure",
	...templateStoryMeta,
	args: {
		...getTemplateStoryBrandArgs({ templateId: "true-exposure" }),
		assets: trueExposureAssets,
		content,
		definition: trueExposureTemplate,
	},
} satisfies Meta<(typeof templateStoryMeta)["component"]>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
