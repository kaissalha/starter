import { z } from "zod";

import {
	authoringJsonObjectSchema,
	contentReferenceSchema,
	contentReferencePointer,
	encodeContentPointer,
	findCollectionItem,
	jsonObjectSchema,
	linkValueSchema,
	mergeContentValue,
	readContentPointer,
	resolveLocalizedContent,
	settingReferenceSchema,
	type AuthoringJsonValue,
	type ContentReference,
	type JsonObject,
	type JsonValue,
	type LinkValue,
} from "../document/content-schema";
import type { SiteDocument } from "../document/site-document-schema";
import { coreNodeTypes, type PersistedSiteNode, type SiteNode } from "../document/structure-schema";
import type { Iso6391LanguageCode } from "../language-codes";

type CollectionOrder = {
	path: string;
	positions: Map<string, number>;
};

const collectionOrderSchema = z.compile(z.array(z.string()));

const stringSchema = z.compile(z.string());

const resolvedSiteNodeSchema = z
	.object({
		props: authoringJsonObjectSchema,
		type: z.enum(coreNodeTypes),
	})
	.loose();

const isResolvedSiteNode = (value: AuthoringJsonValue): value is SiteNode =>
	resolvedSiteNodeSchema.safeParse(value).success;

const collectCollectionOrders = ({
	path = [],
	value,
}: {
	path?: Array<string>;
	value: JsonValue | undefined;
}): Array<CollectionOrder> => {
	if (Array.isArray(value)) {
		return value.flatMap((item, index) => collectCollectionOrders({ path: [...path, String(index)], value: item }));
	}

	const parsed = jsonObjectSchema.safeParse(value);

	if (!parsed.success) {
		return [];
	}

	const order = collectionOrderSchema.safeParse(parsed.data.order);
	const items = jsonObjectSchema.safeParse(parsed.data.items);

	if (order.success && items.success) {
		return [
			{
				path: encodeContentPointer({ segments: path }),
				positions: new Map(order.data.map((id, index) => [id, index])),
			},
		];
	}

	return Object.entries(parsed.data).flatMap(([key, child]) =>
		collectCollectionOrders({ path: [...path, key], value: child })
	);
};

const referencedCollectionItems = ({
	collections,
	value,
}: {
	collections: Array<CollectionOrder>;
	value: AuthoringJsonValue;
}): Map<string, Set<string>> => {
	if (Array.isArray(value)) {
		return value.reduce<Map<string, Set<string>>>((references, item) => {
			referencedCollectionItems({ collections, value: item }).forEach((ids, path) => {
				const existing = references.get(path) ?? new Set<string>();
				ids.forEach((id) => existing.add(id));
				references.set(path, existing);
			});

			return references;
		}, new Map<string, Set<string>>());
	}

	const parsed = authoringJsonObjectSchema.safeParse(value);

	if (!parsed.success) {
		return new Map();
	}

	const reference = contentReferenceSchema.safeParse(value);

	if (reference.success) {
		const collectionItem = findCollectionItem({ pointer: contentReferencePointer({ reference: reference.data }) });

		if (!collectionItem) {
			return new Map();
		}

		const collection = collections.find(({ path }) => path === collectionItem.collectionPointer);

		if (!collection) {
			return new Map();
		}

		return new Map([[collection.path, new Set([collectionItem.item])]]);
	}

	return Object.values(parsed.data).reduce((references, child) => {
		referencedCollectionItems({ collections, value: child }).forEach((ids, path) => {
			const existing = references.get(path) ?? new Set<string>();
			ids.forEach((id) => existing.add(id));
			references.set(path, existing);
		});

		return references;
	}, new Map<string, Set<string>>());
};

const reorderContentDrivenArray = ({
	collections,
	values,
}: {
	collections: Array<CollectionOrder>;
	values: Array<AuthoringJsonValue>;
}) => {
	const references = values.map((value) => referencedCollectionItems({ collections, value }));

	const candidate = collections.reduce<{ collection: CollectionOrder; indexes: Array<number> } | undefined>(
		(best, collection) => {
			const indexes = references.flatMap((byPath, index) =>
				byPath.get(collection.path)?.size === 1 ? [index] : []
			);

			if (indexes.length <= 1 || (best && best.indexes.length >= indexes.length)) {
				return best;
			}

			return { collection, indexes };
		},
		undefined
	);

	if (!candidate) {
		return values;
	}

	const sortedValues = candidate.indexes
		.map((index) => {
			const ids = references[index]?.get(candidate.collection.path);
			const id = ids ? [...ids][0] : undefined;

			if (!id) {
				throw new Error(`Missing collection item identity at index ${index}`);
			}

			return { id, index, value: values[index] };
		})
		.toSorted(
			(left, right) =>
				(candidate.collection.positions.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
				(candidate.collection.positions.get(right.id) ?? Number.MAX_SAFE_INTEGER)
		)
		.map(({ value }) => value);

	const sortedValuesByIndex = new Map<number, AuthoringJsonValue>();
	candidate.indexes.forEach((index, sortedIndex) => sortedValuesByIndex.set(index, sortedValues[sortedIndex]));

	return values.map((value, index) => {
		const sortedValue = sortedValuesByIndex.get(index);

		return sortedValue === undefined ? value : sortedValue;
	});
};

export type SiteResolutionContext = {
	anchors: Map<string, string>;
	basePath: string;
	pageSlugs: Map<string, string>;
	sectionPagePaths?: Map<string, string>;
};

export const createSiteResolutionContext = ({
	basePath = "",
	document,
	locale,
	omitPageSections = false,
}: {
	basePath?: string;
	document: SiteDocument;
	locale: Iso6391LanguageCode;
	omitPageSections?: boolean;
}): SiteResolutionContext => {
	const sections = [
		...document.structure.layout.header,
		...document.structure.pages.flatMap((page) => page.sections),
		...document.structure.layout.footer,
	];

	const context: SiteResolutionContext = {
		anchors: new Map(sections.map((section) => [section.anchor, section.id])),
		basePath: basePath === "/" ? "" : basePath.replace(/\/+$/u, ""),
		pageSlugs: new Map(
			document.structure.pages.map((page) => {
				const slug = resolveLocalizedContent({
					area: "pages",
					content: document.content,
					defaultLocale: document.defaultLocale,
					id: page.id,
					locale,
					pointer: "/route/slug",
				});

				const parsedSlug = stringSchema.safeParse(slug);

				if (!parsedSlug.success) {
					throw new Error(`Page "${page.id}" has no localized slug`);
				}

				return [page.id, parsedSlug.data];
			})
		),
	};

	if (omitPageSections) {
		context.sectionPagePaths = new Map(
			document.structure.pages.flatMap((page) =>
				page.sections.map((section) => [
					section.id,
					page.home ? context.basePath || "/" : `${context.basePath}/${context.pageSlugs.get(page.id)}`,
				])
			)
		);
	}

	return context;
};

const resolveLinkHref = ({ context, link }: { context: SiteResolutionContext; link: LinkValue }) => {
	switch (link.kind) {
		case "external":
		case "booking":
			return link.url;
		case "relative":
			return `${context.basePath}${link.path}`;
		case "anchor": {
			const sectionId = context.anchors.get(link.anchor);

			if (!sectionId) {
				throw new Error(`Anchor "${link.anchor}" has no matching section`);
			}

			return `${context.sectionPagePaths?.get(sectionId) ?? ""}#${sectionId}`;
		}

		case "section":
			return `${context.sectionPagePaths?.get(link.sectionId) ?? ""}#${link.sectionId}`;
		case "email":
			return `mailto:${link.address}`;
		case "phone":
			return `tel:${link.number}`;
		case "page": {
			const slug = context.pageSlugs.get(link.pageId);

			if (!slug) {
				throw new Error(`Page "${link.pageId}" has no localized slug`);
			}

			return `${context.basePath}/${slug}${link.sectionId ? `#${link.sectionId}` : ""}`;
		}
	}
};

const resolveReference = ({
	context,
	reference,
	sectionContent,
}: {
	context: SiteResolutionContext;
	reference: ContentReference;
	sectionContent: JsonValue | undefined;
}) => {
	const pointer = contentReferencePointer({ reference });
	const value = readContentPointer({ pointer, value: sectionContent });

	if (value === undefined) {
		throw new Error(`Missing sections content at "${pointer}"`);
	}

	if (!Object.hasOwn(reference, "$link")) {
		return value;
	}

	const link = linkValueSchema.parse(value);

	return { href: resolveLinkHref({ context, link }), kind: link.kind };
};

export const resolvePersistedNode = ({
	contentId,
	context,
	document,
	locale,
	node,
	settings,
}: {
	contentId: string;
	context: SiteResolutionContext;
	document: SiteDocument;
	locale: Iso6391LanguageCode;
	node: PersistedSiteNode;
	settings?: JsonObject;
}) => {
	const sectionContent = mergeContentValue({
		fallback: document.content[document.defaultLocale]?.sections[contentId],
		localized: document.content[locale]?.sections[contentId],
	});

	const collections = collectCollectionOrders({ value: sectionContent });

	const resolveValue = (value: AuthoringJsonValue): AuthoringJsonValue => {
		if (Array.isArray(value)) {
			return reorderContentDrivenArray({ collections, values: value }).map(resolveValue);
		}

		const parsed = authoringJsonObjectSchema.safeParse(value);

		if (!parsed.success) {
			return value;
		}

		const reference = contentReferenceSchema.safeParse(value);

		if (reference.success) {
			return resolveReference({ context, reference: reference.data, sectionContent });
		}

		const settingReference = settingReferenceSchema.safeParse(value);

		if (settingReference.success) {
			const setting = readContentPointer({ pointer: settingReference.data.$setting, value: settings });

			if (setting === undefined) {
				throw new Error(`Missing section setting at "${settingReference.data.$setting}"`);
			}

			return setting;
		}

		return Object.fromEntries(Object.entries(parsed.data).map(([key, child]) => [key, resolveValue(child)]));
	};

	const resolvedNode = resolveValue(node);

	if (!isResolvedSiteNode(resolvedNode)) {
		throw new Error("Resolved site node has an invalid structure");
	}

	return resolvedNode;
};
