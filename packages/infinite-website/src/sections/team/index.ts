import type { SectionDefinition } from "../section-definition";
import { teamEditorialGridSection } from "./team-editorial-grid";
import { teamGridSection } from "./team-grid";
import { teamGridColumnsSection } from "./team-grid-columns";
import { teamPortraitGridSection } from "./team-portrait-grid";
import { teamStaggeredSection } from "./team-staggered";

export const teamSections: Array<SectionDefinition> = [
	teamEditorialGridSection,
	teamGridSection,
	teamGridColumnsSection,
	teamPortraitGridSection,
	teamStaggeredSection,
];
