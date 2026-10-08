import { z } from "zod";

import {
	authoringJsonObjectSchema,
	decodeContentPointer,
	encodeContentPointer,
	isContentArrayIndex,
	jsonObjectSchema,
	jsonValueSchema,
	mergeContentValue,
	type AuthoringJsonObject,
	type AuthoringJsonValue,
	type JsonObject,
	type JsonValue,
} from "../document/content-schema";
import { createSectionContentSchema } from "../document/section-content-contract";
import {
	coreNodeTypes,
	siteNodeSchema,
	siteSectionSchema,
	type SectionCategory,
	type SiteNodeDefinition,
} from "../document/structure-schema";
import type { Iso6391LanguageCode } from "../language-codes";

export type EntityIdKind = "collection-item" | "content" | "interaction-item" | "node" | "page" | "section";

const stringSchema = z.compile(z.string());

export type CreateEntityId = ({ kind, path }: { kind: EntityIdKind; path: string }) => string;

export type SectionRepeater = {
	collection: string;
	createValues: ({
		index,
		item,
		parentIndex,
	}: {
		index: number;
		item?: AuthoringJsonValue;
		parentIndex: number;
	}) => Array<AuthoringJsonValue>;
	editable?: boolean;
	initial?: number;
	max: number;
	min: number;
	target: string;
};

export type SectionDefinition = {
	category: SectionCategory;
	pattern: string;
	repeaters?: Array<SectionRepeater>;
	root: SiteNodeDefinition;
	settings?: z.ZodType;
	supportsGeneration?: boolean;
};

const nestedCollectionMarker = "/*/";

export const isNestedRepeater = ({ repeater }: { repeater: SectionRepeater }) =>
	repeater.collection.includes(nestedCollectionMarker);

export const listNestedRepeaters = ({
	definition,
	repeater,
}: {
	definition: SectionDefinition;
	repeater: SectionRepeater;
}) => (definition.repeaters ?? []).filter(({ collection }) => collection.startsWith(`${repeater.collection}/*/`));

export const resolveRepeaterCollection = ({
	parentIndex,
	repeater,
}: {
	parentIndex: number;
	repeater: SectionRepeater;
}) => repeater.collection.replace(nestedCollectionMarker, `/${parentIndex}/`);

export const listSectionRepeaterCollections = ({
	count,
	definition,
}: {
	count: ({ collection, repeater }: { collection: string; repeater: SectionRepeater }) => number | undefined;
	definition: SectionDefinition;
}): Array<{ collection: string; count: number; parentIndex: number; repeater: SectionRepeater }> =>
	(definition.repeaters ?? [])
		.filter((repeater) => !isNestedRepeater({ repeater }))
		.flatMap((repeater) => {
			const total = count({ collection: repeater.collection, repeater }) ?? repeater.initial ?? repeater.min;

			return [
				{ collection: repeater.collection, count: total, parentIndex: 0, repeater },
				...listNestedRepeaters({ definition, repeater }).flatMap((child) =>
					Array.from({ length: total }, (_, parentIndex) => {
						const collection = resolveRepeaterCollection({ parentIndex, repeater: child });

						return {
							collection,
							count: count({ collection, repeater: child }) ?? child.initial ?? child.min,
							parentIndex,
							repeater: child,
						};
					})
				),
			];
		});

export const defineSection = <TDefinition extends SectionDefinition>(definition: TDefinition) => {
	definition.repeaters?.forEach((repeater) => {
		const nestedAt = repeater.collection.indexOf(nestedCollectionMarker);

		const parent =
			nestedAt === -1
				? undefined
				: definition.repeaters?.find(({ collection }) => collection === repeater.collection.slice(0, nestedAt));

		if (
			nestedAt !== -1 &&
			(!parent ||
				repeater.collection.indexOf(nestedCollectionMarker, nestedAt + 1) !== -1 ||
				!Array.isArray(
					readValueAtPointer({
						pointer: repeater.target,
						value: parent.createValues({ index: 0, parentIndex: 0 }),
					})
				))
		) {
			throw new Error(
				`Section "${definition.pattern}" has an invalid nested repeater at "${repeater.collection}"`
			);
		}

		if (
			repeater.min < 0 ||
			repeater.max < repeater.min ||
			(repeater.initial !== undefined && (repeater.initial < repeater.min || repeater.initial > repeater.max))
		) {
			throw new Error(`Section "${definition.pattern}" has invalid repeat bounds at "${repeater.collection}"`);
		}
	});

	return definition;
};

type SectionContent = JsonObject;

export type LocalizedSectionContent = Partial<Record<Iso6391LanguageCode, SectionContent>>;

const validateLocalizedSectionContent = ({
	content,
	defaultLocale,
	definition,
}: {
	content: LocalizedSectionContent;
	defaultLocale: Iso6391LanguageCode;
	definition: SectionDefinition;
}) => {
	const defaultContent = content[defaultLocale];

	if (!defaultContent) {
		throw new Error(`Section "${definition.pattern}" is missing default content for locale "${defaultLocale}"`);
	}

	const contentSchema = createSectionContentSchema({ definition });
	contentSchema.parse(defaultContent);

	Object.entries(content).forEach(([locale, localizedContent]) => {
		if (locale === defaultLocale) {
			return;
		}

		const mergedContent = jsonObjectSchema.parse(
			mergeContentValue({ fallback: defaultContent, localized: localizedContent })
		);

		contentSchema.parse(mergedContent);

		const defaultLengths = new Map<string, number>();
		const mergedLengths = new Map<string, number>();
		collectCollectionLengths({ lengths: defaultLengths, path: [], value: defaultContent });
		collectCollectionLengths({ lengths: mergedLengths, path: [], value: mergedContent });

		defaultLengths.forEach((length, collection) => {
			if (mergedLengths.get(collection) !== length) {
				throw new Error(
					`Section "${definition.pattern}" locale "${locale}" must keep ${length} items at "${collection}"`
				);
			}
		});
	});

	return content;
};

const siteNodeTypeSchema = z.compile(z.enum(coreNodeTypes));

export const isSiteNodeDefinition = (value: AuthoringJsonValue): value is SiteNodeDefinition => {
	const parsed = authoringJsonObjectSchema.safeParse(value);

	return (
		parsed.success &&
		siteNodeTypeSchema.safeParse(parsed.data.type).success &&
		authoringJsonObjectSchema.safeParse(parsed.data.props).success
	);
};

const isAuthoringJsonObject = (value: AuthoringJsonValue): value is AuthoringJsonObject => {
	return authoringJsonObjectSchema.safeParse(value).success;
};

const readValueAtPointer = ({ pointer, value }: { pointer: string; value: AuthoringJsonValue }) => {
	return decodeContentPointer({ pointer }).reduce<AuthoringJsonValue>((current, segment) => {
		if (Array.isArray(current)) {
			return isContentArrayIndex({ segment }) ? current[Number(segment)] : undefined;
		}

		return isAuthoringJsonObject(current) ? current[segment] : undefined;
	}, value);
};

const expandRepeaterEntry = ({
	count,
	definition,
	index,
	item,
	repeater,
}: {
	count: ({ collection }: { collection: string }) => number;
	definition: SectionDefinition;
	index: number;
	item?: AuthoringJsonValue;
	repeater: SectionRepeater;
}) => {
	const values = structuredClone(repeater.createValues({ index, item, parentIndex: 0 }));

	listNestedRepeaters({ definition, repeater }).forEach((child) => {
		const target = readValueAtPointer({ pointer: child.target, value: values });
		const total = count({ collection: resolveRepeaterCollection({ parentIndex: index, repeater: child }) });

		if (!Array.isArray(target)) {
			if (total === 0 && item !== undefined) {
				return;
			}

			throw new Error(`Repeat target "${child.target}" must be an array`);
		}

		target.splice(
			0,
			target.length,
			...Array.from({ length: total }, (_, childIndex) =>
				structuredClone(child.createValues({ index: childIndex, parentIndex: index }))
			).flat()
		);
	});

	return values;
};

export const expandSectionDefinition = ({
	content,
	definition,
}: {
	content: JsonValue;
	definition: SectionDefinition;
}) => {
	const root = structuredClone(definition.root);

	definition.repeaters
		?.filter((repeater) => !isNestedRepeater({ repeater }))
		.forEach((repeater) => {
			const items = readValueAtPointer({ pointer: repeater.collection, value: content });

			if (!Array.isArray(items)) {
				throw new Error(`Repeatable collection "${repeater.collection}" must be an array`);
			}

			const target = readValueAtPointer({ pointer: repeater.target, value: root });

			if (!Array.isArray(target)) {
				throw new Error(`Repeat target "${repeater.target}" must be an array`);
			}

			const count = ({ collection }: { collection: string }) => {
				const nested = readValueAtPointer({ pointer: collection, value: content });

				if (!Array.isArray(nested)) {
					throw new Error(`Repeatable collection "${collection}" must be an array`);
				}

				return nested.length;
			};

			target.splice(
				0,
				target.length,
				...items.flatMap((item, index) => expandRepeaterEntry({ count, definition, index, item, repeater }))
			);
		});

	return root;
};

export const mapSiteNodeDefinition = ({
	map,
	node,
}: {
	map: ({ node }: { node: SiteNodeDefinition }) => SiteNodeDefinition | undefined;
	node: SiteNodeDefinition;
}): SiteNodeDefinition => {
	const replacement = map({ node });

	if (replacement) {
		return replacement;
	}

	const mapValue = (value: AuthoringJsonValue): AuthoringJsonValue => {
		if (Array.isArray(value)) {
			return value.map(mapValue);
		}

		if (isSiteNodeDefinition(value)) {
			return mapSiteNodeDefinition({ map, node: value });
		}

		const parsed = authoringJsonObjectSchema.safeParse(value);

		if (!parsed.success) {
			return value;
		}

		return Object.fromEntries(Object.entries(parsed.data).map(([key, child]) => [key, mapValue(child)]));
	};

	const mappedNode = structuredClone(node);

	Object.entries(node.props).forEach(([key, value]) => {
		Object.assign(mappedNode.props, { [key]: mapValue(value) });
	});

	return mappedNode;
};

const collectCollectionLengths = ({
	lengths,
	path,
	value,
}: {
	lengths: Map<string, number>;
	path: Array<string>;
	value: JsonValue;
}) => {
	if (Array.isArray(value)) {
		const collectionPath = encodeContentPointer({ segments: path });
		lengths.set(collectionPath, Math.max(lengths.get(collectionPath) ?? 0, value.length));

		value.forEach((item, index) =>
			collectCollectionLengths({ lengths, path: [...path, String(index)], value: item })
		);

		return;
	}

	const parsed = jsonObjectSchema.safeParse(value);

	if (!parsed.success) {
		return;
	}

	Object.entries(parsed.data).forEach(([key, item]) =>
		collectCollectionLengths({ lengths, path: [...path, key], value: item })
	);
};

const createCollectionIds = ({
	content,
	createId,
	path,
}: {
	content: SectionContent;
	createId: CreateEntityId;
	path: string;
}) => {
	const lengths = new Map<string, number>();
	collectCollectionLengths({ lengths, path: [], value: content });

	return new Map(
		[...lengths].map(([collectionPath, length]) => [
			collectionPath,
			Array.from({ length }, (_, index) =>
				createId({ kind: "collection-item", path: `${path}${collectionPath}/${index}` })
			),
		])
	);
};

const instantiateContent = ({
	collectionIds,
	includeOrder,
	path,
	value,
}: {
	collectionIds: ReadonlyMap<string, ReadonlyArray<string>>;
	includeOrder: boolean;
	path: Array<string>;
	value: JsonValue;
}): JsonValue => {
	if (Array.isArray(value)) {
		const collectionPath = encodeContentPointer({ segments: path });
		const ids = collectionIds.get(collectionPath);

		if (!ids) {
			throw new Error(`Missing generated collection IDs at "${collectionPath}"`);
		}

		const items = Object.fromEntries(
			value.map((item, index) => [
				ids[index],
				instantiateContent({
					collectionIds,
					includeOrder,
					path: [...path, String(index)],
					value: item,
				}),
			])
		);

		return includeOrder ? { items, order: ids.slice(0, value.length) } : { items };
	}

	const parsed = jsonObjectSchema.safeParse(value);

	if (!parsed.success) {
		return value;
	}

	return Object.fromEntries(
		Object.entries(parsed.data).map(([key, item]) => [
			key,
			instantiateContent({ collectionIds, includeOrder, path: [...path, key], value: item }),
		])
	);
};

const rewriteCollectionSegments = ({
	collectionIds,
	fixture = [],
	pointer,
	segments,
}: {
	collectionIds: ReadonlyMap<string, ReadonlyArray<string>>;
	fixture?: Array<string>;
	pointer: string;
	segments: Array<string>;
}): Array<string> => {
	const [segment, ...rest] = segments;

	if (segment === undefined) {
		return [];
	}

	const [item, ...tail] = rest;

	if (segment === "items" && item !== undefined && isContentArrayIndex({ segment: item })) {
		const generatedId = collectionIds.get(encodeContentPointer({ segments: fixture }))?.[Number(item)];

		if (!generatedId) {
			throw new Error(`Section content reference "${pointer}" does not match its fixture collection`);
		}

		return [
			segment,
			generatedId,
			...rewriteCollectionSegments({ collectionIds, fixture: [...fixture, item], pointer, segments: tail }),
		];
	}

	return [
		segment,
		...rewriteCollectionSegments({ collectionIds, fixture: [...fixture, segment], pointer, segments: rest }),
	];
};

const instantiateContentReference = ({
	collectionIds,
	value,
}: {
	collectionIds: ReadonlyMap<string, ReadonlyArray<string>>;
	value: AuthoringJsonObject;
}) => {
	const referenceKey = ["$asset", "$link", "$text"].find((key) => stringSchema.safeParse(value[key]).success);

	if (!referenceKey) {
		return value;
	}

	const parsedReference = stringSchema.safeParse(value[referenceKey]);

	if (!parsedReference.success) {
		return value;
	}

	return {
		[referenceKey]: encodeContentPointer({
			segments: rewriteCollectionSegments({
				collectionIds,
				pointer: parsedReference.data,
				segments: decodeContentPointer({ pointer: parsedReference.data }),
			}),
		}),
	};
};

const instantiateAuthoringValue = ({
	collectionIds,
	createId,
	path,
	value,
}: {
	collectionIds: ReadonlyMap<string, ReadonlyArray<string>>;
	createId: CreateEntityId;
	path: string;
	value: AuthoringJsonValue;
}): AuthoringJsonValue => {
	if (Array.isArray(value)) {
		return value.map((item, index) =>
			instantiateAuthoringValue({ collectionIds, createId, path: `${path}/${index}`, value: item })
		);
	}

	const parsed = authoringJsonObjectSchema.safeParse(value);

	if (!parsed.success) {
		return value;
	}

	if (isSiteNodeDefinition(value)) {
		return instantiateNode({ collectionIds, createId, node: value, path });
	}

	return Object.fromEntries(
		Object.entries(instantiateContentReference({ collectionIds, value: parsed.data })).map(([key, child]) => [
			key,
			instantiateAuthoringValue({ collectionIds, createId, path: `${path}/${key}`, value: child }),
		])
	);
};

const instantiateNode = ({
	collectionIds,
	createId,
	node,
	path,
}: {
	collectionIds: ReadonlyMap<string, ReadonlyArray<string>>;
	createId: CreateEntityId;
	node: SiteNodeDefinition;
	path: string;
}) => {
	const props = instantiateAuthoringValue({
		collectionIds,
		createId,
		path: `${path}/props`,
		value: node.props,
	});

	const parsedProps = authoringJsonObjectSchema.safeParse(props);

	if (!parsedProps.success) {
		throw new Error(`Section node at "${path}" has invalid props`);
	}

	const mutableProps = parsedProps.data;

	if ((node.type === "disclosure" || node.type === "tabs") && Array.isArray(mutableProps.items)) {
		mutableProps.items = mutableProps.items.map((item, index) => {
			const nextItem = authoringJsonObjectSchema.safeParse(item);
			const nextItemData = nextItem.success ? nextItem.data : {};

			return {
				...nextItemData,
				id: createId({ kind: "interaction-item", path: `${path}/props/items/${index}` }),
			};
		});
	}

	if (node.type === "menu" && Array.isArray(mutableProps.items)) {
		mutableProps.items = mutableProps.items.map((item, index) => {
			const nextItem = authoringJsonObjectSchema.safeParse(item);
			const nextItemData = nextItem.success ? nextItem.data : {};

			return {
				...nextItemData,
				id: createId({ kind: "interaction-item", path: `${path}/props/items/${index}` }),
			};
		});
	}

	if (node.type === "carousel" && Array.isArray(mutableProps.controlGroups)) {
		mutableProps.controlGroups = mutableProps.controlGroups.map((group, index) => {
			const nextGroup = authoringJsonObjectSchema.safeParse(group);
			const nextGroupData = nextGroup.success ? nextGroup.data : {};

			return {
				...nextGroupData,
				id: createId({ kind: "interaction-item", path: `${path}/props/controlGroups/${index}` }),
			};
		});
	}

	return siteNodeSchema.parse({
		...node,
		id: createId({ kind: "node", path }),
		props: mutableProps,
	});
};

export const instantiateSectionRepeaterValues = ({
	collectionIds,
	createId,
	definition,
	index,
	parentIndex = 0,
	path,
	repeater,
}: {
	collectionIds: ReadonlyMap<string, ReadonlyArray<string>>;
	createId: CreateEntityId;
	definition: SectionDefinition;
	index: number;
	parentIndex?: number;
	path: string;
	repeater: SectionRepeater;
}): Array<JsonValue> => {
	const nested = isNestedRepeater({ repeater });

	const entryValues = nested
		? structuredClone(repeater.createValues({ index, parentIndex }))
		: expandRepeaterEntry({
				count: ({ collection }) => collectionIds.get(collection)?.length ?? 0,
				definition,
				index,
				repeater,
			});

	const values = entryValues.map((value, valueIndex) =>
		instantiateAuthoringValue({
			collectionIds,
			createId,
			path: `${path}/${valueIndex}`,
			value,
		})
	);

	const itemParentPointer =
		!nested && repeater.target.endsWith("/props/items")
			? repeater.target.slice(0, -"/props/items".length)
			: undefined;

	const itemParent = itemParentPointer
		? readValueAtPointer({ pointer: itemParentPointer, value: definition.root })
		: undefined;

	const hasInteractionItems =
		itemParent !== undefined &&
		isSiteNodeDefinition(itemParent) &&
		(itemParent.type === "disclosure" || itemParent.type === "menu" || itemParent.type === "tabs");

	if (!hasInteractionItems) {
		return values.map((value) => jsonValueSchema.parse(value));
	}

	return values.map((value, valueIndex) => {
		const item = authoringJsonObjectSchema.parse(value);

		return jsonObjectSchema.parse({
			...item,
			id: createId({ kind: "interaction-item", path: `${path}/${valueIndex}` }),
		});
	});
};

export const instantiateSection = ({
	anchor,
	content,
	createId,
	defaultLocale,
	definition,
	path,
	settings,
}: {
	anchor: string;
	content: LocalizedSectionContent;
	createId: CreateEntityId;
	defaultLocale: Iso6391LanguageCode;
	definition: SectionDefinition;
	path: string;
	settings?: JsonValue;
}) => {
	const validatedContent = validateLocalizedSectionContent({ content, defaultLocale, definition });
	const id = createId({ kind: "section", path });
	const contentId = createId({ kind: "content", path });
	const defaultContent = validatedContent[defaultLocale]!;
	const collectionIds = createCollectionIds({ content: defaultContent, createId, path });

	const root = instantiateNode({
		collectionIds,
		createId,
		node: expandSectionDefinition({ content: defaultContent, definition }),
		path: `${path}/root`,
	});

	if (root.type !== "box") {
		throw new Error(`Section "${definition.pattern}" must have a box root`);
	}

	return {
		content: Object.fromEntries(
			Object.entries(validatedContent).map(([locale, localeContent]) => [
				locale,
				instantiateContent({
					collectionIds,
					includeOrder: locale === defaultLocale,
					path: [],
					value: localeContent,
				}),
			])
		),
		section: siteSectionSchema.parse({
			anchor,
			category: definition.category,
			contentId,
			id,
			root,
			settings: definition.settings?.parse(settings),
			source: { pattern: definition.pattern },
		}),
	};
};
