import type { SectionDefinition } from "../section-definition";
import { headerBasicSection } from "./header-basic";
import { headerDetachedTransparentSection } from "./header-detached-transparent";
import { headerFlushTransparentSection } from "./header-flush-transparent";
import { headerMarketerSection } from "./header-marketer";
import { headerPillNavSection } from "./header-pill-nav";

export const headerSections: Array<SectionDefinition> = [
	headerBasicSection,
	headerDetachedTransparentSection,
	headerFlushTransparentSection,
	headerMarketerSection,
	headerPillNavSection,
];
