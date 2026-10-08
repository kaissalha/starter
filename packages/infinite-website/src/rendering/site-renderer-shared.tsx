import type { ComponentProps, ComponentType, ReactNode } from "react";

import { DirectionProvider } from "@base-ui/react/direction-provider";
import { z } from "zod";

import { BehaviorRuntimeBoundary } from "../behavior/runtime";
import type { BlogPostSummary } from "../blog/blog-contracts";
import { BlogFeedSection } from "../blog/blog-feed-section";
import { BlogLayoutPosts, blogLayoutPatterns } from "../blog/blog-layout-posts";
import { projectBrandToWebsiteTheme } from "../brand/brand-projection";
import type { ContactFormProps } from "../contact/contact-form-contracts";
import { ContactFormSection } from "../contact/contact-form-section";
import { linkValueSchema, resolveSectionContentReference } from "../document/content-schema";
import {
	listSectionDisclosureItemReferences,
	listSectionLinkElementReferences,
	listSectionMediaNodeReferences,
	listSectionTextNodeReferences,
	isBusinessNameContentPointer,
} from "../document/section-content-references";
import type { SiteDocument } from "../document/site-document-schema";
import type { SiteSection } from "../document/structure-schema";
import type { Iso6391LanguageCode } from "../language-codes";
import type { SiteLinkComponent } from "../primitives/shared";
import { themeToCssVariables } from "../theme";
import {
	RenderNode,
	type AssetMap,
	type SiteDisclosureItemControlsResolver,
	type SiteLinkElementPropsResolver,
	type SiteTextElementPropsResolver,
	type SiteMediaControlsResolver,
	type SiteLogo,
} from "./render-node";
import { resolvePersistedNode, type SiteResolutionContext } from "./resolve-persisted-node";

const stringSchema = z.compile(z.string());

export const inFlowHeader = (section: SiteSection): SiteSection =>
	section.root.layout?.position === "absolute"
		? {
				...section,
				root: { ...section.root, layout: { ...section.root.layout, inset: undefined, position: "relative" } },
			}
		: section;

export const SiteRendererRoot = ({
	children,
	direction,
	locale,
	theme,
}: {
	children: ReactNode;
	direction: "ltr" | "rtl";
	locale: Iso6391LanguageCode;
	theme: ReturnType<typeof projectBrandToWebsiteTheme>;
}) => (
	<DirectionProvider direction={direction}>
		<div className='website-container' dir={direction} lang={locale} style={themeToCssVariables({ locale, theme })}>
			{children}
		</div>
	</DirectionProvider>
);

const resolveLinkTargets = ({
	document,
	linkReferences,
	locale,
	section,
}: {
	document: SiteDocument;
	linkReferences: ReturnType<typeof listSectionLinkElementReferences>;
	locale: Iso6391LanguageCode;
	section: SiteSection;
}) =>
	linkReferences.map(({ elementId, elementType, labels, menuItemId, menuRole, pointer }) => ({
		contentId: section.contentId,
		elementId,
		elementType,
		labels: labels.map((label) => ({
			...label,
			content: stringSchema.parse(
				resolveSectionContentReference({
					content: document.content,
					contentId: section.contentId,
					defaultLocale: document.defaultLocale,
					locale,
					reference: { $text: label.pointer },
				})
			),
		})),
		locale,
		menuItemId,
		menuRole,
		pointer,
		sectionId: section.id,
		value: linkValueSchema.parse(
			resolveSectionContentReference({
				content: document.content,
				contentId: section.contentId,
				defaultLocale: document.defaultLocale,
				locale,
				reference: { $link: pointer },
			})
		),
	}));

const createMenuItemsById = ({ resolvedLinkTargets }: { resolvedLinkTargets: ReturnType<typeof resolveLinkTargets> }) =>
	new Map(
		resolvedLinkTargets.flatMap((target) => {
			if (target.menuItemId !== target.elementId || target.menuRole === "dropdown-item") {
				return [];
			}

			return [
				[
					target.elementId,
					{
						elementId: target.elementId,
						items: resolvedLinkTargets
							.filter(
								(candidate) =>
									candidate.menuItemId === target.elementId && candidate.menuRole === "dropdown-item"
							)
							.map(({ elementId, labels, pointer, value }) => ({ elementId, labels, pointer, value })),
						labels: target.labels,
						locale: target.locale,
						pointer: target.pointer,
						sectionId: target.sectionId,
						value: target.value,
					},
				] as const,
			];
		})
	);

const createDisclosureItemTargets = ({
	disclosureBounds,
	section,
}: {
	disclosureBounds?: ReadonlyMap<string, { max: number; min: number }>;
	section: SiteSection;
}) =>
	new Map(
		listSectionDisclosureItemReferences({ node: section.root }).flatMap((target) => {
			const bounds = disclosureBounds?.get(target.collection);

			return bounds ? [[target.itemId, { ...target, ...bounds, sectionId: section.id }]] : [];
		})
	);

const createMediaControls = ({
	mediaControls,
	section,
}: {
	mediaControls: SiteMediaControlsResolver;
	section: SiteSection;
}): ComponentProps<typeof RenderNode>["mediaControls"] => {
	const mediaTargets = new Map(
		listSectionMediaNodeReferences({ node: section.root }).map((target) => [target.nodeId, target.pointer])
	);

	return (node) => {
		const pointer = mediaTargets.get(node.id);

		return pointer
			? mediaControls({ alt: node.props.alt, assetId: node.props.assetId, pointer, sectionId: section.id })
			: null;
	};
};

const listBusinessNameTextIds = ({ section }: { section: SiteSection }) =>
	new Set(
		listSectionTextNodeReferences({ node: section.root })
			.filter(({ pointer }) => isBusinessNameContentPointer(pointer))
			.map(({ nodeId }) => nodeId)
	);

const SectionBlogLayoutPosts = ({
	basePath,
	document,
	linkComponent,
	locale,
	pattern,
	posts,
	section,
}: {
	basePath: string | undefined;
	document: SiteDocument;
	linkComponent: SiteLinkComponent;
	locale: Iso6391LanguageCode;
	pattern: (typeof blogLayoutPatterns)[number];
	posts: Array<BlogPostSummary>;
	section: SiteSection;
}) => (
	<BlogLayoutPosts
		basePath={basePath}
		empty={stringSchema.parse(
			resolveSectionContentReference({
				content: document.content,
				contentId: section.contentId,
				defaultLocale: document.defaultLocale,
				locale,
				reference: { $text: "/copy/empty" },
			})
		)}
		linkComponent={linkComponent}
		locale={locale}
		pattern={pattern}
		posts={posts}
	/>
);

export const RenderedSection = ({
	assets,
	blogPosts,
	contactFormComponent,
	context,
	disclosureBounds,
	disclosureItemControls,
	document,
	linkComponent,
	linkElementProps,
	locale,
	logo,
	mediaControls,
	preview,
	section,
	textElementProps,
}: {
	assets: AssetMap;
	blogPosts?: Array<BlogPostSummary>;
	contactFormComponent?: ComponentType<ContactFormProps>;
	context: SiteResolutionContext;
	disclosureBounds?: ReadonlyMap<string, { max: number; min: number }>;
	disclosureItemControls?: SiteDisclosureItemControlsResolver;
	document: SiteDocument;
	linkComponent: SiteLinkComponent;
	linkElementProps?: SiteLinkElementPropsResolver;
	locale: Iso6391LanguageCode;
	logo?: SiteLogo | undefined;
	mediaControls?: SiteMediaControlsResolver;
	preview?: boolean;
	section: SiteSection;
	textElementProps?: SiteTextElementPropsResolver;
}) => {
	if (section.source?.pattern === "contact-form") {
		return (
			<ContactFormSection
				document={document}
				formComponent={contactFormComponent}
				locale={locale}
				preview={preview}
				section={section}
				textElementProps={textElementProps}
			/>
		);
	}

	if (section.source?.pattern === "blog-latest-three" || section.source?.pattern === "blog-latest-six") {
		return (
			<BlogFeedSection
				basePath={context.basePath}
				document={document}
				linkComponent={linkComponent}
				locale={locale}
				posts={blogPosts}
				preview={preview}
				section={section}
				textElementProps={textElementProps}
			/>
		);
	}

	const blogLayoutPattern = blogLayoutPatterns.find((pattern) => pattern === section.source?.pattern);

	if (blogLayoutPattern && !blogPosts?.length && !preview) {
		return null;
	}

	const linkReferences =
		textElementProps || linkElementProps ? listSectionLinkElementReferences({ node: section.root }) : [];

	const linkLabelIds = new Set(
		linkElementProps ? linkReferences.flatMap(({ labels }) => labels.map(({ nodeId }) => nodeId)) : []
	);

	const resolvedLinkTargets = linkElementProps
		? resolveLinkTargets({ document, linkReferences, locale, section })
		: [];

	const menuItemsById = createMenuItemsById({ resolvedLinkTargets });

	const rendered = (
		<RenderNode
			assets={assets}
			contactForm={{ component: contactFormComponent, preview, sectionId: section.id }}
			disclosureItemControls={disclosureItemControls}
			disclosureItemTargets={
				disclosureItemControls ? createDisclosureItemTargets({ disclosureBounds, section }) : undefined
			}
			domAnchor={section.anchor}
			domId={section.id}
			homeHref={context.basePath || "/"}
			linkComponent={linkComponent}
			linkElementProps={linkElementProps}
			linkTargets={
				linkElementProps
					? new Map(
							resolvedLinkTargets.map(({ menuItemId, ...target }) => [
								target.elementId,
								{ ...target, menuItem: menuItemId ? menuItemsById.get(menuItemId) : undefined },
							])
						)
					: undefined
			}
			locale={locale}
			logo={logo}
			logoTextIds={logo && section.category === "footer" ? listBusinessNameTextIds({ section }) : undefined}
			mediaControls={mediaControls ? createMediaControls({ mediaControls, section }) : undefined}
			node={resolvePersistedNode({
				contentId: section.contentId,
				context,
				document,
				locale,
				node: section.root,
				settings: section.settings,
			})}
			omitHomeMenuItem={section.category === "header"}
			textElementProps={textElementProps}
			textTargets={
				textElementProps
					? new Map(
							listSectionTextNodeReferences({ node: section.root }).map(({ nodeId, pointer }) => [
								nodeId,
								{
									contentId: section.contentId,
									linkLabel: linkLabelIds.has(nodeId),
									locale,
									nodeId,
									pointer,
									sectionId: section.id,
								},
							])
						)
					: undefined
			}
		/>
	);

	const program = document.logic?.[section.id];

	const output = program ? <BehaviorRuntimeBoundary program={program}>{rendered}</BehaviorRuntimeBoundary> : rendered;

	if (!blogLayoutPattern) {
		return output;
	}

	return (
		<>
			{output}
			<SectionBlogLayoutPosts
				basePath={context.basePath}
				document={document}
				linkComponent={linkComponent}
				locale={locale}
				pattern={blogLayoutPattern}
				posts={blogPosts ?? []}
				section={section}
			/>
		</>
	);
};
