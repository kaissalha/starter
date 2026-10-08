import { z } from "zod";

import { sectionDefinitions, sectionRegistry } from "../section-registry";
import { entityIdFromSeed } from "../sections/entity-id";
import {
	instantiateSection,
	isNestedRepeater,
	listNestedRepeaters,
	listSectionRepeaterCollections,
	resolveRepeaterCollection,
	type EntityIdKind,
	type SectionDefinition,
	type SectionRepeater,
} from "../sections/section-definition";
import {
	contentReferencePointer,
	decodeContentPointer,
	encodeContentPointer,
	jsonObjectSchema,
	pendingTextContent,
	linkValueSchema,
	readContentPointer,
	resolveSectionContentReference,
} from "./content-schema";
import { parseSiteDocument } from "./document-validation";
import {
	createSectionTextContentFromFields,
	listSectionContentPointers,
	materializeSectionContent,
} from "./section-content-contract";
import { listSectionContentReferences } from "./section-content-references";
import type { SiteDocument } from "./site-document-schema";
import type { SiteSection } from "./structure-schema";

const collectionOrderSchema = z.compile(z.array(z.uuid()));

const stringSchema = z.compile(z.string());

const uuidSchema = z.compile(z.uuid());

export type WebsiteSectionLayoutTarget =
	| { area: "header" | "footer"; index: number; sectionId: string }
	| { area: "page"; index: number; pageId: string; sectionId: string };

const hasCompatibleContentContract = ({ source, target }: { source: SectionDefinition; target: SectionDefinition }) => {
	return (["asset", "link", "text"] as const).every((kind) => {
		const sourcePointers = new Set(listSectionContentPointers({ definition: source, kind }));

		return listSectionContentPointers({ definition: target, kind }).every((pointer) => sourcePointers.has(pointer));
	});
};

const resolveWebsiteSectionLayoutTarget = ({
	document,
	target,
}: {
	document: SiteDocument;
	target: WebsiteSectionLayoutTarget;
}) => {
	const section =
		target.area === "page"
			? document.structure.pages.find(({ id }) => id === target.pageId)?.sections[target.index]
			: document.structure.layout[target.area][target.index];

	return section?.id === target.sectionId ? section : undefined;
};

export const getWebsiteSectionLayoutDefinition = ({ pattern }: { pattern: string }) => sectionRegistry.get(pattern);

export const listWebsiteSectionLayouts = ({
	document,
	limit,
	target,
}: {
	document: SiteDocument;
	limit?: number;
	target: WebsiteSectionLayoutTarget;
}) => {
	const section = resolveWebsiteSectionLayoutTarget({ document, target });
	const current = section?.source ? sectionRegistry.get(section.source.pattern) : undefined;

	if (!section || !current) {
		return [];
	}

	if (document.logic?.[section.id]) {
		return [{ generationRequired: false, pattern: current.pattern }];
	}

	const candidates = sectionDefinitions
		.filter((definition) => definition.category === section.category && definition.pattern !== current.pattern)
		.map((definition) => ({
			definition,
			generationRequired: !hasCompatibleContentContract({ source: current, target: definition }),
		}))
		.sort((left, right) => Number(left.generationRequired) - Number(right.generationRequired));

	return [{ definition: current, generationRequired: false }, ...candidates]
		.slice(0, limit)
		.map(({ definition, generationRequired }) => ({
			generationRequired,
			pattern: definition.pattern,
		}));
};

const listNestedOrders = ({
	child,
	content,
	order,
	repeater,
}: {
	child: SectionRepeater;
	content: ReturnType<typeof jsonObjectSchema.parse>;
	order: Array<string>;
	repeater: SectionRepeater;
}) => {
	const orders = order.map((parentId) =>
		readCollectionOrder({
			content,
			pointer: `${repeater.collection}/items/${parentId}/${child.collection.slice(`${repeater.collection}/*/`.length)}`,
		})
	);

	return orders.every((nested) => nested !== undefined) ? orders : undefined;
};

const listRepeaterItemIds = ({
	content,
	definition,
}: {
	content: ReturnType<typeof jsonObjectSchema.parse>;
	definition: SectionDefinition;
}) => {
	const ids = new Map<string, Array<string>>();

	for (const repeater of (definition.repeaters ?? []).filter(
		(candidate) => !isNestedRepeater({ repeater: candidate })
	)) {
		const order = readCollectionOrder({ content, pointer: repeater.collection });

		if (!order) {
			return;
		}

		ids.set(repeater.collection, order);

		for (const child of listNestedRepeaters({ definition, repeater })) {
			const nested = listNestedOrders({ child, content, order, repeater });

			if (!nested) {
				return;
			}

			nested.forEach((nestedOrder, parentIndex) =>
				ids.set(resolveRepeaterCollection({ parentIndex, repeater: child }), nestedOrder)
			);
		}
	}

	return ids;
};

const readCollectionOrder = ({
	content,
	pointer,
}: {
	content: ReturnType<typeof jsonObjectSchema.parse>;
	pointer: string;
}) => {
	const collection = jsonObjectSchema.safeParse(readContentPointer({ pointer, value: content }));
	const order = collection.success ? collectionOrderSchema.safeParse(collection.data.order) : undefined;

	return order?.success ? order.data : undefined;
};

export const listWebsiteSectionCollections = ({
	content,
	definition,
}: {
	content: ReturnType<typeof jsonObjectSchema.parse> | undefined;
	definition: SectionDefinition | undefined;
}) =>
	(definition?.repeaters ?? [])
		.filter((repeater) => !isNestedRepeater({ repeater }))
		.flatMap((repeater) => {
			const order = content ? readCollectionOrder({ content, pointer: repeater.collection }) : undefined;

			if (!order) {
				return [];
			}

			return [
				{ max: repeater.max, min: repeater.min, order, pointer: repeater.collection },
				...listNestedRepeaters({ definition: definition!, repeater }).flatMap((child) =>
					order.flatMap((parentId) => {
						const pointer = `${repeater.collection}/items/${parentId}/${child.collection.slice(`${repeater.collection}/*/`.length)}`;
						const nested = content ? readCollectionOrder({ content, pointer }) : undefined;

						return nested ? [{ max: child.max, min: child.min, order: nested, pointer }] : [];
					})
				),
			];
		});

const resolveWebsiteSectionLayoutPointer = ({
	content,
	reference,
}: {
	content: ReturnType<typeof jsonObjectSchema.parse>;
	reference: Parameters<typeof contentReferencePointer>[0]["reference"];
}) => {
	const sourceSegments = decodeContentPointer({ pointer: contentReferencePointer({ reference }) });
	const targetSegments: Array<string> = [];

	for (const indexReference = { value: 0 }; indexReference.value < sourceSegments.length; indexReference.value += 1) {
		const segment = sourceSegments[indexReference.value];

		const collectionPointer = encodeContentPointer({ segments: sourceSegments.slice(0, indexReference.value) });

		const order =
			segment === "items"
				? collectionOrderSchema.safeParse(
						readContentPointer({ pointer: `${collectionPointer}/order`, value: content })
					)
				: undefined;

		if (!order?.success) {
			if (segment) {
				targetSegments.push(segment);
			}

			continue;
		}

		const itemId = sourceSegments[indexReference.value + 1];
		const itemIndex = itemId ? order.data.indexOf(itemId) : -1;

		if (itemIndex < 0) {
			return;
		}

		targetSegments.push(String(itemIndex));
		indexReference.value += 1;
	}

	return encodeContentPointer({ segments: targetSegments });
};

const listWebsiteSectionLayoutReferences = ({
	collectionItemCounts,
	content,
	definition,
	kind,
	node,
}: {
	collectionItemCounts: ReadonlyMap<string, number>;
	content: ReturnType<typeof jsonObjectSchema.parse>;
	definition: SectionDefinition;
	kind: "asset" | "link" | "text";
	node: SiteSection["root"];
}) => {
	const expectedPointers = new Set(listSectionContentPointers({ collectionItemCounts, definition, kind }));

	const references = listSectionContentReferences({ kind, node }).filter(
		(reference) => !contentReferencePointer({ reference }).startsWith("/authoring/")
	);

	const resolved = references.flatMap((reference) => {
		const pointer = resolveWebsiteSectionLayoutPointer({ content, reference });

		return pointer && expectedPointers.has(pointer) ? [{ pointer, reference }] : [];
	});

	return resolved.length === references.length ? resolved : undefined;
};

export const getWebsiteSectionLayoutCollectionItemCounts = ({
	collectionItemIds,
	definition,
}: {
	collectionItemIds: ReadonlyMap<string, Array<string>>;
	definition: SectionDefinition;
}) =>
	new Map(
		listSectionRepeaterCollections({
			count: ({ collection, repeater }) => {
				const sourceCount = collectionItemIds.get(collection)?.length;

				return sourceCount === undefined
					? undefined
					: Math.min(repeater.max, Math.max(repeater.min, sourceCount));
			},
			definition,
		}).map(({ collection, count }) => [collection, count])
	);

export const createWebsiteSectionLayoutEntityId = ({
	collectionItemIds,
	instancePath,
	kind,
	path,
	seed,
}: {
	collectionItemIds: ReadonlyMap<string, Array<string>>;
	instancePath: string;
	kind: EntityIdKind;
	path: string;
	seed: string;
}) => {
	if (kind === "collection-item") {
		for (const [collection, ids] of collectionItemIds) {
			const collectionPath = `${instancePath}${collection}/`;
			const itemIndex = path.startsWith(collectionPath) ? Number(path.slice(collectionPath.length)) : Number.NaN;
			const existingId = Number.isInteger(itemIndex) ? ids[itemIndex] : undefined;

			if (existingId) {
				return existingId;
			}
		}
	}

	return entityIdFromSeed({ seed });
};

export const readWebsiteSectionLayoutContent = ({
	document,
	target,
}: {
	document: SiteDocument;
	target: WebsiteSectionLayoutTarget;
}) => {
	const section = resolveWebsiteSectionLayoutTarget({ document, target });
	const definition = section?.source ? sectionRegistry.get(section.source.pattern) : undefined;
	const sourceContent = section ? document.content[document.defaultLocale]?.sections[section.contentId] : undefined;

	const collectionIds =
		definition && sourceContent ? listRepeaterItemIds({ content: sourceContent, definition }) : undefined;

	if (!section || !definition || !sourceContent || !collectionIds) {
		return;
	}

	const collectionItemCounts = new Map([...collectionIds].map(([collection, ids]) => [collection, ids.length]));

	const references = {
		asset: listWebsiteSectionLayoutReferences({
			collectionItemCounts,
			content: sourceContent,
			definition,
			kind: "asset",
			node: section.root,
		}),
		link: listWebsiteSectionLayoutReferences({
			collectionItemCounts,
			content: sourceContent,
			definition,
			kind: "link",
			node: section.root,
		}),
		text: listWebsiteSectionLayoutReferences({
			collectionItemCounts,
			content: sourceContent,
			definition,
			kind: "text",
			node: section.root,
		}),
	};

	const assetReferences = references.asset;
	const linkReferences = references.link;
	const textReferences = references.text;

	if (!textReferences || !assetReferences || !linkReferences) {
		return;
	}

	return {
		collectionItemIds: collectionIds,
		definition,
		locales: Object.fromEntries(
			document.locales.map((locale) => [
				locale,
				{
					assets: assetReferences.map(({ pointer, reference }) => ({
						pointer,
						value: uuidSchema.parse(
							resolveSectionContentReference({
								content: document.content,
								contentId: section.contentId,
								defaultLocale: document.defaultLocale,
								locale,
								reference,
							})
						),
					})),
					links: linkReferences.map(({ pointer, reference }) => ({
						pointer,
						value: linkValueSchema.parse(
							resolveSectionContentReference({
								content: document.content,
								contentId: section.contentId,
								defaultLocale: document.defaultLocale,
								locale,
								reference,
							})
						),
					})),
					text: textReferences.map(({ pointer, reference }) => ({
						pointer,
						value: stringSchema.parse(
							resolveSectionContentReference({
								content: document.content,
								contentId: section.contentId,
								defaultLocale: document.defaultLocale,
								locale,
								reference,
							})
						),
					})),
				},
			])
		),
		section,
	};
};

export const listWebsitePageSectionLayouts = ({
	document,
	limit = 6,
	pageId,
	sectionId,
}: {
	document: SiteDocument;
	limit?: number;
	pageId: string;
	sectionId: string;
}) => {
	const page = document.structure.pages.find((candidate) => candidate.id === pageId);
	const index = page?.sections.findIndex((candidate) => candidate.id === sectionId) ?? -1;

	if (!page || index < 0) {
		return [];
	}

	return listWebsiteSectionLayouts({
		document,
		limit,
		target: { area: "page", index, pageId, sectionId },
	});
};

const materializeWebsiteSectionLayout = ({
	definition,
	document,
	preview,
	source,
	target,
	validateDocument,
}: {
	definition: SectionDefinition;
	document: SiteDocument;
	preview: boolean;
	source: NonNullable<ReturnType<typeof readWebsiteSectionLayoutContent>>;
	target: WebsiteSectionLayoutTarget;
	validateDocument: boolean;
}) => {
	const { section } = source;

	const collectionItemCounts = getWebsiteSectionLayoutCollectionItemCounts({
		collectionItemIds: source.collectionItemIds,
		definition,
	});

	const textPointers = listSectionContentPointers({ collectionItemCounts, definition, kind: "text" });
	const firstPage = document.structure.pages[0];

	const content = Object.fromEntries(
		document.locales.map((locale) => {
			const values = source.locales[locale] ?? source.locales[document.defaultLocale];

			if (!values) {
				throw new Error(`Website layout is missing locale ${locale}`);
			}

			const assets = new Map(values.assets.map(({ pointer, value }) => [pointer, value]));
			const links = new Map(values.links.map(({ pointer, value }) => [pointer, value]));
			const text = new Map(values.text.map(({ pointer, value }) => [pointer, value]));

			const materialized = materializeSectionContent({
				collectionItemCounts,
				createAssetId: ({ pointer }) => {
					if (!preview) {
						return uuidSchema.parse(assets.get(pointer));
					}

					return (
						assets.get(pointer) ??
						assets.values().next().value ??
						entityIdFromSeed({
							seed: `website-layout-preview:${section.id}:${definition.pattern}:${pointer}`,
						})
					);
				},
				createLink: ({ pointer }) => {
					if (!preview) {
						return linkValueSchema.parse(links.get(pointer));
					}

					const existing = links.get(pointer) ?? links.values().next().value;

					if (existing) {
						return existing;
					}

					if (!firstPage) {
						throw new Error("Website layout preview requires a page link target");
					}

					return { kind: "page", pageId: firstPage.id };
				},
				definition,
				text: createSectionTextContentFromFields({
					collectionItemCounts,
					definition,
					fields: textPointers.map((path) => ({
						path,
						value: preview ? (text.get(path) ?? pendingTextContent) : stringSchema.parse(text.get(path)),
					})),
				}),
			});

			return [locale, materialized.content];
		})
	);

	const instancePath = preview
		? `/website-layout-preview/${section.id}/${definition.pattern}`
		: `/website-editor/${section.id}/${definition.pattern}`;

	const seedPrefix = preview ? "website-layout-preview" : "website-layout";

	const instance = instantiateSection({
		anchor: section.anchor,
		content,
		createId: ({ kind, path }) =>
			createWebsiteSectionLayoutEntityId({
				collectionItemIds: source.collectionItemIds,
				instancePath,
				kind,
				path,
				seed: `${seedPrefix}:${section.id}:${definition.pattern}:${kind}:${path}`,
			}),
		defaultLocale: document.defaultLocale,
		definition,
		path: instancePath,
	});

	const replacement = {
		...instance.section,
		anchor: section.anchor,
		contentId: section.contentId,
		id: section.id,
	};

	const nextDocument: SiteDocument = {
		...document,
		content: Object.fromEntries(
			Object.entries(document.content).map(([locale, localized]) => [
				locale,
				localized
					? {
							...localized,
							sections: {
								...localized.sections,
								[section.contentId]:
									instance.content[locale] ?? instance.content[document.defaultLocale],
							},
						}
					: localized,
			])
		),
		structure:
			target.area === "page"
				? {
						...document.structure,
						pages: document.structure.pages.map((page) =>
							page.id === target.pageId
								? { ...page, sections: page.sections.with(target.index, replacement) }
								: page
						),
					}
				: {
						...document.structure,
						layout: {
							...document.structure.layout,
							[target.area]: document.structure.layout[target.area].with(target.index, replacement),
						},
					},
	};

	return validateDocument ? parseSiteDocument(nextDocument) : nextDocument;
};

export const createWebsiteSectionLayoutPreview = ({
	document,
	generated,
	pattern,
	target,
}: {
	document: SiteDocument;
	generated?: { fields: Array<{ path: string; value: string }>; locale: string };
	pattern: string;
	target: WebsiteSectionLayoutTarget;
}) => {
	const source = readWebsiteSectionLayoutContent({ document, target });
	const definition = sectionRegistry.get(pattern);

	if (!source || !definition || definition.category !== source.section.category) {
		return;
	}

	if (pattern === source.section.source?.pattern) {
		return document;
	}

	const localized = generated && source.locales[generated.locale];

	if (localized) {
		const existing = new Set(localized.text.map(({ pointer }) => pointer));
		localized.text.push(
			...generated.fields
				.filter(({ path }) => !existing.has(path))
				.map(({ path, value }) => ({ pointer: path, value }))
		);
	}

	return materializeWebsiteSectionLayout({
		definition,
		document,
		preview: true,
		source,
		target,
		validateDocument: true,
	});
};

export const swapWebsitePageSectionLayout = ({
	document,
	pageId,
	pattern,
	sectionId,
	validateDocument = true,
}: {
	document: SiteDocument;
	pageId: string;
	pattern: string;
	sectionId: string;
	validateDocument?: boolean;
}) => {
	const page = document.structure.pages.find((candidate) => candidate.id === pageId);
	const index = page?.sections.findIndex((section) => section.id === sectionId) ?? -1;
	const target = { area: "page" as const, index, pageId, sectionId };
	const source = index < 0 ? undefined : readWebsiteSectionLayoutContent({ document, target });
	const definition = sectionRegistry.get(pattern);

	if (
		!source ||
		!definition ||
		definition.category !== source.section.category ||
		!hasCompatibleContentContract({ source: source.definition, target: definition })
	) {
		return;
	}

	if (source.section.source?.pattern === pattern) {
		return document;
	}

	return materializeWebsiteSectionLayout({
		definition,
		document,
		preview: false,
		source,
		target,
		validateDocument,
	});
};
