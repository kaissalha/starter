import type { SectionDefinition } from "../section-definition";
import { pricingEditorialBorderedSection } from "./pricing-editorial-bordered";
import { pricingEditorialHighlightSection } from "./pricing-editorial-highlight";
import { pricingTableSection } from "./pricing-table";
import { pricingTable2Section } from "./pricing-table-2";
import { pricingTable3Section } from "./pricing-table-3";

export const pricingSections: Array<SectionDefinition> = [
	pricingEditorialBorderedSection,
	pricingEditorialHighlightSection,
	pricingTableSection,
	pricingTable2Section,
	pricingTable3Section,
];
