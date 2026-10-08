import type { Meta, StoryObj } from "@storybook/react-vite";

import { professionalStructureTemplate } from ".";
import { getTemplateStoryBrandArgs } from "../../storybook/fixtures/template-brands";
import { templateStoryMeta } from "../../storybook/template-story-controls";
import { professionalStructureAssets } from "./assets";
import content from "./content.json";

const meta = {
	title: "Templates/ProfessionalStructure",
	...templateStoryMeta,
	args: {
		...getTemplateStoryBrandArgs({ templateId: "professional-structure" }),
		assets: professionalStructureAssets,
		content,
		definition: professionalStructureTemplate,
	},
} satisfies Meta<(typeof templateStoryMeta)["component"]>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
