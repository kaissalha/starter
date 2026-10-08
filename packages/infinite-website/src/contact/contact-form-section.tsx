import type { ComponentType } from "react";

import { resolveSectionContentReference } from "../document/content-schema";
import type { SiteDocument } from "../document/site-document-schema";
import type { SiteSection } from "../document/structure-schema";
import type { Iso6391LanguageCode } from "../language-codes";
import type { SiteTextElementPropsResolver } from "../rendering/render-node";
import { ContactForm } from "./contact-form";
import { contactFormCopySchema, type ContactFormProps } from "./contact-form-contracts";

export const ContactFormSection = ({
	document,
	formComponent: Form = ContactForm,
	locale,
	preview,
	section,
	textElementProps,
}: {
	document: SiteDocument;
	formComponent?: ComponentType<ContactFormProps>;
	locale: Iso6391LanguageCode;
	preview?: boolean;
	section: SiteSection;
	textElementProps?: SiteTextElementPropsResolver;
}) => {
	const copy = contactFormCopySchema.parse(
		Object.fromEntries(
			contactFormCopySchema.keyof().options.map((key) => [
				key,
				resolveSectionContentReference({
					content: document.content,
					contentId: section.contentId,
					defaultLocale: document.defaultLocale,
					locale,
					reference: { $text: `/copy/${key}` },
				}),
			])
		)
	);

	const editableProps = (key: "heading" | "description") => {
		const node = section.root.props.children?.find(
			(child) => child.type === "text" && child.props.content.$text === `/copy/${key}`
		);

		return (
			node &&
			textElementProps?.({
				content: copy[key],
				contentId: section.contentId,
				linkLabel: false,
				locale,
				nodeId: node.id,
				pointer: `/copy/${key}`,
				sectionId: section.id,
			})
		);
	};

	return (
		<section
			className='@container bg-[var(--surface-canvas)] px-6 py-16 font-[family-name:var(--website-font-body)] text-[var(--foreground-primary)]'
			data-section-id={section.id}
			data-website-anchor={section.anchor}
			id={section.id}
		>
			<div className='mx-auto grid max-w-6xl gap-10 @3xl:grid-cols-2 @3xl:gap-20'>
				<div className='min-w-0'>
					<h2
						{...editableProps("heading")}
						className='text-balance font-[family-name:var(--website-font-brand)] text-4xl font-semibold tracking-tight'
					>
						{copy.heading}
					</h2>
					<p
						{...editableProps("description")}
						className='mt-5 max-w-lg text-pretty text-lg leading-relaxed text-[var(--foreground-muted)]'
					>
						{copy.description}
					</p>
				</div>
				<Form copy={copy} preview={preview} sectionId={section.id} />
			</div>
		</section>
	);
};
