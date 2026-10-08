import type { Meta, StoryObj } from "@storybook/react-vite";

import { sharpSignalTemplate } from ".";
import { getTemplateStoryBrandArgs } from "../../storybook/fixtures/template-brands";
import { templateStoryMeta } from "../../storybook/template-story-controls";
import { sharpSignalAssets } from "./assets";
import content from "./content.json";

const meta = {
	title: "Templates/SharpSignal",
	...templateStoryMeta,
	args: {
		...getTemplateStoryBrandArgs({ templateId: "sharp-signal" }),
		assets: sharpSignalAssets,
		content,
		definition: sharpSignalTemplate,
	},
} satisfies Meta<(typeof templateStoryMeta)["component"]>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
