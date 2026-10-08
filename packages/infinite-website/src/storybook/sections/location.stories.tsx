import type { Meta, StoryObj } from "@storybook/react-vite";

import { locationBusinessHoursSection } from "../../sections/location/location-business-hours";
import { locationCardSection } from "../../sections/location/location-card";
import { locationEditorialMapSection } from "../../sections/location/location-editorial-map";
import { locationMapSection } from "../../sections/location/location-map";
import { locationTextAndMapSection } from "../../sections/location/location-text-and-map";
import locationBusinessHoursFixtures from "../fixtures/sections/location/location-business-hours.json";
import locationCardSectionFixtures from "../fixtures/sections/location/location-card.json";
import locationEditorialMapFixtures from "../fixtures/sections/location/location-editorial-map.json";
import locationMapFixtures from "../fixtures/sections/location/location-map.json";
import locationTextAndMapFixtures from "../fixtures/sections/location/location-text-and-map.json";
import { SectionStoryPreview } from "../section-story-preview";

const meta = {
	component: SectionStoryPreview,
	parameters: { controls: { disable: true }, layout: "fullscreen" },
	title: "Sections/Location",
} satisfies Meta<typeof SectionStoryPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LocationCard: Story = { args: { definition: locationCardSection, fixtures: locationCardSectionFixtures } };

export const LocationBusinessHours: Story = {
	args: { definition: locationBusinessHoursSection, fixtures: locationBusinessHoursFixtures },
};

export const LocationEditorialMap: Story = {
	args: { definition: locationEditorialMapSection, fixtures: locationEditorialMapFixtures },
};

export const LocationMap: Story = { args: { definition: locationMapSection, fixtures: locationMapFixtures } };

export const LocationTextAndMap: Story = {
	args: { definition: locationTextAndMapSection, fixtures: locationTextAndMapFixtures },
};
