import { z } from "zod";

import { siteDocumentResourceLimits } from "../resource-limits";
import { isJsonObject, type JsonObject, type JsonValue } from "./content-schema";
import { coreNodeTypes } from "./structure-schema";

type DocumentResourceIssue = {
	code: string;
	message: string;
	path: Array<number | string>;
};

const coreNodeTypeSet = new Set<string>(coreNodeTypes);

const stringSchema = z.compile(z.string());

const readRecord = (value: JsonValue | undefined): JsonObject | undefined => (isJsonObject(value) ? value : undefined);

const readArray = (record: JsonObject | undefined, key: string): Array<JsonValue> => {
	const value = record?.[key];

	return Array.isArray(value) ? value : [];
};

type SectionResourceRoot = { path: Array<number | string>; value: JsonValue | undefined };

type DocumentCollectionLimitResult = {
	issues: Array<DocumentResourceIssue>;
	roots: Array<SectionResourceRoot>;
};

const collectSectionResourceRoots = ({
	path,
	roots,
	sections,
}: {
	path: Array<number | string>;
	roots: Array<SectionResourceRoot>;
	sections: Array<JsonValue>;
}) => {
	sections.forEach((section, index) => {
		roots.push({ path: [...path, index, "root"], value: readRecord(section)?.root });
	});
};

const validateDocumentCollectionLimits = (input: JsonValue): DocumentCollectionLimitResult => {
	const root = readRecord(input);
	const locales = readArray(root, "locales");

	if (locales.length > siteDocumentResourceLimits.locales) {
		return {
			issues: [
				{
					code: "too_many_locales",
					message: `Document locales exceed the limit of ${siteDocumentResourceLimits.locales}`,
					path: ["locales"],
				},
			],
			roots: [],
		};
	}

	const structure = readRecord(root?.structure);
	const pages = readArray(structure, "pages");

	if (pages.length > siteDocumentResourceLimits.pages) {
		return {
			issues: [
				{
					code: "too_many_pages",
					message: `Document pages exceed the limit of ${siteDocumentResourceLimits.pages}`,
					path: ["structure", "pages"],
				},
			],
			roots: [],
		};
	}

	const layout = readRecord(structure?.layout);
	const roots: Array<SectionResourceRoot> = [];

	collectSectionResourceRoots({
		path: ["structure", "layout", "header"],
		roots,
		sections: readArray(layout, "header"),
	});
	pages.forEach((page, pageIndex) => {
		collectSectionResourceRoots({
			path: ["structure", "pages", pageIndex, "sections"],
			roots,
			sections: readArray(readRecord(page), "sections"),
		});
	});
	collectSectionResourceRoots({
		path: ["structure", "layout", "footer"],
		roots,
		sections: readArray(layout, "footer"),
	});

	if (roots.length > siteDocumentResourceLimits.sections) {
		return {
			issues: [
				{
					code: "too_many_sections",
					message: `Document sections exceed the limit of ${siteDocumentResourceLimits.sections}`,
					path: ["structure"],
				},
			],
			roots: [],
		};
	}

	const logic = readRecord(root?.logic);

	if (logic && Object.keys(logic).length > siteDocumentResourceLimits.sections) {
		return {
			issues: [
				{
					code: "too_many_logic_programs",
					message: `Document logic programs exceed the limit of ${siteDocumentResourceLimits.sections}`,
					path: ["logic"],
				},
			],
			roots: [],
		};
	}

	const customScriptPrograms = Object.values(logic ?? {}).filter(
		(program) => readRecord(program)?.expressionProfile === "custom-js-v1"
	).length;

	if (customScriptPrograms > siteDocumentResourceLimits.customScriptPrograms) {
		return {
			issues: [
				{
					code: "too_many_custom_script_programs",
					message: `Document custom scripts exceed the limit of ${siteDocumentResourceLimits.customScriptPrograms}`,
					path: ["logic"],
				},
			],
			roots: [],
		};
	}

	return { issues: [], roots };
};

const validateNodeCounts = ({
	depth,
	path,
	sectionNodes,
	totalNodes,
}: {
	depth: number;
	path: Array<number | string>;
	sectionNodes: number;
	totalNodes: number;
}): DocumentResourceIssue | undefined => {
	if (depth > siteDocumentResourceLimits.nodeDepth) {
		return {
			code: "section_too_deep",
			message: `Section node depth exceeds the limit of ${siteDocumentResourceLimits.nodeDepth}`,
			path,
		};
	}

	if (sectionNodes > siteDocumentResourceLimits.sectionNodes) {
		return {
			code: "section_has_too_many_nodes",
			message: `Section nodes exceed the limit of ${siteDocumentResourceLimits.sectionNodes}`,
			path,
		};
	}

	return totalNodes > siteDocumentResourceLimits.nodes
		? {
				code: "document_has_too_many_nodes",
				message: `Document nodes exceed the limit of ${siteDocumentResourceLimits.nodes}`,
				path: ["structure"],
			}
		: undefined;
};

const validateDocumentNodeLimits = (roots: Array<SectionResourceRoot>): Array<DocumentResourceIssue> => {
	const totalNodes = { value: 0 };

	for (const sectionRoot of roots) {
		const stack: Array<{ nodeDepth: number; value: JsonValue | undefined }> = [
			{ nodeDepth: 0, value: sectionRoot.value },
		];

		const sectionNodes = { value: 0 };

		while (stack.length > 0) {
			const current = stack.pop();

			if (!current) {
				continue;
			}

			if (Array.isArray(current.value)) {
				current.value.forEach((value) => stack.push({ nodeDepth: current.nodeDepth, value }));
				continue;
			}

			const record = readRecord(current.value);

			if (!record) {
				continue;
			}

			const nodeType = stringSchema.safeParse(record.type);
			const isNode = nodeType.success && coreNodeTypeSet.has(nodeType.data);
			const nodeDepth = current.nodeDepth + (isNode ? 1 : 0);

			if (!isNode) {
				Object.values(record).forEach((value) => stack.push({ nodeDepth, value }));
				continue;
			}

			sectionNodes.value += 1;
			totalNodes.value += 1;

			const issue = validateNodeCounts({
				depth: nodeDepth,
				path: sectionRoot.path,
				sectionNodes: sectionNodes.value,
				totalNodes: totalNodes.value,
			});

			if (issue) {
				return [issue];
			}

			Object.values(record).forEach((value) => stack.push({ nodeDepth, value }));
		}
	}

	return [];
};

type TraversalFrame =
	| { depth: number; kind: "enter"; value: JsonValue | undefined }
	| { kind: "leave"; value: Array<JsonValue> | JsonObject };

const validateDocumentJsonLimits = (input: JsonValue): Array<DocumentResourceIssue> => {
	const ancestors = new WeakSet<Array<JsonValue> | JsonObject>();
	const traversal: Array<TraversalFrame> = [{ depth: 0, kind: "enter", value: input }];
	const stringCodeUnits = { value: 0 };
	const values = { value: 0 };

	while (traversal.length > 0) {
		const frame = traversal.pop();

		if (!frame) {
			continue;
		}

		if (frame.kind === "leave") {
			ancestors.delete(frame.value);
			continue;
		}

		values.value += 1;

		if (values.value > siteDocumentResourceLimits.jsonValues) {
			return [
				{
					code: "document_has_too_many_values",
					message: `Document JSON values exceed the limit of ${siteDocumentResourceLimits.jsonValues}`,
					path: [],
				},
			];
		}

		const stringValue = stringSchema.safeParse(frame.value);

		if (stringValue.success) {
			stringCodeUnits.value += stringValue.data.length;
		}

		if (stringCodeUnits.value > siteDocumentResourceLimits.bytes) {
			return [
				{
					code: "document_too_large",
					message: `Document exceeds the limit of ${siteDocumentResourceLimits.bytes} bytes`,
					path: [],
				},
			];
		}

		const record = readRecord(frame.value);
		const container = Array.isArray(frame.value) ? frame.value : record;

		if (!container) {
			continue;
		}

		const depth = frame.depth + 1;

		if (depth > siteDocumentResourceLimits.jsonDepth) {
			return [
				{
					code: "document_json_too_deep",
					message: `Document JSON depth exceeds the limit of ${siteDocumentResourceLimits.jsonDepth}`,
					path: [],
				},
			];
		}

		if (ancestors.has(container)) {
			return [
				{
					code: "invalid_json_graph",
					message: "Document JSON cannot contain cyclic references",
					path: [],
				},
			];
		}

		ancestors.add(container);
		traversal.push({ kind: "leave", value: container });

		if (record) {
			stringCodeUnits.value += Object.keys(record).reduce((total, key) => total + key.length, 0);
		}

		if (stringCodeUnits.value > siteDocumentResourceLimits.bytes) {
			return [
				{
					code: "document_too_large",
					message: `Document exceeds the limit of ${siteDocumentResourceLimits.bytes} bytes`,
					path: [],
				},
			];
		}

		(Array.isArray(container) ? container : Object.values(container)).forEach((value) =>
			traversal.push({ depth, kind: "enter", value })
		);
	}

	try {
		const serialized = JSON.stringify(input);

		if (serialized && new TextEncoder().encode(serialized).byteLength > siteDocumentResourceLimits.bytes) {
			return [
				{
					code: "document_too_large",
					message: `Document exceeds the limit of ${siteDocumentResourceLimits.bytes} bytes`,
					path: [],
				},
			];
		}
	} catch {
		return [
			{
				code: "invalid_json_graph",
				message: "Document must be serializable JSON",
				path: [],
			},
		];
	}

	return [];
};

export const validateSiteDocumentResourceLimits = (input: JsonValue): Array<DocumentResourceIssue> => {
	const collections = validateDocumentCollectionLimits(input);

	if (collections.issues.length > 0) {
		return collections.issues;
	}

	const jsonIssues = validateDocumentJsonLimits(input);

	if (jsonIssues.length > 0) {
		return jsonIssues;
	}

	const nodeIssues = validateDocumentNodeLimits(collections.roots);

	return nodeIssues;
};

export const validateSiteSectionRootResourceLimits = (input: JsonValue) =>
	validateDocumentJsonLimits(input)[0] ?? validateDocumentNodeLimits([{ path: [], value: input }])[0];
