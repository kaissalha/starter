import type { Meta, StoryObj } from "@storybook/react-vite";

import { steadyAscentTemplate } from ".";
import { getTemplateStoryBrandArgs } from "../../storybook/fixtures/template-brands";
import { templateStoryMeta } from "../../storybook/template-story-controls";
import { steadyAscentAssets } from "./assets";
import content from "./content.json";

const meta = {
	title: "Templates/SteadyAscent",
	...templateStoryMeta,
	args: {
		...getTemplateStoryBrandArgs({ templateId: "steady-ascent" }),
		assets: steadyAscentAssets,
		content,
		definition: steadyAscentTemplate,
	},
} satisfies Meta<(typeof templateStoryMeta)["component"]>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
