import type { Meta, StoryObj } from "@storybook/react-vite";

import { heritageDriveTemplate } from ".";
import { getTemplateStoryBrandArgs } from "../../storybook/fixtures/template-brands";
import { templateStoryMeta } from "../../storybook/template-story-controls";
import { heritageDriveAssets } from "./assets";
import content from "./content.json";

const meta = {
	title: "Templates/HeritageDrive",
	...templateStoryMeta,
	args: {
		...getTemplateStoryBrandArgs({ templateId: "heritage-drive" }),
		assets: heritageDriveAssets,
		content,
		definition: heritageDriveTemplate,
	},
} satisfies Meta<(typeof templateStoryMeta)["component"]>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
