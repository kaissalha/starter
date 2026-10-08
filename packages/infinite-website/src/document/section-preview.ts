import type { WebsiteLayoutGenerationTargetV1 } from "../generation/contracts";
import { jsonObjectSchema, linkValueSchema, type JsonValue } from "./content-schema";
import { parseSiteDocument } from "./document-validation";
import type { SiteDocument } from "./site-document-schema";
import type { SiteSection } from "./structure-schema";

const removeUnavailableSectionTargets = ({ pageId, value }: { pageId: string; value: JsonValue }): JsonValue => {
	if (Array.isArray(value)) {
		return value.map((item) => removeUnavailableSectionTargets({ pageId, value: item }));
	}

	const object = jsonObjectSchema.safeParse(value);

	if (!object.success) {
		return value;
	}

	const link = linkValueSchema.safeParse(value);

	if (link.success && link.data.kind === "page" && link.data.sectionId) {
		return { kind: "page", pageId: link.data.pageId };
	}

	if (link.success && (link.data.kind === "anchor" || link.data.kind === "section")) {
		return { kind: "page", pageId };
	}

	return Object.fromEntries(
		Object.entries(object.data).flatMap(([key, child]) =>
			child === undefined ? [] : [[key, removeUnavailableSectionTargets({ pageId, value: child })]]
		)
	);
};

const pickSectionContent = ({
	document,
	pageId,
	sections,
}: {
	document: SiteDocument;
	pageId: string;
	sections: Array<SiteSection>;
}) => ({
	content: Object.fromEntries(
		Object.entries(document.content).map(([locale, content]) => [
			locale,
			content
				? {
						...content,
						sections: Object.fromEntries(
							sections.flatMap(({ contentId }) => {
								const value = content.sections[contentId];

								return value ? [[contentId, removeUnavailableSectionTargets({ pageId, value })]] : [];
							})
						),
					}
				: content,
		])
	),
	logic: Object.fromEntries(sections.flatMap(({ id }) => (document.logic?.[id] ? [[id, document.logic[id]]] : []))),
});

export const createWebsiteSectionPreviewDocument = ({
	document,
	section,
	target,
}: {
	document: SiteDocument;
	section: SiteSection;
	target: WebsiteLayoutGenerationTargetV1;
}) => {
	const pageId = target.area === "page" ? target.pageId : document.structure.pages.find(({ home }) => home)?.id;

	if (!pageId) {
		throw new Error("Website section preview requires a page");
	}

	const backdrop =
		target.area === "header" ? document.structure.pages.find(({ id }) => id === pageId)?.sections[0] : undefined;

	const sections = backdrop ? [section, backdrop] : [section];

	return parseSiteDocument({
		...document,
		...pickSectionContent({ document, pageId, sections }),
		structure: {
			...document.structure,
			layout: {
				footer: target.area === "footer" ? [section] : [],
				header: target.area === "header" ? [section] : [],
			},
			pages: document.structure.pages.map((page) => ({
				...page,
				home: page.id === pageId,
				sections:
					page.id === pageId
						? sections.filter((candidate) => candidate !== section || target.area === "page")
						: [],
			})),
		},
	});
};

export const createWebsiteHomepagePreviewDocument = ({ document }: { document: SiteDocument }) => {
	const home = document.structure.pages.find(({ home: isHome }) => isHome);

	if (!home) {
		throw new Error("Website homepage preview requires a home page");
	}

	const sections = [...document.structure.layout.header, ...home.sections, ...document.structure.layout.footer];
	const contentIds = new Set(sections.map(({ contentId }) => contentId));
	const sectionIds = new Set(sections.map(({ id }) => id));

	return parseSiteDocument({
		...document,
		content: Object.fromEntries(
			Object.entries(document.content).map(([locale, content]) => [
				locale,
				content
					? {
							...content,
							sections: Object.fromEntries(
								Object.entries(content.sections).filter(([contentId]) => contentIds.has(contentId))
							),
						}
					: content,
			])
		),
		logic: document.logic
			? Object.fromEntries(Object.entries(document.logic).filter(([sectionId]) => sectionIds.has(sectionId)))
			: document.logic,
		structure: {
			...document.structure,
			pages: document.structure.pages.map((page) => ({
				...page,
				sections: page.id === home.id ? page.sections : [],
			})),
		},
	});
};

export const insertWebsiteSectionPreview = ({
	document,
	preview,
	target,
}: {
	document: SiteDocument;
	preview: SiteDocument;
	target: { index: number; pageId: string };
}) => {
	const previewSections = preview.structure.pages.flatMap(({ sections }) => sections);
	const section = previewSections[0];

	if (!section || previewSections.length !== 1) {
		throw new Error("Website section preview is missing its section");
	}

	return parseSiteDocument({
		...document,
		content: Object.fromEntries(
			document.locales.map((locale) => {
				const content = document.content[locale];
				const previewSection = preview.content[locale]?.sections[section.contentId];

				if (!content || !previewSection) {
					throw new Error(`Website section preview is missing content for "${locale}"`);
				}

				return [locale, { ...content, sections: { ...content.sections, [section.contentId]: previewSection } }];
			})
		),
		logic: preview.logic?.[section.id]
			? { ...document.logic, [section.id]: preview.logic[section.id] }
			: document.logic,
		structure: {
			...document.structure,
			pages: document.structure.pages.map((page) =>
				page.id === target.pageId
					? { ...page, sections: page.sections.toSpliced(target.index, 0, section) }
					: page
			),
		},
	});
};

export const createWebsiteSectionNeighborhoodDocument = ({
	document,
	pageId,
	sectionId,
}: {
	document: SiteDocument;
	pageId: string;
	sectionId: string;
}): SiteDocument => {
	const page = document.structure.pages.find(({ id }) => id === pageId);
	const index = page?.sections.findIndex(({ id }) => id === sectionId) ?? -1;

	if (!page || index < 0) {
		throw new Error("Website section preview requires a page section");
	}

	const sections = page.sections.slice(Math.max(0, index - 1), index + 2);

	return {
		...document,
		...pickSectionContent({ document, pageId, sections }),
		structure: {
			...document.structure,
			layout: { footer: [], header: [] },
			pages: document.structure.pages.map((candidate) => ({
				...candidate,
				home: candidate.id === pageId,
				sections: candidate.id === pageId ? sections : [],
			})),
		},
	};
};
