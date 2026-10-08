import { resolveSectionContentReference } from "../document/content-schema";
import type { SiteDocument } from "../document/site-document-schema";
import type { SiteSection } from "../document/structure-schema";
import type { Iso6391LanguageCode } from "../language-codes";
import type { SiteLinkComponent } from "../primitives/shared";
import type { BlogPostSummary } from "./blog-contracts";
import { BlogPostGrid } from "./blog-renderer";

const textSchema = z.string();

export const BlogFeedSection = ({
	basePath,
	document,
	linkComponent,
	locale,
	posts = [],
	preview,
	section,
	textElementProps,
}: {
	basePath?: string;
	document: SiteDocument;
	linkComponent: SiteLinkComponent;
	locale: Iso6391LanguageCode;
	posts?: Array<BlogPostSummary>;
	preview?: boolean;
	section: SiteSection;
	textElementProps?: SiteTextElementPropsResolver;
}) => {
	if (!posts.length && !preview) {
		return null;
	}

	const heading = resolveSectionContentReference({
		content: document.content,
		contentId: section.contentId,
		defaultLocale: document.defaultLocale,
		locale,
		reference: { $text: "/copy/heading" },
	});

	const empty = resolveSectionContentReference({
		content: document.content,
		contentId: section.contentId,
		defaultLocale: document.defaultLocale,
		locale,
		reference: { $text: "/copy/empty" },
	});

	const headingNode = section.root.props.children?.find((node) => node.type === "text");

	const headingProps =
		headingNode && textElementProps
			? textElementProps({
					content: textSchema.parse(heading),
					contentId: section.contentId,
					linkLabel: false,
					locale,
					nodeId: headingNode.id,
					pointer: "/copy/heading",
					sectionId: section.id,
				})
			: undefined;

	return (
		<section
			className='bg-[var(--surface-canvas)] px-6 py-16 font-[family-name:var(--website-font-body)] text-[var(--foreground-primary)]'
			data-section-id={section.id}
			data-website-anchor={section.anchor}
			id={section.id}
		>
			<div className='mx-auto max-w-6xl'>
				<h2
					{...headingProps}
					className='mb-8 font-[family-name:var(--website-font-brand)] text-3xl font-semibold'
				>
					{textSchema.parse(heading)}
				</h2>
				{posts.length ? (
					<BlogPostGrid
						basePath={basePath}
						linkComponent={linkComponent}
						locale={locale}
						posts={posts.slice(0, section.source?.pattern === "blog-latest-six" ? 6 : 3)}
					/>
				) : (
					<p className='rounded-[var(--website-radius)] border border-dashed border-[var(--border-subtle)] p-10 text-center text-[var(--foreground-muted)]'>
						{textSchema.parse(empty)}
					</p>
				)}
			</div>
		</section>
	);
};

import { z } from "zod";

import type { SiteTextElementPropsResolver } from "../rendering/render-node";
