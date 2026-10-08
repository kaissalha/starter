import type { Meta, StoryObj } from "@storybook/react-vite";

import { alpinaVenturesTemplate } from ".";
import { getTemplateStoryBrandArgs } from "../../storybook/fixtures/template-brands";
import { templateStoryMeta } from "../../storybook/template-story-controls";
import { alpinaVenturesAssets } from "./assets";
import content from "./content.json";

const meta = {
	title: "Templates/AlpinaVentures",
	...templateStoryMeta,
	args: {
		...getTemplateStoryBrandArgs({ templateId: "alpina-ventures" }),
		assets: alpinaVenturesAssets,
		content,
		definition: alpinaVenturesTemplate,
	},
} satisfies Meta<(typeof templateStoryMeta)["component"]>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
