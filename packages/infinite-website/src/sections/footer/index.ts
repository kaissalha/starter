import type { SectionDefinition } from "../section-definition";
import { footerContactSplitSection } from "./footer-contact-split";
import { footerDetachedSection } from "./footer-detached";
import { footerEditorialSplitSection } from "./footer-editorial-split";
import { footerInfoGridSection } from "./footer-info-grid";
import { footerLogoHighlightSection } from "./footer-logo-highlight";
import { footerLogoNavSection } from "./footer-logo-nav";
import { footerPillNavSection } from "./footer-pill-nav";
import { footerSplitImageSection } from "./footer-split-image";

export const footerSections: Array<SectionDefinition> = [
	footerContactSplitSection,
	footerLogoNavSection,
	footerLogoHighlightSection,
	footerInfoGridSection,
	footerPillNavSection,
	footerDetachedSection,
	footerEditorialSplitSection,
	footerSplitImageSection,
];
