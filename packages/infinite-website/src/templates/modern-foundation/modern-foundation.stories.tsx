import type { Meta, StoryObj } from "@storybook/react-vite";

import { modernFoundationTemplate } from ".";
import { getTemplateStoryBrandArgs } from "../../storybook/fixtures/template-brands";
import { templateStoryMeta } from "../../storybook/template-story-controls";
import { modernFoundationAssets } from "./assets";
import content from "./content.json";

const meta = {
	title: "Templates/ModernFoundation",
	...templateStoryMeta,
	args: {
		...getTemplateStoryBrandArgs({ templateId: "modern-foundation" }),
		assets: modernFoundationAssets,
		content,
		definition: modernFoundationTemplate,
	},
} satisfies Meta<(typeof templateStoryMeta)["component"]>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
