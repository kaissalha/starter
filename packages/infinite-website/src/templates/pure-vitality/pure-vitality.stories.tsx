import type { Meta, StoryObj } from "@storybook/react-vite";

import { pureVitalityTemplate } from ".";
import { getTemplateStoryBrandArgs } from "../../storybook/fixtures/template-brands";
import { templateStoryMeta } from "../../storybook/template-story-controls";
import { pureVitalityAssets } from "./assets";
import content from "./content.json";

const meta = {
	title: "Templates/PureVitality",
	...templateStoryMeta,
	args: {
		...getTemplateStoryBrandArgs({ templateId: "pure-vitality" }),
		assets: pureVitalityAssets,
		content,
		definition: pureVitalityTemplate,
	},
} satisfies Meta<(typeof templateStoryMeta)["component"]>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		fontPairing: "minimal",
	},
};
