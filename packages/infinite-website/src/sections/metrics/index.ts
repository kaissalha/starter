import type { SectionDefinition } from "../section-definition";
import { metricsBasicSection } from "./metrics-basic";
import { metricsBigNumbersSection } from "./metrics-big-numbers";
import { metricsCardGridSection } from "./metrics-card-grid";
import { metricsCardHighlightSection } from "./metrics-card-highlight";
import { metricsEditorialBorderedSection } from "./metrics-editorial-bordered";
import { metricsEditorialSplitSection } from "./metrics-editorial-split";
import { metricsNumbersSection } from "./metrics-numbers";

export const metricsSections: Array<SectionDefinition> = [
	metricsBasicSection,
	metricsBigNumbersSection,
	metricsCardGridSection,
	metricsCardHighlightSection,
	metricsNumbersSection,
	metricsEditorialBorderedSection,
	metricsEditorialSplitSection,
];
