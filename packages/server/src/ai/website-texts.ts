import type { SiteDocument } from "@starter/infinite-website/contracts";
import {
	getWebsiteSectionLayoutDefinition,
	linkValueSchema,
	listSectionContentReferences,
	listWebsiteSectionCollections,
	listSectionLinkElementReferences,
	resolveSectionContentReference,
	stringValueSchema,
	type SiteSection,
} from "@starter/infinite-website/editing";

export const listWebsitePageHandles = ({ document }: { document: SiteDocument }) =>
	document.structure.pages.map((page, index) => ({ handle: `p${index}`, page }));

export const listWebsiteSectionHandles = ({ document }: { document: SiteDocument }) =>
	[
		...document.structure.layout.header.map((section, index) => ({
			area: "header" as const,
			index,
			pageId: null,
			section,
		})),
		...document.structure.pages.flatMap((page) =>
			page.sections.map((section, index) => ({ area: "page" as const, index, pageId: page.id, section }))
		),
		...document.structure.layout.footer.map((section, index) => ({
			area: "footer" as const,
			index,
			pageId: null,
			section,
		})),
	].map((candidate, index) => ({ ...candidate, handle: `s${index}` }));

export const resolveWebsitePageHandle = ({ document, handle }: { document: SiteDocument; handle: string }) =>
	listWebsitePageHandles({ document }).find((candidate) => candidate.handle === handle)?.page;

export const resolveWebsiteSectionHandle = ({ document, handle }: { document: SiteDocument; handle: string }) =>
	listWebsiteSectionHandles({ document }).find((candidate) => candidate.handle === handle);

export const resolveWebsiteTextHandle = ({ handle, section }: { handle: string; section: SiteSection }) =>
	listSectionContentReferences({ kind: "text", node: section.root }).find(
		(_reference, index) => handle === `t${index}`
	);

export const resolveWebsiteLinkHandle = ({ handle, section }: { handle: string; section: SiteSection }) =>
	listSectionLinkElementReferences({ node: section.root }).find((_reference, index) => handle === `l${index}`);

type SectionScope = { document: SiteDocument; locale: SiteDocument["defaultLocale"]; section: SiteSection };

const resolveContent = (
	{ document, locale, section }: SectionScope,
	reference: Parameters<typeof resolveSectionContentReference>[0]["reference"]
) =>
	resolveSectionContentReference({
		content: document.content,
		contentId: section.contentId,
		defaultLocale: document.defaultLocale,
		locale,
		reference,
	});

export const listSectionTexts = (scope: SectionScope) =>
	listSectionContentReferences({ kind: "text", node: scope.section.root }).flatMap((reference, index) => {
		const pointer = stringValueSchema.safeParse(Object.values(reference).at(0));

		return pointer.success
			? [
					{
						pointer: pointer.data,
						target: `t${index}`,
						value: stringValueSchema.parse(resolveContent(scope, reference)),
					},
				]
			: [];
	});

export const listSectionLinks = (scope: SectionScope) => {
	const references = listSectionLinkElementReferences({ node: scope.section.root });

	return references.map((reference, index) => ({
		label: reference.labels[0]
			? stringValueSchema.parse(resolveContent(scope, { $text: reference.labels[0].pointer }))
			: undefined,
		labelPointers: reference.labels.map(({ pointer }) => pointer),
		menuRole: reference.menuRole,
		parent: reference.menuItemId ? references.findIndex((item) => item.elementId === reference.menuItemId) : -1,
		pointer: reference.pointer,
		target: `l${index}`,
		value: linkValueSchema.parse(resolveContent(scope, { $link: reference.pointer })),
	}));
};

export const listSectionCollections = ({ document, section }: { document: SiteDocument; section: SiteSection }) => {
	const definition = section.source
		? getWebsiteSectionLayoutDefinition({ pattern: section.source.pattern })
		: undefined;

	const content = document.content[document.defaultLocale]?.sections[section.contentId];

	return listWebsiteSectionCollections({ content, definition }).map(({ max, min, order, pointer }, index) => ({
		handle: `c${index}`,
		items: order.map((id, item) => ({ handle: `i${item}`, id })),
		max,
		min,
		pointer,
	}));
};
