import type { SectionDefinition } from "../section-definition";
import { locationBusinessHoursSection } from "./location-business-hours";
import { locationCardSection } from "./location-card";
import { locationEditorialMapSection } from "./location-editorial-map";
import { locationMapSection } from "./location-map";
import { locationTextAndMapSection } from "./location-text-and-map";

export const locationSections: Array<SectionDefinition> = [
	locationCardSection,
	locationBusinessHoursSection,
	locationEditorialMapSection,
	locationMapSection,
	locationTextAndMapSection,
];

export { locationMapSection, locationTextAndMapSection };
