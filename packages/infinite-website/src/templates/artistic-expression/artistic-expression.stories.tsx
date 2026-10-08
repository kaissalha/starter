import type { Meta, StoryObj } from "@storybook/react-vite";

import { artisticExpressionTemplate } from ".";
import { getTemplateStoryBrandArgs } from "../../storybook/fixtures/template-brands";
import { templateStoryMeta } from "../../storybook/template-story-controls";
import { artisticExpressionAssets } from "./assets";
import content from "./content.json";

const meta = {
	title: "Templates/ArtisticExpression",
	...templateStoryMeta,
	args: {
		...getTemplateStoryBrandArgs({ templateId: "artistic-expression" }),
		assets: artisticExpressionAssets,
		content,
		definition: artisticExpressionTemplate,
	},
} satisfies Meta<(typeof templateStoryMeta)["component"]>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
