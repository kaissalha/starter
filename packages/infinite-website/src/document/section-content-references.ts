import {
	assetReferenceSchema,
	authoringJsonObjectSchema,
	contentReferencePointer,
	contentReferenceSchema,
	entityIdSchema,
	findCollectionItem,
	linkReferenceSchema,
	resolveSectionContentReference,
	textReferenceSchema,
	type AuthoringJsonValue,
	type ContentReference,
} from "./content-schema";
import type { SiteDocument } from "./site-document-schema";
import { siteNodeSchema, type PersistedSiteNode } from "./structure-schema";

const collectContentReferences = ({ value }: { value: AuthoringJsonValue }): Array<ContentReference> => {
	if (Array.isArray(value)) {
		return value.flatMap((item) => collectContentReferences({ value: item }));
	}

	const reference = contentReferenceSchema.safeParse(value);

	if (reference.success) {
		return [reference.data];
	}

	const object = authoringJsonObjectSchema.safeParse(value);

	if (!object.success) {
		return [];
	}

	return Object.values(object.data).flatMap((child) => collectContentReferences({ value: child }));
};

export const listSectionContentReferences = ({
	kind,
	node,
}: {
	kind: "asset" | "link" | "text";
	node: PersistedSiteNode;
}) => {
	const seen = new Set<string>();

	return collectContentReferences({ value: node }).flatMap((reference) => {
		if (!Object.hasOwn(reference, `$${kind}`)) {
			return [];
		}

		const pointer = contentReferencePointer({ reference });

		if (seen.has(pointer)) {
			return [];
		}

		seen.add(pointer);

		return [reference];
	});
};

export const listSiteDocumentAssetIds = ({ document }: { document: SiteDocument }) => {
	const sections = [
		...document.structure.layout.header,
		...document.structure.pages.flatMap(({ sections: pageSections }) => pageSections),
		...document.structure.layout.footer,
	];

	const assetIds = new Set(
		Object.values(document.content).flatMap((localeContent) =>
			localeContent
				? Object.values(localeContent.pages).flatMap((pageContent) =>
						pageContent.seo?.imageAssetId ? [pageContent.seo.imageAssetId] : []
					)
				: []
		)
	);

	for (const section of sections) {
		const references = listSectionContentReferences({ kind: "asset", node: section.root });

		for (const locale of document.locales) {
			for (const reference of references) {
				assetIds.add(
					entityIdSchema.parse(
						resolveSectionContentReference({
							content: document.content,
							contentId: section.contentId,
							defaultLocale: document.defaultLocale,
							locale,
							reference,
						})
					)
				);
			}
		}
	}

	return [...assetIds];
};

export type SectionTextNodeReference = { altPointer?: string; nodeId: string; pointer: string };

const collectNodeReferences = ({
	backgroundOnly = false,
	kind = "text",
	value,
}: {
	backgroundOnly?: boolean;
	kind?: "text" | "media";
	value: AuthoringJsonValue;
}): Array<SectionTextNodeReference> => {
	if (Array.isArray(value)) {
		return value.flatMap((item) => collectNodeReferences({ backgroundOnly, kind, value: item }));
	}

	const object = authoringJsonObjectSchema.safeParse(value);

	if (!object.success) {
		return [];
	}

	if (object.data.type !== kind) {
		return Object.values(object.data).flatMap((child) =>
			collectNodeReferences({ backgroundOnly, kind, value: child })
		);
	}

	if (backgroundOnly) {
		const layout = authoringJsonObjectSchema.safeParse(object.data.layout);

		if (
			!layout.success ||
			layout.data.position !== "absolute" ||
			layout.data.inlineSize !== "full" ||
			layout.data.blockSize !== "full"
		) {
			return [];
		}
	}

	const nodeId = entityIdSchema.safeParse(object.data.id);
	const props = authoringJsonObjectSchema.safeParse(object.data.props);
	const referenceSchema = kind === "media" ? assetReferenceSchema : textReferenceSchema;

	const reference = props.success
		? referenceSchema.safeParse(props.data[kind === "media" ? "assetId" : "content"])
		: undefined;

	const alt = kind === "media" && props.success ? textReferenceSchema.safeParse(props.data.alt) : undefined;

	if (nodeId.success && reference?.success) {
		return [
			{
				altPointer: alt?.success ? contentReferencePointer({ reference: alt.data }) : undefined,
				nodeId: nodeId.data,
				pointer: contentReferencePointer({ reference: reference.data }),
			},
		];
	}

	return [];
};

export const isBusinessNameContentPointer = (pointer: string) =>
	/(?:^|[-_/])(?:brand|brand-name|business-name)(?:$|[-_/])/iu.test(pointer);

export const listSectionTextNodeReferences = ({ node }: { node: PersistedSiteNode }) => {
	return collectNodeReferences({ value: node });
};

export const listSectionMediaNodeReferences = ({
	backgroundOnly = false,
	node,
}: {
	backgroundOnly?: boolean;
	node: PersistedSiteNode;
}) => {
	if (!backgroundOnly) {
		return collectNodeReferences({ kind: "media", value: node });
	}

	const props = authoringJsonObjectSchema.safeParse(node.props);
	const children = props.success && Array.isArray(props.data.children) ? props.data.children : [];

	return children.flatMap((child) =>
		authoringJsonObjectSchema.safeParse(child).data?.type === "media"
			? collectNodeReferences({ backgroundOnly, kind: "media", value: child })
			: []
	);
};

export type SectionLinkElementReference = {
	elementId: string;
	elementType: "action" | "menu";
	labels: Array<SectionTextNodeReference>;
	menuItemId?: string | undefined;
	menuRole?: "dropdown-item" | "dropdown-trigger" | "navigation-item" | undefined;
	pointer: string;
};

const collectLinkElementReferences = ({
	inMenuItems = false,
	menuItemId,
	value,
}: {
	inMenuItems?: boolean;
	menuItemId?: string;
	value: AuthoringJsonValue;
}): Array<SectionLinkElementReference> => {
	if (Array.isArray(value)) {
		return value.flatMap((item) => collectLinkElementReferences({ inMenuItems, menuItemId, value: item }));
	}

	const object = authoringJsonObjectSchema.safeParse(value);

	if (!object.success) {
		return [];
	}

	const nodeId = entityIdSchema.safeParse(object.data.id);
	const props = authoringJsonObjectSchema.safeParse(object.data.props);
	const references: Array<SectionLinkElementReference> = [];

	if (object.data.type === "action" && nodeId.success && props.success) {
		const href = linkReferenceSchema.safeParse(props.data.href);
		const labels = collectNodeReferences({ value: props.data.children });

		if (href.success) {
			references.push({
				elementId: nodeId.data,
				elementType: "action",
				labels,
				menuItemId,
				menuRole: inMenuItems ? "dropdown-item" : undefined,
				pointer: href.data.$link,
			});
		}
	}

	if (object.data.type === "menu" && props.success && Array.isArray(props.data.items)) {
		props.data.items.forEach((item) => {
			const menuItem = authoringJsonObjectSchema.safeParse(item);
			const itemId = menuItem.success ? entityIdSchema.safeParse(menuItem.data.id) : undefined;
			const href = menuItem?.success ? linkReferenceSchema.safeParse(menuItem.data.href) : undefined;

			const labels = menuItem?.success
				? collectNodeReferences({ value: [menuItem.data.trigger, menuItem.data.mobileTrigger] })
				: [];

			if (itemId?.success && href?.success) {
				const hasPanel = menuItem.success && Array.isArray(menuItem.data.panel);

				references.push({
					elementId: itemId.data,
					elementType: "menu",
					labels,
					menuItemId: itemId.data,
					menuRole: hasPanel ? "dropdown-trigger" : "navigation-item",
					pointer: href.data.$link,
				});

				if (hasPanel) {
					references.push(
						...collectLinkElementReferences({
							inMenuItems: true,
							menuItemId: itemId.data,
							value: menuItem.data.panel,
						})
					);
				}
			}
		});
	}

	return [
		...references,
		...Object.entries(object.data).flatMap(([key, child]) => {
			if (object.data.type === "menu" && key === "props") {
				const menuProps = authoringJsonObjectSchema.safeParse(child);

				return menuProps.success
					? Object.entries(menuProps.data).flatMap(([propKey, propValue]) =>
							propKey === "items" ? [] : collectLinkElementReferences({ value: propValue })
						)
					: [];
			}

			return collectLinkElementReferences({ inMenuItems, menuItemId, value: child });
		}),
	];
};

export const listSectionLinkElementReferences = ({ node }: { node: PersistedSiteNode }) => {
	return collectLinkElementReferences({ value: node });
};

export type SectionDisclosureItemReference = {
	collection: string;
	contentItemId: string;
	disclosureId: string;
	index: number;
	itemCount: number;
	itemId: string;
};

const collectDisclosureItemReferences = ({
	value,
}: {
	value: AuthoringJsonValue;
}): Array<SectionDisclosureItemReference> => {
	if (Array.isArray(value)) {
		return value.flatMap((item) => collectDisclosureItemReferences({ value: item }));
	}

	const object = authoringJsonObjectSchema.safeParse(value);

	if (!object.success) {
		return [];
	}

	const disclosureId = entityIdSchema.safeParse(object.data.id);
	const props = authoringJsonObjectSchema.safeParse(object.data.props);
	const items = props?.success && Array.isArray(props.data.items) ? props.data.items : [];

	const references =
		object.data.type === "disclosure" && disclosureId.success
			? items.flatMap((item, index) => {
					const parsedItem = authoringJsonObjectSchema.safeParse(item);
					const itemId = parsedItem.success ? entityIdSchema.safeParse(parsedItem.data.id) : undefined;

					const collectionItems = new Map(
						collectContentReferences({ value: item }).flatMap((reference) => {
							const collectionItem = findCollectionItem({
								pointer: contentReferencePointer({ reference }),
							});

							return collectionItem
								? [[collectionItem.collectionPointer, collectionItem.item] as const]
								: [];
						})
					);

					if (!itemId?.success || collectionItems.size !== 1) {
						return [];
					}

					const [collection, contentItemId] = [...collectionItems][0] ?? [];

					return collection && contentItemId
						? [
								{
									collection,
									contentItemId,
									disclosureId: disclosureId.data,
									index,
									itemCount: items.length,
									itemId: itemId.data,
								},
							]
						: [];
				})
			: [];

	return [
		...references,
		...Object.values(object.data).flatMap((child) => collectDisclosureItemReferences({ value: child })),
	];
};

export const listSectionDisclosureItemReferences = ({ node }: { node: PersistedSiteNode }) => {
	return collectDisclosureItemReferences({ value: node });
};

export const listSectionMenus = ({ node }: { node: PersistedSiteNode }) => {
	const visit = (value: AuthoringJsonValue): Array<Extract<PersistedSiteNode, { type: "menu" }>> => {
		if (Array.isArray(value)) {
			return value.flatMap(visit);
		}

		const object = authoringJsonObjectSchema.safeParse(value);

		if (!object.success) {
			return [];
		}

		if (object.data.type === "menu") {
			const menu = siteNodeSchema.parse(object.data);

			return menu.type === "menu" ? [menu] : [];
		}

		return Object.values(object.data).flatMap(visit);
	};

	return visit(node);
};
