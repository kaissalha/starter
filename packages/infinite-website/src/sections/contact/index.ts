import type { SectionDefinition } from "../section-definition";
import { contactEditorialBorderedSection } from "./contact-editorial-bordered";
import { contactEditorialSplitSection } from "./contact-editorial-split";
import { contactFormSection } from "./contact-form";
import { contactFormCardSection } from "./contact-form-card";
import { contactFormImageSection } from "./contact-form-image";
import { contactFormLinksSection } from "./contact-form-links";
import { contactFormMapSection } from "./contact-form-map";
import { contactFormTextSection } from "./contact-form-text";
import { contactFormWatermarkSection } from "./contact-form-watermark";
import { contactImageLinksSection } from "./contact-image-links";

export const contactSections: Array<SectionDefinition> = [
	contactEditorialSplitSection,
	contactEditorialBorderedSection,
	contactFormSection,
	contactFormCardSection,
	contactFormImageSection,
	contactFormLinksSection,
	contactFormMapSection,
	contactFormTextSection,
	contactFormWatermarkSection,
	contactImageLinksSection,
];
