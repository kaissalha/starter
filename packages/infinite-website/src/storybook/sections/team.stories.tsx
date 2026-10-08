import type { Meta, StoryObj } from "@storybook/react-vite";

import { teamEditorialGridSection } from "../../sections/team/team-editorial-grid";
import { teamGridSection } from "../../sections/team/team-grid";
import { teamGridColumnsSection } from "../../sections/team/team-grid-columns";
import { teamPortraitGridSection } from "../../sections/team/team-portrait-grid";
import { teamStaggeredSection } from "../../sections/team/team-staggered";
import teamEditorialGridSectionFixtures from "../fixtures/sections/team/team-editorial-grid.json";
import teamGridColumnsSectionFixtures from "../fixtures/sections/team/team-grid-columns.json";
import teamGridSectionFixtures from "../fixtures/sections/team/team-grid.json";
import teamPortraitGridSectionFixtures from "../fixtures/sections/team/team-portrait-grid.json";
import teamStaggeredSectionFixtures from "../fixtures/sections/team/team-staggered.json";
import { SectionStoryPreview } from "../section-story-preview";

const meta = {
	component: SectionStoryPreview,
	parameters: { controls: { disable: true }, layout: "fullscreen" },
	title: "Sections/Team",
} satisfies Meta<typeof SectionStoryPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TeamEditorialGrid: Story = {
	args: { definition: teamEditorialGridSection, fixtures: teamEditorialGridSectionFixtures },
};

export const TeamGrid: Story = { args: { definition: teamGridSection, fixtures: teamGridSectionFixtures } };

export const TeamGridColumns: Story = {
	args: { definition: teamGridColumnsSection, fixtures: teamGridColumnsSectionFixtures },
};

export const TeamPortraitGrid: Story = {
	args: { definition: teamPortraitGridSection, fixtures: teamPortraitGridSectionFixtures },
};

export const TeamStaggered: Story = {
	args: { definition: teamStaggeredSection, fixtures: teamStaggeredSectionFixtures },
};
