import type { Meta, StoryObj } from "@storybook/react-vite";

import { metricsBasicSection } from "../../sections/metrics/metrics-basic";
import { metricsBigNumbersSection } from "../../sections/metrics/metrics-big-numbers";
import { metricsCardGridSection } from "../../sections/metrics/metrics-card-grid";
import { metricsCardHighlightSection } from "../../sections/metrics/metrics-card-highlight";
import { metricsEditorialBorderedSection } from "../../sections/metrics/metrics-editorial-bordered";
import { metricsEditorialSplitSection } from "../../sections/metrics/metrics-editorial-split";
import { metricsNumbersSection } from "../../sections/metrics/metrics-numbers";
import metricsBasicSectionFixtures from "../fixtures/sections/metrics/metrics-basic.json";
import metricsBigNumbersSectionFixtures from "../fixtures/sections/metrics/metrics-big-numbers.json";
import metricsCardGridSectionFixtures from "../fixtures/sections/metrics/metrics-card-grid.json";
import metricsCardHighlightSectionFixtures from "../fixtures/sections/metrics/metrics-card-highlight.json";
import metricsEditorialBorderedSectionFixtures from "../fixtures/sections/metrics/metrics-editorial-bordered.json";
import metricsEditorialSplitSectionFixtures from "../fixtures/sections/metrics/metrics-editorial-split.json";
import metricsNumbersSectionFixtures from "../fixtures/sections/metrics/metrics-numbers.json";
import { SectionStoryPreview } from "../section-story-preview";

const meta = {
	component: SectionStoryPreview,
	parameters: { controls: { disable: true }, layout: "fullscreen" },
	title: "Sections/Metrics",
} satisfies Meta<typeof SectionStoryPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MetricsBasic: Story = { args: { definition: metricsBasicSection, fixtures: metricsBasicSectionFixtures } };

export const MetricsBigNumbers: Story = {
	args: { definition: metricsBigNumbersSection, fixtures: metricsBigNumbersSectionFixtures },
};

export const MetricsCardGrid: Story = {
	args: { definition: metricsCardGridSection, fixtures: metricsCardGridSectionFixtures },
};

export const MetricsCardHighlight: Story = {
	args: { definition: metricsCardHighlightSection, fixtures: metricsCardHighlightSectionFixtures },
};

export const MetricsNumbers: Story = {
	args: { definition: metricsNumbersSection, fixtures: metricsNumbersSectionFixtures },
};

export const MetricsEditorialBordered: Story = {
	args: { definition: metricsEditorialBorderedSection, fixtures: metricsEditorialBorderedSectionFixtures },
};

export const MetricsEditorialSplit: Story = {
	args: { definition: metricsEditorialSplitSection, fixtures: metricsEditorialSplitSectionFixtures },
};
