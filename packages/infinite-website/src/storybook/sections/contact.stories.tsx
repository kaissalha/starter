import type { Meta, StoryObj } from "@storybook/react-vite";

import { contactEditorialBorderedSection } from "../../sections/contact/contact-editorial-bordered";
import { contactEditorialSplitSection } from "../../sections/contact/contact-editorial-split";
import { contactFormSection } from "../../sections/contact/contact-form";
import { contactFormCardSection } from "../../sections/contact/contact-form-card";
import { contactFormImageSection } from "../../sections/contact/contact-form-image";
import { contactFormLinksSection } from "../../sections/contact/contact-form-links";
import { contactFormMapSection } from "../../sections/contact/contact-form-map";
import { contactFormTextSection } from "../../sections/contact/contact-form-text";
import { contactFormWatermarkSection } from "../../sections/contact/contact-form-watermark";
import { contactImageLinksSection } from "../../sections/contact/contact-image-links";
import contactEditorialBorderedSectionFixtures from "../fixtures/sections/contact/contact-editorial-bordered.json";
import contactEditorialSplitSectionFixtures from "../fixtures/sections/contact/contact-editorial-split.json";
import contactFormCardFixtures from "../fixtures/sections/contact/contact-form-card.json";
import contactFormImageFixtures from "../fixtures/sections/contact/contact-form-image.json";
import contactFormLinksFixtures from "../fixtures/sections/contact/contact-form-links.json";
import contactFormMapFixtures from "../fixtures/sections/contact/contact-form-map.json";
import contactFormTextFixtures from "../fixtures/sections/contact/contact-form-text.json";
import contactFormWatermarkFixtures from "../fixtures/sections/contact/contact-form-watermark.json";
import contactFormFixtures from "../fixtures/sections/contact/contact-form.json";
import contactImageLinksFixtures from "../fixtures/sections/contact/contact-image-links.json";
import { SectionStoryPreview } from "../section-story-preview";

const meta = {
	component: SectionStoryPreview,
	parameters: { controls: { disable: true }, layout: "fullscreen" },
	title: "Sections/Contact",
} satisfies Meta<typeof SectionStoryPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ContactEditorialSplit: Story = {
	args: { definition: contactEditorialSplitSection, fixtures: contactEditorialSplitSectionFixtures },
};

export const ContactForm: Story = { args: { definition: contactFormSection, fixtures: contactFormFixtures } };

export const ContactEditorialBordered: Story = {
	args: { definition: contactEditorialBorderedSection, fixtures: contactEditorialBorderedSectionFixtures },
};

export const ContactFormCard: Story = {
	args: { definition: contactFormCardSection, fixtures: contactFormCardFixtures },
};

export const ContactFormImage: Story = {
	args: { definition: contactFormImageSection, fixtures: contactFormImageFixtures },
};

export const ContactFormLinks: Story = {
	args: { definition: contactFormLinksSection, fixtures: contactFormLinksFixtures },
};

export const ContactFormMap: Story = { args: { definition: contactFormMapSection, fixtures: contactFormMapFixtures } };

export const ContactFormText: Story = {
	args: { definition: contactFormTextSection, fixtures: contactFormTextFixtures },
};

export const ContactFormWatermark: Story = {
	args: { definition: contactFormWatermarkSection, fixtures: contactFormWatermarkFixtures },
};

export const ContactImageLinks: Story = {
	args: { definition: contactImageLinksSection, fixtures: contactImageLinksFixtures },
};
