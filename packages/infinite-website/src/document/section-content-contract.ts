import { z } from "zod";

import type { SectionDefinition } from "../sections/section-definition";
import {
	assetReferenceSchema,
	authoringJsonObjectSchema,
	decodeContentPointer,
	isContentArrayIndex,
	jsonObjectSchema,
	jsonValueSchema,
	linkReferenceSchema,
	linkValueSchema,
	textReferenceSchema,
	type JsonObject,
	type JsonValue,
	type AuthoringJsonValue,
} from "./content-schema";

type ContractNode = {
	item?: ContractNode;
	itemCount?: number;
	itemRange?: { initial: number; max: number; min: number };
	properties: Map<string, ContractNode>;
	value?: { kind: "asset" | "link" | "text"; schema: z.ZodType };
};

const contentSchemas = new WeakMap<SectionDefinition, z.ZodType>();

const textContentSchemas = new WeakMap<SectionDefinition, z.ZodType>();

const sectionContentContracts = new WeakMap<SectionDefinition, ContractNode>();

const createContractNode = (): ContractNode => {
	const node: ContractNode = { properties: new Map() };

	return node;
};

const addReferenceContract = ({
	kind,
	pointer,
	root,
	schema,
}: {
	kind: "asset" | "link" | "text";
	pointer: string;
	root: ContractNode;
	schema: z.ZodType;
}) => {
	const current = decodeContentPointer({ pointer }).reduce((current, segment, index, segments) => {
		if (segment === "items" && isContentArrayIndex({ segment: segments[index + 1] ?? "" })) {
			return current;
		}

		if (isContentArrayIndex({ segment })) {
			const index = Number(segment);
			current.item ??= createContractNode();
			current.itemCount = Math.max(current.itemCount ?? 0, index + 1);

			return current.item;
		}

		const property = current.properties.get(segment) ?? createContractNode();
		current.properties.set(segment, property);

		return property;
	}, root);

	if (current.value && current.value.kind !== kind) {
		throw new Error(`Content pointer "${pointer}" is used with incompatible reference types`);
	}

	current.value = { kind, schema };
};

const collectContentContracts = ({ root, value }: { root: ContractNode; value: AuthoringJsonValue }) => {
	if (Array.isArray(value)) {
		value.forEach((item) => collectContentContracts({ root, value: item }));

		return;
	}

	const parsed = authoringJsonObjectSchema.safeParse(value);

	if (!parsed.success) {
		return;
	}

	const textReference = textReferenceSchema.safeParse(value);

	if (textReference.success) {
		addReferenceContract({ kind: "text", pointer: textReference.data.$text, root, schema: z.string() });

		return;
	}

	const linkReference = linkReferenceSchema.safeParse(value);

	if (linkReference.success) {
		addReferenceContract({ kind: "link", pointer: linkReference.data.$link, root, schema: linkValueSchema });

		return;
	}

	const assetReference = assetReferenceSchema.safeParse(value);

	if (assetReference.success) {
		addReferenceContract({ kind: "asset", pointer: assetReference.data.$asset, root, schema: z.uuid() });

		return;
	}

	Object.values(parsed.data).forEach((child) => collectContentContracts({ root, value: child }));
};

const createContractSchema = ({ contract }: { contract: ContractNode }): z.ZodType => {
	if (contract.value) {
		if (contract.item || contract.properties.size > 0) {
			throw new Error("Content contract values cannot also contain nested values");
		}

		return contract.value.schema;
	}

	if (contract.item) {
		if (contract.properties.size > 0) {
			throw new Error("Content contract arrays cannot also contain named properties");
		}

		if (contract.itemRange) {
			return z
				.array(createContractSchema({ contract: contract.item }))
				.min(contract.itemRange.min)
				.max(contract.itemRange.max);
		}

		if (!contract.itemCount) {
			throw new Error("Content contract arrays must declare an exact length or repeat bounds");
		}

		return z.array(createContractSchema({ contract: contract.item })).length(contract.itemCount);
	}

	return z.strictObject(
		Object.fromEntries(
			[...contract.properties].map(([name, property]) => [name, createContractSchema({ contract: property })])
		)
	);
};

const contractAtPointer = ({ pointer, root }: { pointer: string; root: ContractNode }) => {
	return decodeContentPointer({ pointer }).reduce((current, segment) => {
		if (segment === "*") {
			if (!current.item) {
				throw new Error(`Repeatable collection "${pointer}" is not referenced by its generated nodes`);
			}

			return current.item;
		}

		const property = current.properties.get(segment);

		if (!property) {
			throw new Error(`Repeatable collection "${pointer}" is not referenced by its generated nodes`);
		}

		return property;
	}, root);
};

const createSectionContentContract = ({ definition }: { definition: SectionDefinition }) => {
	const existing = sectionContentContracts.get(definition);

	if (existing) {
		return existing;
	}

	const contract = createContractNode();
	collectContentContracts({ root: contract, value: definition.root });

	definition.repeaters?.forEach((repeater) =>
		collectContentContracts({ root: contract, value: repeater.createValues({ index: 0, parentIndex: 0 }) })
	);

	definition.repeaters?.forEach((repeater) => {
		const collection = contractAtPointer({ pointer: repeater.collection, root: contract });

		if (!collection.item) {
			throw new Error(`Repeatable collection "${repeater.collection}" must reference an array item`);
		}

		collection.itemCount = undefined;
		collection.itemRange = { initial: repeater.initial ?? repeater.min, max: repeater.max, min: repeater.min };
	});

	sectionContentContracts.set(definition, contract);

	return contract;
};

const hasTextContent = ({ contract }: { contract: ContractNode }): boolean => {
	if (contract.value) {
		return contract.value.kind === "text";
	}

	if (contract.item) {
		return hasTextContent({ contract: contract.item });
	}

	return [...contract.properties.values()].some((property) => hasTextContent({ contract: property }));
};

const createTextContractSchema = ({
	collectionItemCounts,
	contract,
	path = [],
}: {
	collectionItemCounts?: ReadonlyMap<string, number>;
	contract: ContractNode;
	path?: Array<string>;
}): z.ZodType => {
	if (contract.value) {
		if (contract.value.kind !== "text") {
			throw new Error("Non-text content cannot be exposed to the text-generation schema");
		}

		return contract.value.schema;
	}

	if (contract.item) {
		const item = contract.item;

		const createItemSchema = (index: number) =>
			createTextContractSchema({ collectionItemCounts, contract: item, path: [...path, String(index)] });

		const count = contract.itemRange
			? (collectionItemCounts?.get(`/${path.join("/")}`) ?? contract.itemRange.initial)
			: (contract.itemCount ?? 0);

		const itemSchemas = Array.from({ length: count }, (_, index) => createItemSchema(index));

		return z
			.array(jsonValueSchema)
			.length(count)
			.superRefine((values, context) =>
				values.forEach((value, index) => {
					const result = itemSchemas[index]?.safeParse(value);

					if (result && !result.success) {
						result.error.issues.forEach((issue) =>
							context.addIssue({ ...issue, path: [index, ...issue.path] })
						);
					}
				})
			);
	}

	return z.strictObject(
		Object.fromEntries(
			[...contract.properties].flatMap(([name, property]) =>
				hasTextContent({ contract: property })
					? [
							[
								name,
								createTextContractSchema({
									collectionItemCounts,
									contract: property,
									path: [...path, name],
								}),
							],
						]
					: []
			)
		)
	);
};

const readTextValue = ({ key, value }: { key: string; value: JsonValue | undefined }) => {
	const parsed = jsonObjectSchema.safeParse(value);

	return parsed.success ? parsed.data[key] : undefined;
};

const materializeContract = ({
	assetIds,
	collectionItemCounts,
	contract,
	createAssetId,
	createLink,
	path,
	text,
}: {
	assetIds: Array<{ assetId: string; pointer: string }>;
	collectionItemCounts?: ReadonlyMap<string, number>;
	contract: ContractNode;
	createAssetId: ({ pointer }: { pointer: string }) => string;
	createLink: ({ pointer }: { pointer: string }) => z.infer<typeof linkValueSchema>;
	path: Array<string>;
	text: JsonValue | undefined;
}): JsonValue => {
	const pointer = `/${path.join("/")}`;

	if (contract.value?.kind === "text") {
		return jsonValueSchema.parse(contract.value.schema.parse(text));
	}

	if (contract.value?.kind === "asset") {
		const assetId = createAssetId({ pointer });
		assetIds.push({ assetId, pointer });

		return assetId;
	}

	if (contract.value?.kind === "link") {
		return linkValueSchema.parse(createLink({ pointer }));
	}

	if (contract.item) {
		const item = contract.item;
		const textItems = Array.isArray(text) ? text : [];

		const count = hasTextContent({ contract: item })
			? textItems.length
			: (collectionItemCounts?.get(pointer) ?? contract.itemRange?.min ?? contract.itemCount ?? 0);

		return Array.from({ length: count }, (_, index) =>
			materializeContract({
				assetIds,
				collectionItemCounts,
				contract: item,
				createAssetId,
				createLink,
				path: [...path, String(index)],
				text: textItems[index],
			})
		);
	}

	return jsonObjectSchema.parse(
		Object.fromEntries(
			[...contract.properties].map(([key, property]) => [
				key,
				materializeContract({
					assetIds,
					collectionItemCounts,
					contract: property,
					createAssetId,
					createLink,
					path: [...path, key],
					text: readTextValue({ key, value: text }),
				}),
			])
		)
	);
};

export const listSectionContentPointers = ({
	collectionItemCounts,
	definition,
	kind,
}: {
	collectionItemCounts?: ReadonlyMap<string, number>;
	definition: SectionDefinition;
	kind: "asset" | "link" | "text";
}): Array<string> => {
	const visit = ({ contract, path = [] }: { contract: ContractNode; path?: Array<string> }): Array<string> => {
		if (contract.value) {
			return contract.value.kind === kind ? [`/${path.join("/")}`] : [];
		}

		if (contract.item) {
			const item = contract.item;
			const collection = `/${path.join("/")}`;

			const count =
				collectionItemCounts?.get(collection) ?? contract.itemRange?.initial ?? contract.itemCount ?? 0;

			return Array.from({ length: count }, (_, index) =>
				visit({ contract: item, path: [...path, String(index)] })
			).flat();
		}

		return [...contract.properties].flatMap(([name, property]) =>
			visit({ contract: property, path: [...path, name] })
		);
	};

	return visit({ contract: createSectionContentContract({ definition }) });
};

const listEmptyTextCollections = ({
	collectionItemCounts,
	contract,
	path = [],
}: {
	collectionItemCounts?: ReadonlyMap<string, number>;
	contract: ContractNode;
	path?: Array<string>;
}): Array<Array<string>> => {
	if (contract.value) {
		return [];
	}

	if (contract.item) {
		const item = contract.item;

		const count =
			collectionItemCounts?.get(`/${path.join("/")}`) ?? contract.itemRange?.initial ?? contract.itemCount ?? 0;

		if (count === 0) {
			return hasTextContent({ contract: item }) ? [path] : [];
		}

		return Array.from({ length: count }, (_, index) =>
			listEmptyTextCollections({ collectionItemCounts, contract: item, path: [...path, String(index)] })
		).flat();
	}

	return [...contract.properties].flatMap(([name, property]) =>
		listEmptyTextCollections({ collectionItemCounts, contract: property, path: [...path, name] })
	);
};

const assignTextValue = ({
	segments,
	target,
	value,
}: {
	segments: Array<string>;
	target: JsonObject | Array<JsonValue>;
	value: JsonValue;
}) => {
	const [segment, ...remaining] = segments;

	if (!segment) {
		throw new Error("Text content pointers must contain at least one segment");
	}

	if (remaining.length === 0) {
		if (Array.isArray(target)) {
			target[Number(segment)] = value;
		} else {
			target[segment] = value;
		}

		return;
	}

	const current = Array.isArray(target) ? target[Number(segment)] : target[segment];
	const parsed = jsonObjectSchema.safeParse(current);

	const child = (() => {
		if (Array.isArray(current)) {
			return current;
		}

		if (parsed.success) {
			return parsed.data;
		}

		return isContentArrayIndex({ segment: remaining[0] ?? "" }) ? [] : {};
	})();

	if (Array.isArray(target)) {
		target[Number(segment)] = child;
	} else {
		target[segment] = child;
	}

	assignTextValue({ segments: remaining, target: child, value });
};

export const createSectionContentSchema = ({ definition }: { definition: SectionDefinition }) => {
	const existing = contentSchemas.get(definition);

	if (existing) {
		return existing;
	}

	const schema = createContractSchema({ contract: createSectionContentContract({ definition }) });
	contentSchemas.set(definition, schema);

	return schema;
};

export const createSectionTextContentSchema = ({
	collectionItemCounts,
	definition,
}: {
	collectionItemCounts?: ReadonlyMap<string, number>;
	definition: SectionDefinition;
}) => {
	if (collectionItemCounts) {
		return createTextContractSchema({
			collectionItemCounts,
			contract: createSectionContentContract({ definition }),
		});
	}

	const existing = textContentSchemas.get(definition);

	if (existing) {
		return existing;
	}

	const schema = createTextContractSchema({ contract: createSectionContentContract({ definition }) });
	textContentSchemas.set(definition, schema);

	return schema;
};

export type SectionTextField = { path: string; value: string };

export const createSectionTextContentFromFields = ({
	collectionItemCounts,
	definition,
	fields,
}: {
	collectionItemCounts?: ReadonlyMap<string, number>;
	definition: SectionDefinition;
	fields: Array<SectionTextField>;
}) => {
	const expectedPointers = listSectionContentPointers({ collectionItemCounts, definition, kind: "text" });
	const providedPointers = fields.map((field) => field.path);

	if (
		providedPointers.length !== expectedPointers.length ||
		expectedPointers.some((pointer, index) => providedPointers[index] !== pointer)
	) {
		throw new Error("Generated text fields do not match the section contract");
	}

	const text: JsonObject = {};

	fields.forEach((field) => {
		assignTextValue({ segments: decodeContentPointer({ pointer: field.path }), target: text, value: field.value });
	});

	listEmptyTextCollections({ collectionItemCounts, contract: createSectionContentContract({ definition }) }).forEach(
		(segments) => assignTextValue({ segments, target: text, value: [] })
	);

	return jsonObjectSchema.parse(createSectionTextContentSchema({ collectionItemCounts, definition }).parse(text));
};

export const materializeSectionContent = ({
	collectionItemCounts,
	createAssetId,
	createLink = () => ({ kind: "relative", path: "/" }),
	definition,
	text,
}: {
	collectionItemCounts?: ReadonlyMap<string, number>;
	createAssetId: ({ pointer }: { pointer: string }) => string;
	createLink?: ({ pointer }: { pointer: string }) => z.infer<typeof linkValueSchema>;
	definition: SectionDefinition;
	text: JsonValue;
}) => {
	const textContent = jsonValueSchema.parse(
		createSectionTextContentSchema({ collectionItemCounts, definition }).parse(text)
	);

	const assetIds: Array<{ assetId: string; pointer: string }> = [];

	const content = materializeContract({
		assetIds,
		collectionItemCounts,
		contract: createSectionContentContract({ definition }),
		createAssetId,
		createLink,
		path: [],
		text: textContent,
	});

	return { assetIds, content: createSectionContentSchema({ definition }).parse(content) };
};
