import { z } from "zod";

import { contentReferencePointer, jsonObjectSchema, type JsonObject, type JsonValue } from "../document/content-schema";
import { listSectionContentReferences } from "../document/section-content-references";
import type { SiteDocument } from "../document/site-document-schema";
import {
	sectionCategories,
	siteNodeSchema,
	siteSectionSchema,
	type PersistedSiteNode,
	type SiteSection,
} from "../document/structure-schema";
import { siteDocumentResourceLimits } from "../resource-limits";
import { entityIdFromSeed } from "../sections/entity-id";
import { persistedCollectionChildren } from "./collection-nodes";
import { inspectSectionContent, inspectSectionLogic, inspectSectionStructure } from "./inspect";
import { validateStructureLiveness } from "./liveness";
import {
	materializeSectionContent,
	materializeSectionLogic,
	materializeSectionStructure,
	sectionContentNamespace,
	type SectionContentNamespace,
} from "./materialize";
import {
	BehaviorSectionError,
	composedSectionSpecificationSchema,
	deriveStructureContract,
	sectionContentSchema,
	sectionLogicSchema,
	sectionNodeKeySchema,
	sectionStructureSchema,
	validateContentAgainstContract,
	validateLogicAgainstContract,
	validateStructureFramePadding,
	type ComposedSectionSpecification,
	type SectionContent,
	type SectionLogic,
	type SectionStructure,
} from "./specification";

export const sectionLogicBindingsSchema = z.compile(
	z
		.strictObject({
			insert: z
				.array(
					z.strictObject({
						index: z.number().int().nonnegative().optional(),
						parentNodeId: z
							.uuid()
							.describe("The inspected id of the existing container node to insert under"),
						structure: sectionStructureSchema,
					})
				)
				.min(1)
				.max(32)
				.optional(),
			remove: z.array(z.uuid()).min(1).max(siteDocumentResourceLimits.sectionNodes).optional(),
		})
		.refine((bindings) => bindings.insert !== undefined || bindings.remove !== undefined, {
			message: "Provide at least one logic binding change",
		})
		.refine(
			(bindings) =>
				(bindings.insert ?? []).reduce((total, insertion) => total + insertion.structure.nodes.length, 0) <=
				siteDocumentResourceLimits.sectionNodes,
			`Inserted structures exceed the aggregate node limit of ${siteDocumentResourceLimits.sectionNodes}`
		)
);

export type SectionLogicBindings = z.infer<typeof sectionLogicBindingsSchema>;

const nodeIdentitySchema = z.compile(z.object({ id: z.string(), type: z.string() }));

const structureNodeIdentitySchema = z.compile(z.object({ key: sectionNodeKeySchema, type: z.string() }));

const keyedContainerSchema = z.compile(
	z.object({ key: z.string(), props: z.object({ children: z.array(z.json()) }), type: z.string() })
);

const collectIssues = () => {
	const issues: Array<{ message: string; path: Array<number | string> }> = [];

	return {
		context: {
			addIssue: (issue: { code: "custom"; message: string; path: Array<number | string> }) => {
				issues.push({ message: issue.message, path: issue.path });
			},
		},
		throwIfAny: (prefix: string) => {
			if (issues.length === 0) {
				return;
			}

			const details = issues
				.map((issue) => (issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message))
				.join("\n");

			throw new BehaviorSectionError(`${prefix}\n${details}`);
		},
	};
};

const requireBilingualDocument = (document: SiteDocument) => {
	if (
		!document.locales.includes("en") ||
		!document.locales.includes("ar") ||
		document.locales.some((locale) => locale !== "en" && locale !== "ar")
	) {
		throw new BehaviorSectionError(
			"Composed sections and section logic require a document with exactly en and ar locales"
		);
	}
};

const findPageSection = ({
	document,
	pageId,
	sectionId,
}: {
	document: SiteDocument;
	pageId: string;
	sectionId?: string;
}) => {
	const page = document.structure.pages.find((candidate) => candidate.id === pageId);

	if (!page) {
		throw new BehaviorSectionError(`Page "${pageId}" is unavailable`);
	}

	if (sectionId === undefined) {
		return { index: -1, page, section: undefined };
	}

	const index = page.sections.findIndex((section) => section.id === sectionId);
	const section = page.sections[index];

	if (!section) {
		throw new BehaviorSectionError(`Section "${sectionId}" is unavailable on page "${pageId}"`);
	}

	return { index, page, section };
};

const writeSectionContent = ({
	contentId,
	document,
	values,
}: {
	contentId: string;
	document: SiteDocument;
	values: { ar: JsonObject; en: JsonObject };
}) => {
	(["en", "ar"] as const).forEach((locale) => {
		const localeContent = document.content[locale];

		if (!localeContent) {
			throw new BehaviorSectionError(`Locale "${locale}" has no content`);
		}

		localeContent.sections[contentId] = z.record(z.string().min(1), z.json()).parse(values[locale]);
	});
};

const referencedNamespaceKeys = ({
	namespace,
	root,
}: {
	namespace: SectionContentNamespace;
	root: PersistedSiteNode;
}) => {
	const prefix = `/${namespace}/`;

	const pointers = [
		...listSectionContentReferences({ kind: "text", node: root }),
		...listSectionContentReferences({ kind: "asset", node: root }),
		...listSectionContentReferences({ kind: "link", node: root }),
	].map((reference) => contentReferencePointer({ reference }));

	return new Set(pointers.flatMap((pointer) => (pointer.startsWith(prefix) ? [pointer.slice(prefix.length)] : [])));
};

const cleanupNamespaceContent = ({
	document,
	namespace,
	section,
}: {
	document: SiteDocument;
	namespace: SectionContentNamespace;
	section: SiteSection;
}) => {
	const referenced = referencedNamespaceKeys({ namespace, root: section.root });

	Object.values(document.content).forEach((localeContent) => {
		const sectionContent = jsonObjectSchema.safeParse(localeContent.sections[section.contentId]);

		if (!sectionContent.success) {
			return;
		}

		const map = jsonObjectSchema.safeParse(sectionContent.data[namespace]);

		if (!map.success) {
			return;
		}

		const kept = Object.fromEntries(Object.entries(map.data).filter(([key]) => referenced.has(key)));
		const next = { ...sectionContent.data };

		if (Object.keys(kept).length === 0 && namespace === "behavior") {
			delete next[namespace];
		} else {
			next[namespace] = kept;
		}

		localeContent.sections[section.contentId] = jsonObjectSchema.parse(next);
	});
};

export const composedSectionCategorySchema = z.enum(sectionCategories).exclude(["header", "footer"]);

export const composedSectionAnchorSchema = z
	.string()
	.max(48)
	.regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u, "Use a lowercase kebab-case anchor such as pricing-plans");

const uniqueSectionAnchor = ({ base, document }: { base: string; document: SiteDocument }) => {
	const used = new Set(
		[
			...document.structure.layout.header,
			...document.structure.layout.footer,
			...document.structure.pages.flatMap(({ sections }) => sections),
		].map(({ anchor }) => anchor)
	);

	return (
		[base, ...Array.from({ length: used.size + 1 }, (_, index) => `${base}-${index + 2}`)].find(
			(candidate) => !used.has(candidate)
		) ?? base
	);
};

export const applyComposedSectionAddition = ({
	anchor,
	category = "content",
	document,
	index,
	pageId,
	seed,
	specification,
}: {
	anchor?: string;
	category?: z.infer<typeof composedSectionCategorySchema>;
	document: SiteDocument;
	index: number;
	pageId: string;
	seed: string;
	specification: ComposedSectionSpecification;
}) => {
	const parsed = composedSectionSpecificationSchema.parse(specification);

	requireBilingualDocument(document);

	const next = structuredClone(document);
	const { page } = findPageSection({ document: next, pageId });

	if (index < 0 || index > page.sections.length) {
		throw new BehaviorSectionError(`Insertion index ${index} is out of range for page "${pageId}"`);
	}

	const sectionId = entityIdFromSeed({ seed: `${seed}:section` });
	const contentId = entityIdFromSeed({ seed: `${seed}:content` });

	const section = siteSectionSchema.parse({
		anchor: uniqueSectionAnchor({ base: anchor ?? category, document: next }),
		category,
		contentId,
		id: sectionId,
		root: materializeSectionStructure({ namespace: "copy", sectionId, structure: parsed.structure }),
	});

	if (parsed.logic) {
		next.logic = { ...next.logic, [sectionId]: materializeSectionLogic({ logic: parsed.logic }) };
	}

	page.sections.splice(index, 0, section);

	writeSectionContent({
		contentId,
		document: next,
		values: materializeSectionContent({ content: parsed.content, namespace: "copy" }),
	});

	return next;
};

const requireComposedSection = (section: SiteSection) => {
	if (section.source) {
		throw new BehaviorSectionError(
			`Section "${section.id}" uses the registered pattern "${section.source.pattern}" — structure and content layer updates only apply to composed sections`
		);
	}
};

export const applyComposedStructureUpdate = ({
	content,
	document,
	logic,
	pageId,
	sectionId,
	structure,
}: {
	content?: SectionContent;
	document: SiteDocument;
	logic?: SectionLogic | null;
	pageId: string;
	sectionId: string;
	structure: SectionStructure;
}) => {
	const parsedStructure = sectionStructureSchema.parse(structure);
	const parsedContent = content === undefined ? undefined : sectionContentSchema.parse(content);
	const parsedLogic = logic === undefined || logic === null ? logic : sectionLogicSchema.parse(logic);

	requireBilingualDocument(document);

	const next = structuredClone(document);
	const { section } = findPageSection({ document: next, pageId, sectionId });

	if (!section) {
		throw new BehaviorSectionError(`Section "${sectionId}" is unavailable`);
	}

	requireComposedSection(section);

	const contract = deriveStructureContract(parsedStructure);
	const issues = collectIssues();

	validateStructureFramePadding(parsedStructure, issues.context);

	validateLogicAgainstContract({
		context: issues.context,
		contract,
		logic:
			parsedLogic === undefined
				? (inspectSectionLogic({ document: next, section }) ?? undefined)
				: (parsedLogic ?? undefined),
	});

	if (parsedContent) {
		validateContentAgainstContract({ content: parsedContent, context: issues.context, contract });
		validateStructureLiveness({ content: parsedContent, context: issues.context, structure: parsedStructure });
	} else {
		const existing = inspectSectionContent({ document: next, namespace: "copy", section });

		if (!existing) {
			throw new BehaviorSectionError(`Section "${sectionId}" has no readable content layer`);
		}

		validateContentAgainstContract({ content: existing, context: issues.context, contract, path: ["content"] });
		validateStructureLiveness({ content: existing, context: issues.context, structure: parsedStructure });
	}

	issues.throwIfAny(
		"The structure layer update failed validation — when it changes content keys or bindings, include the matching content layer (or set-section-logic edit) in the same call."
	);

	const root = materializeSectionStructure({ namespace: "copy", sectionId: section.id, structure: parsedStructure });

	if (root.type !== "box") {
		throw new BehaviorSectionError("The structure root must be a box node");
	}

	section.root = root;

	if (parsedContent) {
		writeSectionContent({
			contentId: section.contentId,
			document: next,
			values: materializeSectionContent({ content: parsedContent, namespace: "copy" }),
		});
	}

	if (parsedLogic === null && next.logic) {
		delete next.logic[section.id];
	}

	if (parsedLogic) {
		next.logic = { ...next.logic, [section.id]: materializeSectionLogic({ logic: parsedLogic }) };
	}

	return next;
};

export const applyComposedContentUpdate = ({
	content,
	document,
	pageId,
	sectionId,
}: {
	content: SectionContent;
	document: SiteDocument;
	pageId: string;
	sectionId: string;
}) => {
	const parsedContent = sectionContentSchema.parse(content);

	requireBilingualDocument(document);

	const next = structuredClone(document);
	const { section } = findPageSection({ document: next, pageId, sectionId });

	if (!section) {
		throw new BehaviorSectionError(`Section "${sectionId}" is unavailable`);
	}

	requireComposedSection(section);

	const structure = inspectSectionStructure({ namespace: "copy", section });

	if (!structure) {
		throw new BehaviorSectionError(`Section "${sectionId}" has no readable structure layer`);
	}

	const issues = collectIssues();

	validateContentAgainstContract({
		content: parsedContent,
		context: issues.context,
		contract: deriveStructureContract(structure),
	});

	issues.throwIfAny("The content layer update failed validation — define exactly the keys the structure references.");

	writeSectionContent({
		contentId: section.contentId,
		document: next,
		values: materializeSectionContent({ content: parsedContent, namespace: "copy" }),
	});

	return next;
};

const persistedNodeChildren = (node: PersistedSiteNode): Array<PersistedSiteNode> | undefined =>
	node.type === "action" ||
	node.type === "box" ||
	node.type === "field" ||
	node.type === "flex" ||
	node.type === "grid" ||
	node.type === "trigger" ||
	node.type === "value"
		? node.props.children
		: undefined;

type PersistedSectionInspection = {
	count: number;
	parent?: { depth: number; node: PersistedSiteNode };
};

const inspectPersistedSection = ({ root, targetId }: { root: PersistedSiteNode; targetId: string }) => {
	const keys = new Set<string>();
	const pending = [{ depth: 1, node: root }];
	const result: PersistedSectionInspection = { count: 0 };

	while (pending.length > 0) {
		const current = pending.pop();

		if (!current) {
			continue;
		}

		result.count += 1;
		const identity = structureNodeIdentitySchema.safeParse(current.node);

		if (identity.success) {
			keys.add(identity.data.key);
		}

		if (current.node.id === targetId) {
			result.parent = current;
		}

		[...(persistedNodeChildren(current.node) ?? []), ...persistedCollectionChildren(current.node)].forEach((node) =>
			pending.push({ depth: current.depth + 1, node })
		);
	}

	return { ...result, keys };
};

const sectionStructureDepth = (structure: SectionStructure) => {
	const nodes = new Map(structure.nodes.map((node) => [node.key, node]));

	const depthFrom = ({ depth, key }: { depth: number; key: string }): number => {
		const node = nodes.get(key);

		return node
			? node.children.reduce(
					(maximum, childKey) => Math.max(maximum, depthFrom({ depth: depth + 1, key: childKey })),
					depth
				)
			: 0;
	};

	return depthFrom({ depth: 1, key: structure.root });
};

const rewriteNodeTree = ({
	omitKeys,
	pruneEmptyKeyedContainers = false,
	remove,
	value,
}: {
	omitKeys?: Set<string>;
	pruneEmptyKeyedContainers?: boolean;
	remove: (node: { id: string; type: string }) => boolean;
	value: JsonValue;
}): JsonValue => {
	if (Array.isArray(value)) {
		return value.flatMap((item) => {
			const rewritten = rewriteNodeTree({ omitKeys, pruneEmptyKeyedContainers, remove, value: item });
			const node = nodeIdentitySchema.safeParse(rewritten);

			if (node.success && remove(node.data)) {
				return [];
			}

			if (!pruneEmptyKeyedContainers) {
				return [rewritten];
			}

			const container = keyedContainerSchema.safeParse(rewritten);

			const isEmptyKeyedContainer = container.success && container.data.props.children.length === 0;

			return isEmptyKeyedContainer ? [] : [rewritten];
		});
	}

	const object = jsonObjectSchema.safeParse(value);

	if (!object.success) {
		return value;
	}

	return Object.fromEntries(
		Object.entries(object.data).flatMap(([key, child]) =>
			omitKeys?.has(key)
				? []
				: [[key, rewriteNodeTree({ omitKeys, pruneEmptyKeyedContainers, remove, value: child })]]
		)
	);
};

const applyLogicBindings = ({
	bindings,
	namespace,
	section,
}: {
	bindings: SectionLogicBindings;
	namespace: SectionContentNamespace;
	section: SiteSection;
}) => {
	if (bindings.remove) {
		const ids = new Set(bindings.remove);

		if (ids.has(section.root.id)) {
			throw new BehaviorSectionError("The section root cannot be removed");
		}

		const nextRoot = siteNodeSchema.parse(
			rewriteNodeTree({ remove: ({ id }) => ids.has(id), value: section.root })
		);

		if (nextRoot.type !== "box") {
			throw new BehaviorSectionError("The section root must stay a box node");
		}

		section.root = nextRoot;
	}

	bindings.insert?.forEach(({ index, parentNodeId, structure }) => {
		const inspected = inspectPersistedSection({ root: section.root, targetId: parentNodeId });
		const collidingKeys = structure.nodes.map(({ key }) => key).filter((key) => inspected.keys.has(key));

		if (collidingKeys.length > 0) {
			throw new BehaviorSectionError(
				`Inserted node keys already exist in the section: ${collidingKeys.join(", ")} — pick new keys or remove the existing nodes`
			);
		}

		const parentResult = inspected.parent;

		if (!parentResult || parentResult.node.type === "text") {
			throw new BehaviorSectionError(
				`Container node "${parentNodeId}" is unavailable — target an inspected box, flex, grid, trigger, field, or value node id`
			);
		}

		const parent = parentResult.node;
		const children = persistedNodeChildren(parent);

		if (!children) {
			throw new BehaviorSectionError(`Node "${parentNodeId}" cannot hold children`);
		}

		if (parentResult.depth + sectionStructureDepth(structure) > siteDocumentResourceLimits.nodeDepth) {
			throw new BehaviorSectionError(
				`Inserted structure exceeds the section node depth limit of ${siteDocumentResourceLimits.nodeDepth}`
			);
		}

		if (inspected.count + structure.nodes.length > siteDocumentResourceLimits.sectionNodes) {
			throw new BehaviorSectionError(
				`Inserted structure exceeds the section node limit of ${siteDocumentResourceLimits.sectionNodes}`
			);
		}

		const subtree = materializeSectionStructure({
			namespace,
			requireBoxRoot: false,
			sectionId: section.id,
			structure,
		});

		const insertionIndex = index === undefined ? children.length : index;

		if (insertionIndex < 0 || insertionIndex > children.length) {
			throw new BehaviorSectionError(
				`Insertion index ${insertionIndex} is out of range for node "${parentNodeId}"`
			);
		}

		children.splice(insertionIndex, 0, subtree);
	});
};

export const applySectionLogic = ({
	bindings,
	content,
	document,
	logic,
	pageId,
	sectionId,
}: {
	bindings?: SectionLogicBindings;
	content?: SectionContent;
	document: SiteDocument;
	logic: SectionLogic;
	pageId: string;
	sectionId: string;
}) => {
	const parsedLogic = sectionLogicSchema.parse(logic);
	const parsedBindings = bindings === undefined ? undefined : sectionLogicBindingsSchema.parse(bindings);
	const parsedContent = content === undefined ? undefined : sectionContentSchema.parse(content);

	requireBilingualDocument(document);

	const next = structuredClone(document);
	const { section } = findPageSection({ document: next, pageId, sectionId });

	if (!section) {
		throw new BehaviorSectionError(`Section "${sectionId}" is unavailable`);
	}

	const namespace = sectionContentNamespace(section);

	if (parsedContent) {
		(["en", "ar"] as const).forEach((locale) => {
			const localeContent = next.content[locale];

			if (!localeContent) {
				throw new BehaviorSectionError(`Locale "${locale}" has no content`);
			}

			const existing = jsonObjectSchema.safeParse(localeContent.sections[section.contentId]);
			const existingMap = existing.success ? jsonObjectSchema.safeParse(existing.data[namespace]) : undefined;
			const nextContent = existing.success ? { ...existing.data } : {};
			const nextNamespace = existingMap?.success ? { ...existingMap.data } : {};

			Object.assign(nextNamespace, parsedContent[locale]);
			nextContent[namespace] = nextNamespace;
			localeContent.sections[section.contentId] = jsonObjectSchema.parse(nextContent);
		});
	}

	if (parsedBindings) {
		applyLogicBindings({ bindings: parsedBindings, namespace, section });
	}

	next.logic = { ...next.logic, [section.id]: materializeSectionLogic({ logic: parsedLogic }) };
	cleanupNamespaceContent({ document: next, namespace, section });

	return next;
};

export const applySectionLogicRemoval = ({
	document,
	pageId,
	sectionId,
}: {
	document: SiteDocument;
	pageId: string;
	sectionId: string;
}) => {
	const next = structuredClone(document);
	const { section } = findPageSection({ document: next, pageId, sectionId });

	if (!section) {
		throw new BehaviorSectionError(`Section "${sectionId}" is unavailable`);
	}

	if (!next.logic?.[sectionId]) {
		throw new BehaviorSectionError(`Section "${sectionId}" has no logic layer to remove`);
	}

	const { [sectionId]: _removed, ...remainingLogic } = next.logic;
	next.logic = remainingLogic;

	const nextRoot = siteNodeSchema.parse(
		rewriteNodeTree({
			omitKeys: new Set(["disabledWhen", "visibleWhen"]),
			pruneEmptyKeyedContainers: Boolean(section.source),
			remove: ({ type }) => type === "field" || type === "trigger" || type === "value",
			value: section.root,
		})
	);

	if (nextRoot.type !== "box") {
		throw new BehaviorSectionError("The section root must stay a box node");
	}

	section.root = nextRoot;
	cleanupNamespaceContent({ document: next, namespace: sectionContentNamespace(section), section });

	return next;
};
