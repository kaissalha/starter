import type { Meta, StoryObj } from "@storybook/react-vite";

import { pawVoyageTemplate } from ".";
import { getTemplateStoryBrandArgs } from "../../storybook/fixtures/template-brands";
import { templateStoryMeta } from "../../storybook/template-story-controls";
import { pawVoyageAssets } from "./assets";
import content from "./content.json";

const meta = {
	title: "Templates/PawVoyage",
	...templateStoryMeta,
	args: {
		...getTemplateStoryBrandArgs({ templateId: "paw-voyage" }),
		assets: pawVoyageAssets,
		content,
		definition: pawVoyageTemplate,
	},
} satisfies Meta<(typeof templateStoryMeta)["component"]>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
