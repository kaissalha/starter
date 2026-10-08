import type { Meta, StoryObj } from "@storybook/react-vite";

import { headerBasicSection } from "../../sections/header/header-basic";
import { headerDetachedTransparentSection } from "../../sections/header/header-detached-transparent";
import { headerFlushTransparentSection } from "../../sections/header/header-flush-transparent";
import { headerMarketerSection } from "../../sections/header/header-marketer";
import { headerPillNavSection } from "../../sections/header/header-pill-nav";
import headerBasicSectionFixtures from "../fixtures/sections/header/header-basic.json";
import headerDetachedTransparentSectionFixtures from "../fixtures/sections/header/header-detached-transparent.json";
import headerFlushTransparentSectionFixtures from "../fixtures/sections/header/header-flush-transparent.json";
import headerMarketerSectionFixtures from "../fixtures/sections/header/header-marketer.json";
import headerPillNavSectionFixtures from "../fixtures/sections/header/header-pill-nav.json";
import { SectionStoryPreview } from "../section-story-preview";

const meta = {
	component: SectionStoryPreview,
	parameters: { controls: { disable: true }, layout: "fullscreen" },
	title: "Sections/Header",
} satisfies Meta<typeof SectionStoryPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const HeaderBasic: Story = {
	args: { definition: headerBasicSection, fixtures: headerBasicSectionFixtures },
};

export const HeaderDetachedTransparent: Story = {
	args: { definition: headerDetachedTransparentSection, fixtures: headerDetachedTransparentSectionFixtures },
};

export const HeaderFlushTransparent: Story = {
	args: { definition: headerFlushTransparentSection, fixtures: headerFlushTransparentSectionFixtures },
};

export const HeaderMarketer: Story = {
	args: { definition: headerMarketerSection, fixtures: headerMarketerSectionFixtures },
};

export const HeaderPillNav: Story = {
	args: { definition: headerPillNavSection, fixtures: headerPillNavSectionFixtures },
};
