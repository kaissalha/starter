import type { Meta, StoryObj } from "@storybook/react-vite";

import { reliableCoreTemplate } from ".";
import { getTemplateStoryBrandArgs } from "../../storybook/fixtures/template-brands";
import { templateStoryMeta } from "../../storybook/template-story-controls";
import { reliableCoreAssets } from "./assets";
import content from "./content.json";

const meta = {
	title: "Templates/ReliableCore",
	...templateStoryMeta,
	args: {
		...getTemplateStoryBrandArgs({ templateId: "reliable-core" }),
		assets: reliableCoreAssets,
		content,
		definition: reliableCoreTemplate,
	},
} satisfies Meta<(typeof templateStoryMeta)["component"]>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
