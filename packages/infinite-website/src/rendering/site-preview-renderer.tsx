import { memo, type ComponentType, type ReactNode } from "react";

import { entityIdSchema, resolveSectionContentReference } from "../document/content-schema";
import { listSectionContentReferences } from "../document/section-content-references";
import type { SiteSection } from "../document/structure-schema";
import type { ResolvedAsset } from "../primitives/shared";
import { sectionRegistry } from "../section-registry";
import type {
	SiteDisclosureItemControlsResolver,
	SiteLinkElementPropsResolver,
	SiteTextElementPropsResolver,
	SiteMediaControlsResolver,
} from "./render-node";
import { noAssets, resolveSiteRenderer, type SiteRendererProps } from "./site-renderer-resolution";
import { RenderedSection, SiteRendererRoot, inFlowHeader } from "./site-renderer-shared";

export type SitePreviewSectionTarget =
	| { area: "header"; index: number }
	| { area: "footer"; index: number }
	| { area: "page"; index: number; pageId: string; sectionCount: number };

export type SitePreviewSectionProps = {
	children: ReactNode;

	hasLogic: boolean;
	section: SiteSection;
	target: SitePreviewSectionTarget;
};

export type SitePreviewInsertionGapProps = {
	target: { area: "page"; index: number; pageId: string };
};

export type SitePreviewRendererProps = SiteRendererProps & {
	disclosureItemControls?: SiteDisclosureItemControlsResolver;
	insertionGapComponent?: ComponentType<SitePreviewInsertionGapProps>;
	linkElementProps?: SiteLinkElementPropsResolver;
	mediaControls?: SiteMediaControlsResolver;
	sectionComponent: ComponentType<SitePreviewSectionProps>;
	textElementProps?: SiteTextElementPropsResolver;
};

type RenderedSectionProps = Parameters<typeof RenderedSection>[0];

type PreviewSectionBoundaryProps = RenderedSectionProps & {
	sectionComponent: ComponentType<SitePreviewSectionProps>;
	target: SitePreviewSectionTarget;
};

const sectionAssetReferences = new WeakMap<SiteSection["root"], ReturnType<typeof listSectionContentReferences>>();

const listSectionAssetReferences = ({ section }: { section: SiteSection }) => {
	const cached = sectionAssetReferences.get(section.root);

	if (cached) {
		return cached;
	}

	const references = listSectionContentReferences({ kind: "asset", node: section.root });
	sectionAssetReferences.set(section.root, references);

	return references;
};

const resolvedAssetsEqual = (previous: ResolvedAsset | undefined, next: ResolvedAsset | undefined) => {
	if (previous === next) {
		return true;
	}

	if (!previous || !next || previous.src !== next.src) {
		return false;
	}

	if (previous.type === "video" || next.type === "video") {
		return previous.type === "video" && next.type === "video" && previous.poster === next.poster;
	}

	return (
		previous.decoding === next.decoding &&
		previous.height === next.height &&
		previous.loading === next.loading &&
		previous.sizes === next.sizes &&
		previous.width === next.width &&
		previous.sources?.length === next.sources?.length &&
		(previous.sources?.every((source, index) => {
			const nextSource = next.sources?.[index];

			return nextSource !== undefined && source.src === nextSource.src && source.width === nextSource.width;
		}) ??
			true)
	);
};

const referencedAssetsEqual = (previous: RenderedSectionProps, next: RenderedSectionProps) => {
	if (previous.assets === next.assets) {
		return true;
	}

	return listSectionAssetReferences({ section: previous.section }).every((reference) => {
		const previousId = entityIdSchema.parse(
			resolveSectionContentReference({
				content: previous.document.content,
				contentId: previous.section.contentId,
				defaultLocale: previous.document.defaultLocale,
				locale: previous.locale,
				reference,
			})
		);

		const nextId = entityIdSchema.parse(
			resolveSectionContentReference({
				content: next.document.content,
				contentId: next.section.contentId,
				defaultLocale: next.document.defaultLocale,
				locale: next.locale,
				reference,
			})
		);

		return previousId === nextId && resolvedAssetsEqual(previous.assets[previousId], next.assets[nextId]);
	});
};

const renderedSectionContentEqual = (previous: RenderedSectionProps, next: RenderedSectionProps) => {
	const previousContent = previous.document.content[previous.locale];
	const nextContent = next.document.content[next.locale];
	const previousFallback = previous.document.content[previous.document.defaultLocale];
	const nextFallback = next.document.content[next.document.defaultLocale];

	return (
		previousContent?.site === nextContent?.site &&
		previousContent?.pages === nextContent?.pages &&
		previousContent?.sections[previous.section.contentId] === nextContent?.sections[next.section.contentId] &&
		previousFallback?.pages === nextFallback?.pages &&
		previousFallback?.sections[previous.section.contentId] === nextFallback?.sections[next.section.contentId]
	);
};

const renderedSectionsEqual = (previous: RenderedSectionProps, next: RenderedSectionProps) => {
	return (
		previous.blogPosts === next.blogPosts &&
		previous.section === next.section &&
		previous.document.logic?.[previous.section.id] === next.document.logic?.[next.section.id] &&
		previous.locale === next.locale &&
		previous.logo?.alt === next.logo?.alt &&
		previous.logo?.scale === next.logo?.scale &&
		previous.logo?.src === next.logo?.src &&
		previous.linkComponent === next.linkComponent &&
		previous.textElementProps === next.textElementProps &&
		previous.linkElementProps === next.linkElementProps &&
		previous.mediaControls === next.mediaControls &&
		previous.disclosureItemControls === next.disclosureItemControls &&
		referencedAssetsEqual(previous, next) &&
		renderedSectionContentEqual(previous, next)
	);
};

const PreviewSectionBoundaryContent = ({
	section,
	sectionComponent: SectionComponent,
	target,
	...renderedSectionProps
}: PreviewSectionBoundaryProps) => (
	<SectionComponent
		hasLogic={Boolean(renderedSectionProps.document.logic?.[section.id])}
		section={section}
		target={target}
	>
		<RenderedSection section={section} {...renderedSectionProps} />
	</SectionComponent>
);

const PreviewSectionBoundary = memo(
	PreviewSectionBoundaryContent,
	(previous, next) =>
		previous.sectionComponent === next.sectionComponent &&
		previous.target.area === next.target.area &&
		previous.target.index === next.target.index &&
		(previous.target.area !== "page" ||
			(next.target.area === "page" &&
				previous.target.pageId === next.target.pageId &&
				previous.target.sectionCount === next.target.sectionCount)) &&
		renderedSectionsEqual(previous, next)
);

export const SitePreviewRenderer = ({
	assets = noAssets,
	basePath,
	blogPosts,
	brand,
	disclosureItemControls,
	document,
	insertionGapComponent: InsertionGapComponent,
	linkComponent = "a",
	linkElementProps,
	locale = document.defaultLocale,
	mediaControls,
	pageSlug,
	sectionComponent: SectionComponent,
	textElementProps,
}: SitePreviewRendererProps) => {
	const resolved = resolveSiteRenderer({ basePath, brand, document, locale, pageSlug });

	if (!resolved) {
		return null;
	}

	const renderSection = (section: SiteSection, target: SitePreviewSectionTarget) => {
		const disclosureBounds = disclosureItemControls
			? new Map(
					(section.source ? (sectionRegistry.get(section.source.pattern)?.repeaters ?? []) : [])
						.filter((repeater) => repeater.editable !== false)
						.map(({ collection, max, min }) => [collection, { max, min }])
				)
			: undefined;

		return (
			<PreviewSectionBoundary
				assets={assets}
				blogPosts={blogPosts}
				context={resolved.context}
				disclosureBounds={disclosureBounds}
				disclosureItemControls={disclosureItemControls}
				document={document}
				key={section.id}
				linkComponent={linkComponent}
				linkElementProps={linkElementProps}
				locale={resolved.locale}
				logo={resolved.logo}
				mediaControls={mediaControls}
				preview
				section={section}
				sectionComponent={SectionComponent}
				target={target}
				textElementProps={textElementProps}
			/>
		);
	};

	return (
		<SiteRendererRoot direction={resolved.direction} locale={resolved.locale} theme={resolved.theme}>
			{document.structure.layout.header.map((section, index) =>
				renderSection(inFlowHeader(section), { area: "header", index })
			)}
			{resolved.page.sections.flatMap((section, index) => [
				InsertionGapComponent ? (
					<InsertionGapComponent
						key={`gap:${resolved.page.id}:${index}`}
						target={{ area: "page", index, pageId: resolved.page.id }}
					/>
				) : null,
				renderSection(section, {
					area: "page",
					index,
					pageId: resolved.page.id,
					sectionCount: resolved.page.sections.length,
				}),
			])}
			{InsertionGapComponent && (
				<InsertionGapComponent
					target={{
						area: "page",
						index: resolved.page.sections.length,
						pageId: resolved.page.id,
					}}
				/>
			)}
			{document.structure.layout.footer.map((section, index) =>
				renderSection(section, { area: "footer", index })
			)}
		</SiteRendererRoot>
	);
};
