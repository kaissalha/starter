import { linkValueSchema, readContentPointer, stringValueSchema } from "../document/content-schema";
import { parseSiteDocument } from "../document/document-validation";
import { normalizeGeneratedHeaderMenu } from "../document/edit-website";
import { listSectionLinkElementReferences } from "../document/section-content-references";
import type { SiteDocument } from "../document/site-document-schema";
import type { SiteSection } from "../document/structure-schema";
import type { LocalizedSectionContent } from "../sections/section-definition";
import type { WebsiteGenerationEventV1, WebsiteSnapshotV1 } from "./contracts";

type SectionTarget = Extract<WebsiteGenerationEventV1, { type: "section" }>["target"];

type GeneratedSectionUpdate = {
	content: LocalizedSectionContent;
	section: SiteSection;
	target: SectionTarget;
};

const generatedHomeLabels = new Set(["home", "home page", "homepage", "الرئيسية", "الصفحة الرئيسية"]);

const generatedHomeMenuItemIds = ({ document, update }: { document: SiteDocument; update: GeneratedSectionUpdate }) => {
	const homePageId = document.structure.pages.find(({ home }) => home)?.id;

	return new Set(
		listSectionLinkElementReferences({ node: update.section.root }).flatMap((reference) => {
			if (reference.menuRole !== "dropdown-trigger" && reference.menuRole !== "navigation-item") {
				return [];
			}

			const pointsHome = Object.values(update.content).some((content) => {
				if (!content) {
					return false;
				}

				const link = linkValueSchema.safeParse(
					readContentPointer({ pointer: reference.pointer, value: content })
				);

				const labelIsHome = reference.labels.some(({ pointer }) => {
					const label = stringValueSchema.safeParse(readContentPointer({ pointer, value: content }));

					return label.success && generatedHomeLabels.has(label.data.trim().toLocaleLowerCase());
				});

				return (
					labelIsHome ||
					(link.success &&
						((link.data.kind === "page" && link.data.pageId === homePageId) ||
							(link.data.kind === "relative" && link.data.path === "/")))
				);
			});

			return pointsHome ? [reference.elementId] : [];
		})
	);
};

const mergeGeneratedSection = ({ document, update }: { document: SiteDocument; update: GeneratedSectionUpdate }) => {
	const { content: localizedContent, target } = update;

	const section =
		target.area === "header"
			? normalizeGeneratedHeaderMenu({
					homeItemIds: generatedHomeMenuItemIds({ document, update }),
					section: update.section,
				})
			: update.section;

	const layout = {
		footer: document.structure.layout.footer.filter((candidate) => candidate.id !== section.id),
		header: document.structure.layout.header.filter((candidate) => candidate.id !== section.id),
	};

	const pages = document.structure.pages.map((page) => ({
		...page,
		sections: page.sections.filter((candidate) => candidate.id !== section.id),
	}));

	const structure = (() => {
		if (target.area === "header") {
			return {
				...document.structure,
				layout: { ...layout, header: layout.header.toSpliced(target.index, 0, section) },
				pages,
			};
		}

		if (target.area === "footer") {
			return {
				...document.structure,
				layout: { ...layout, footer: layout.footer.toSpliced(target.index, 0, section) },
				pages,
			};
		}

		const pageIndex = pages.findIndex((candidate) => candidate.id === target.pageId);
		const page = pages[pageIndex];

		if (!page) {
			throw new Error("Generated section targets a missing page");
		}

		return {
			...document.structure,
			layout,
			pages: pages.toSpliced(pageIndex, 1, {
				...page,
				sections: page.sections.toSpliced(target.index, 0, section),
			}),
		};
	})();

	const content = document.locales.reduce<SiteDocument["content"]>((current, locale) => {
		const localized = current[locale];
		const value = localizedContent[locale];

		if (!localized || !value) {
			return current;
		}

		return {
			...current,
			[locale]: {
				...localized,
				sections: {
					...localized.sections,
					[section.contentId]: value,
				},
			},
		};
	}, document.content);

	return {
		...document,
		content,
		structure,
	};
};

export const removeGeneratedSection = ({ document, sectionId }: { document: SiteDocument; sectionId: string }) => {
	const sections = [
		...document.structure.layout.header,
		...document.structure.layout.footer,
		...document.structure.pages.flatMap((page) => page.sections),
	];

	const removed = sections.find(({ id }) => id === sectionId);

	if (!removed) {
		return document;
	}

	return {
		...document,
		content: Object.fromEntries(
			Object.entries(document.content).map(([locale, content]) => [
				locale,
				content
					? {
							...content,
							sections: Object.fromEntries(
								Object.entries(content.sections).filter(
									([contentId]) => contentId !== removed.contentId
								)
							),
						}
					: content,
			])
		),
		structure: {
			...document.structure,
			layout: {
				footer: document.structure.layout.footer.filter(({ id }) => id !== sectionId),
				header: document.structure.layout.header.filter(({ id }) => id !== sectionId),
			},
			pages: document.structure.pages.map((page) => ({
				...page,
				sections: page.sections.filter(({ id }) => id !== sectionId),
			})),
		},
	};
};

export const upsertGeneratedSection = ({
	document,
	section,
}: {
	document: SiteDocument;
	section: GeneratedSectionUpdate;
}) => upsertGeneratedSections({ document, sections: [section] });

export const upsertGeneratedSections = ({
	document,
	sections,
}: {
	document: SiteDocument;
	sections: Array<GeneratedSectionUpdate>;
}) => {
	return parseSiteDocument(
		sections.reduce((current, section) => mergeGeneratedSection({ document: current, update: section }), document)
	);
};

export const applyWebsiteGenerationEvent = ({
	event,
	snapshot,
	validateDocument = true,
}: {
	event: WebsiteGenerationEventV1;
	snapshot: WebsiteSnapshotV1 | null;
	validateDocument?: boolean;
}) => {
	if (event.type === "prepared" || event.type === "completed") {
		return validateDocument
			? { ...event.snapshot, document: parseSiteDocument(event.snapshot.document) }
			: event.snapshot;
	}

	if (event.type === "status" || event.type === "failed" || event.type === "cancelled") {
		return snapshot;
	}

	if (!snapshot) {
		throw new Error(`A generated ${event.type} arrived before the website shell`);
	}

	if (event.type === "asset-settled") {
		return { ...snapshot, assets: { ...snapshot.assets, [event.assetId]: event.asset } };
	}

	if (event.type === "section-skipped") {
		const document = removeGeneratedSection({ document: snapshot.document, sectionId: event.sectionId });

		return { ...snapshot, document: validateDocument ? parseSiteDocument(document) : document };
	}

	const document = mergeGeneratedSection({
		document: snapshot.document,
		update: { content: event.content, section: event.section, target: event.target },
	});

	return { ...snapshot, document: validateDocument ? parseSiteDocument(document) : document };
};

export const applyWebsiteGenerationEvents = ({
	events,
	snapshot,
	validateDocument = true,
}: {
	events: Array<WebsiteGenerationEventV1>;
	snapshot: WebsiteSnapshotV1 | null;
	validateDocument?: boolean;
}) => {
	const current = events.reduce<WebsiteSnapshotV1 | null>(
		(currentSnapshot, event) =>
			applyWebsiteGenerationEvent({ event, snapshot: currentSnapshot, validateDocument: false }),
		snapshot
	);

	if (!current || !validateDocument) {
		return current;
	}

	return { ...current, document: parseSiteDocument(current.document) };
};
