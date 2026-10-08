import { z } from "zod";

import {
	contentReferenceSchema,
	isJsonObject,
	linkValueSchema,
	type JsonObject,
	type JsonValue,
} from "../document/content-schema";
import type { SiteDocument } from "../document/site-document-schema";
import type { PersistedSiteNode, SiteSection } from "../document/structure-schema";
import {
	authoringCarouselProps,
	authoringDisclosureProps,
	authoringEmbedProps,
	authoringTabsProps,
	collectionItemKey,
	collectionMatchesRuntime,
	isCollectionNode as isCollectionStructureNode,
	persistedCollectionChildren,
	plainJsonObject,
	type RuntimeItem,
} from "./collection-nodes";
import { contentKeyPointer, sectionContentNamespace, type SectionContentNamespace } from "./materialize";
import {
	contentKeySchema,
	deriveStructureContract,
	sectionContentReferenceProps,
	sectionContentSchema,
	sectionLogicAuthoringSchema,
	sectionStructureNodeSchema,
	sectionStructureNodeTypeSchema,
	sectionStructureSchema,
	type SectionContent,
	type SectionLogicAuthoring,
	type SectionStructure,
	type SectionStructureNode,
} from "./specification";

const settingReferenceMarkerSchema = z.compile(z.object({ $setting: z.unknown() }));

type InspectableSiteNode = Extract<PersistedSiteNode, { type: z.infer<typeof sectionStructureNodeTypeSchema> }>;

const flatContentKey = ({
	kind,
	namespace,
	reference,
}: {
	kind: "asset" | "link" | "text";
	namespace: SectionContentNamespace;
	reference: unknown;
}): string | null => {
	const parsed = z.object({ [`$${kind}`]: z.string() }).safeParse(reference);

	if (!parsed.success) {
		return null;
	}

	const prefix = `/${namespace}/`;
	const pointer = parsed.data[`$${kind}`];

	if (!pointer.startsWith(prefix)) {
		return null;
	}

	const key = pointer.slice(prefix.length);

	return contentKeySchema.safeParse(key).success && pointer === contentKeyPointer({ key, namespace }) ? key : null;
};

const isInspectableSiteNode = (node: PersistedSiteNode): node is InspectableSiteNode =>
	sectionStructureNodeTypeSchema.safeParse(node.type).success;

const isCollectionRuntimeNode = (
	node: InspectableSiteNode
): node is Extract<InspectableSiteNode, { type: "carousel" | "disclosure" | "embed" | "tabs" }> =>
	node.type === "carousel" || node.type === "disclosure" || node.type === "embed" || node.type === "tabs";

const collectionAuthoringProps = ({
	contentKeyFor,
	namespace,
	node,
}: {
	contentKeyFor: typeof flatContentKey;
	namespace: SectionContentNamespace;
	node: Extract<InspectableSiteNode, { type: "carousel" | "disclosure" | "embed" | "tabs" }>;
}): JsonObject => {
	const key = (reference: JsonValue | undefined) => contentKeyFor({ kind: "text", namespace, reference });
	const props = plainJsonObject(node.props);

	switch (node.type) {
		case "carousel":
			return authoringCarouselProps({ key, props });
		case "disclosure":
			return authoringDisclosureProps({ props });
		case "embed":
			return authoringEmbedProps({ key, props });
		case "tabs":
			return authoringTabsProps({ key, props });
	}
};

const authoringProp = ({
	contentKeyFor,
	name,
	namespace,
	node,
	value,
}: {
	contentKeyFor: typeof flatContentKey;
	name: string;
	namespace: SectionContentNamespace;
	node: InspectableSiteNode;
	value: JsonValue;
}) => {
	const contentReferences: Partial<Record<string, "asset" | "link" | "text">> =
		sectionContentReferenceProps[node.type];

	const authoredName = node.type === "media" && name === "assetId" ? "asset" : name;
	const normalizedName = node.type === "action" && authoredName === "href" ? "link" : authoredName;
	const referenceKind = contentReferences[normalizedName];

	if (referenceKind) {
		const contentKey = contentKeyFor({ kind: referenceKind, namespace, reference: value });

		return contentKey === null ? undefined : { name: normalizedName, value: contentKey };
	}

	if (node.type === "value" && name === "value") {
		return { name: "output", value };
	}

	if (node.type === "value" && name === "format" && settingReferenceMarkerSchema.safeParse(value).success) {
		return undefined;
	}

	return { name, value };
};

const authoringNodeProps = ({
	contentKeyFor,
	namespace,
	node,
	tolerant = false,
}: {
	contentKeyFor: typeof flatContentKey;
	namespace: SectionContentNamespace;
	node: InspectableSiteNode;
	tolerant?: boolean;
}): JsonObject | null => {
	const props: JsonObject = {};

	if (node.visibleWhen) {
		props.visibleWhen = node.visibleWhen;
	}

	if (isCollectionRuntimeNode(node)) {
		const authored = collectionAuthoringProps({ contentKeyFor, namespace, node });

		return authored && { ...props, ...authored };
	}

	for (const [name, value] of Object.entries(node.props)) {
		if (name === "children") {
			continue;
		}

		const prop = authoringProp({ contentKeyFor, name, namespace, node, value });

		if (prop) {
			props[prop.name] = prop.value;
		} else if (!tolerant) {
			return null;
		}
	}

	return props;
};

type ReferenceContentIds = Map<string, Map<string, number>>;

const referenceContentKey =
	(ids: ReferenceContentIds): typeof flatContentKey =>
	({ kind, reference }) => {
		const pointer = z.object({ [`$${kind}`]: z.string() }).safeParse(reference).data?.[`$${kind}`];
		const segments = pointer?.replace(/^\/copy\//u, "").split("/") ?? [];

		const key = segments
			.map((segment, index) => {
				if (segments[index - 1] !== "items") {
					return segment;
				}

				const prefix = segments.slice(0, index).join("/");
				const seen = ids.get(prefix) ?? new Map<string, number>();
				ids.set(prefix, seen);
				seen.set(segment, seen.get(segment) ?? seen.size + 1);

				return String(seen.get(segment));
			})
			.join("-")
			.replaceAll(/([a-z0-9])([A-Z])/gu, "$1-$2")
			.toLowerCase()
			.replaceAll(/[^a-z0-9]+/gu, "-")
			.replaceAll(/^-+|-+$/gu, "")
			.slice(0, 64);

		return key && contentKeySchema.safeParse(key).success ? key : null;
	};

const flattenNode = ({
	contentKeyFor = flatContentKey,
	keyFor = ({ key }) => key,
	namespace,
	node,
	nodes,
}: {
	contentKeyFor?: typeof flatContentKey;
	keyFor?: (node: InspectableSiteNode) => string | undefined;
	namespace: SectionContentNamespace;
	node: PersistedSiteNode;
	nodes: Array<SectionStructureNode>;
}): string | null => {
	if (!isInspectableSiteNode(node)) {
		return null;
	}

	const key = keyFor(node);

	if (!key) {
		return null;
	}

	const props = authoringNodeProps({ contentKeyFor, namespace, node });

	if (props === null) {
		return null;
	}

	const children: Array<string> = [];
	const descendants: Array<SectionStructureNode> = [];
	const items: Array<RuntimeItem> = [];

	const flattenChild = (child: PersistedSiteNode, target: Array<SectionStructureNode>) =>
		flattenNode({ contentKeyFor, keyFor, namespace, node: child, nodes: target });

	if (node.type === "carousel") {
		for (const slide of node.props.slides) {
			const slideKey = flattenChild(slide, descendants);

			if (slideKey === null) {
				return null;
			}

			children.push(slideKey);
		}
	} else if (node.type === "tabs" || node.type === "disclosure") {
		for (const [index, item] of node.props.items.entries()) {
			const [trigger, ...extraTrigger] = item.trigger;
			const [panel, ...extraPanel] = item.panel;

			if (!trigger || !panel || extraTrigger.length > 0 || extraPanel.length > 0) {
				return null;
			}

			const itemKey = collectionItemKey({
				index,
				parent: key,
				value: "value" in item ? z.string().safeParse(item.value).data : undefined,
			});

			const itemDescendants: Array<SectionStructureNode> = [];
			const triggerKey = flattenChild(trigger, itemDescendants);
			const panelKey = flattenChild(panel, itemDescendants);

			if (triggerKey === null || panelKey === null) {
				return null;
			}

			descendants.push(
				{ children: [triggerKey, panelKey], key: itemKey, props: {}, type: "item" },
				...itemDescendants
			);
			children.push(itemKey);
			items.push({
				id: item.id,
				key: itemKey,
				panel: [plainJsonObject(panel)],
				trigger: [plainJsonObject(trigger)],
			});
		}
	} else {
		for (const child of childNodesOf(node)) {
			const childKey = flattenChild(child, descendants);

			if (childKey === null) {
				return null;
			}

			children.push(childKey);
		}
	}

	const flattened = sectionStructureNodeSchema.safeParse({
		children,
		key,
		props: { ...node.layout, ...props },
		type: node.type,
	});

	if (!flattened.success) {
		return null;
	}

	if (
		isCollectionRuntimeNode(node) &&
		!isStrictCollectionExact({ items, namespace, node, structure: flattened.data })
	) {
		return null;
	}

	nodes.push(flattened.data, ...descendants);

	return key;
};

const isStrictCollectionExact = ({
	items,
	namespace,
	node,
	structure,
}: {
	items: Array<RuntimeItem>;
	namespace: SectionContentNamespace;
	node: Extract<InspectableSiteNode, { type: "carousel" | "disclosure" | "embed" | "tabs" }>;
	structure: SectionStructureNode;
}) =>
	isCollectionStructureNode(structure) &&
	collectionMatchesRuntime({
		items,
		node: structure,
		original: plainJsonObject(node.props),
		ref: (key) => ({ $text: contentKeyPointer({ key, namespace }) }),
		slides: node.type === "carousel" ? node.props.slides.map((slide) => plainJsonObject(slide)) : [],
	});

export const inspectSectionStructure = ({
	section,
	namespace = sectionContentNamespace(section),
}: {
	namespace?: SectionContentNamespace;
	section: SiteSection;
}): SectionStructure | null => {
	const nodes: Array<SectionStructureNode> = [];
	const root = flattenNode({ namespace, node: section.root, nodes });

	if (root === null) {
		return null;
	}

	const parsed = sectionStructureSchema.safeParse({ nodes, root });

	return parsed.success ? parsed.data : null;
};

export type SectionReferenceNode =
	| SectionStructureNode
	| { children: []; key: string; props: { summary: string }; type: "unsupported" };

export type SectionReference = { nodes: Array<SectionReferenceNode>; notes: Array<string>; root: string };

const referenceRepeatLimits = [3, 2, 1];

const referenceBudgetCharacters = 7000;

const maxReferencePropRepairs = 12;

const responsiveKeys = new Set(["base", "compact", "medium", "wide"]);

const unsupportedEntryNames = new Map<string, string>([
	["carousel", "slides"],
	["disclosure", "items"],
	["masonry", "children"],
	["menu", "items"],
	["tabs", "items"],
]);

const countOf = (value: JsonValue | undefined) => (Array.isArray(value) ? value.length : 0);

const describeUnsupportedNode = (node: PersistedSiteNode) => {
	const props: JsonObject = node.props;
	const size = countOf(props.slides) || countOf(props.items) || countOf(props.children);
	const provider = z.string().safeParse(props.provider).data;

	const features = [
		[props.autoplay !== undefined, "autoplay"],
		[props.marquee !== undefined, "marquee"],
		[props.edgeFade !== undefined, "edge fade"],
		[countOf(props.controlGroups) > 0, "controls"],
		[countOf(props.decorations) > 0, "progress decorations"],
	].flatMap(([enabled, label]) => (enabled ? [label] : []));

	return [
		provider ? `${provider} ${node.type}` : node.type,
		size > 0 ? `of ${size} ${unsupportedEntryNames.get(node.type) ?? "entries"}` : "",
		features.length > 0 ? `with ${features.join(", ")}` : "",
	]
		.filter(Boolean)
		.join(" ");
};

const childNodesOf = (node: PersistedSiteNode) =>
	isInspectableSiteNode(node) &&
	node.type !== "text" &&
	node.type !== "media" &&
	node.type !== "icon" &&
	!isCollectionRuntimeNode(node)
		? node.props.children
		: [];

const containedNodesOf = (node: PersistedSiteNode): Array<PersistedSiteNode> => [
	...persistedCollectionChildren(node),
	...childNodesOf(node),
];

const skeletonOf = (node: PersistedSiteNode): string => {
	const children = containedNodesOf(node);

	return children.length > 0 ? `${node.type}[${children.map(skeletonOf).join(",")}]` : node.type;
};

const repeatSignature = (node: PersistedSiteNode) => {
	const skeleton = skeletonOf(node);

	if (skeleton.includes("[")) {
		return skeleton;
	}

	return JSON.stringify(node, (name, value) => {
		if (name === "id" || name === "key") {
			return undefined;
		}

		return contentReferenceSchema.safeParse(value).success ? "ref" : value;
	});
};

const capRepeatedChildren = <Entry>({
	children,
	limit,
	signature: signatureOf,
}: {
	children: Array<Entry>;
	limit: number;
	signature: (entry: Entry) => string;
}) => {
	const seen = new Map<string, number>();

	const kept = children.filter((child) => {
		const signature = signatureOf(child);
		const count = (seen.get(signature) ?? 0) + 1;
		seen.set(signature, count);

		return count <= limit;
	});

	return { kept, skipped: children.length - kept.length };
};

const collapseResponsive = (value: JsonValue | undefined): JsonValue | undefined => {
	if (Array.isArray(value)) {
		return value.map((item) => collapseResponsive(item) ?? null);
	}

	if (!isJsonObject(value)) {
		return value;
	}

	const entries = Object.entries(value).map(([name, child]): [string, JsonValue | undefined] => [
		name,
		collapseResponsive(child),
	]);

	const first = entries[0]?.[1];

	const uniform =
		entries.length > 0 &&
		entries.every(([name, child]) => responsiveKeys.has(name) && JSON.stringify(child) === JSON.stringify(first));

	return uniform ? first : Object.fromEntries(entries);
};

const coarsenGridTracks = (value: JsonValue | undefined): JsonValue | undefined => {
	if (Array.isArray(value)) {
		return Math.min(Math.max(value.length, 1), 12);
	}

	return isJsonObject(value)
		? Object.fromEntries(Object.entries(value).map(([name, child]) => [name, coarsenGridTracks(child)]))
		: value;
};

const droppableProps = ({
	issues,
}: {
	issues: ReadonlyArray<{ keys?: Array<string>; path: ReadonlyArray<unknown> }>;
}) =>
	issues.flatMap(({ keys, path }) => {
		if (path[0] !== "props") {
			return [];
		}

		const name = z.string().safeParse(path[1]).data;

		return keys ?? (name ? [name] : []);
	});

const repairReferenceProps = ({
	authored,
	drops,
	type,
}: {
	authored: JsonObject;
	drops: Set<string>;
	type: string;
}): JsonObject =>
	Object.fromEntries(
		Object.entries(authored).flatMap(([name, value]) => {
			if (!drops.has(name)) {
				return [[name, value]];
			}

			const coarsened =
				type === "grid" && (name === "columns" || name === "rows") ? coarsenGridTracks(value) : value;

			return JSON.stringify(coarsened) === JSON.stringify(value) ? [] : [[name, coarsened]];
		})
	);

type ReferenceState = {
	contentKeyFor: typeof flatContentKey;
	counts: Map<string, number>;
	limit: number;
	notes: Array<string>;
};

const validateReferenceNode = ({
	attempt = 0,
	authored,
	children,
	key,
	type,
}: {
	attempt?: number;
	authored: JsonObject;
	children: Array<string>;
	key: string;
	type: string;
}): SectionStructureNode | null => {
	const parsed = sectionStructureNodeSchema.safeParse({
		children,
		key,
		props: collapseResponsive(authored),
		type,
	});

	if (parsed.success) {
		return parsed.data;
	}

	const drops = new Set(droppableProps({ issues: parsed.error.issues }).filter((name) => name in authored));

	return drops.size === 0 || attempt >= maxReferencePropRepairs
		? null
		: validateReferenceNode({
				attempt: attempt + 1,
				authored: repairReferenceProps({ authored, drops, type }),
				children,
				key,
				type,
			});
};

const flattenReferenceNode = ({
	node,
	nodes,
	state,
}: {
	node: PersistedSiteNode;
	nodes: Array<SectionReferenceNode>;
	state: ReferenceState;
}): string => {
	const count = (state.counts.get(node.type) ?? 0) + 1;
	state.counts.set(node.type, count);
	const key = `${node.type}-${count}`;

	const stub = () => {
		nodes.push({ children: [], key, props: { summary: describeUnsupportedNode(node) }, type: "unsupported" });

		return key;
	};

	if (!isInspectableSiteNode(node)) {
		return stub();
	}

	const props = authoringNodeProps({
		contentKeyFor: state.contentKeyFor,
		namespace: "copy",
		node,
		tolerant: true,
	});

	const descendants: Array<SectionReferenceNode> = [];

	const note = ({ kept, skipped }: { kept: Array<unknown>; skipped: number }) => {
		if (skipped > 0) {
			state.notes.push(
				`${key} has ${kept.length + skipped} similar children; the first ${kept.length} are shown`
			);
		}
	};

	const children = (() => {
		if (node.type === "tabs" || node.type === "disclosure") {
			const capped = capRepeatedChildren({
				children: node.props.items,
				limit: state.limit,
				signature: (item) => [...item.trigger, ...item.panel].map(repeatSignature).join("|"),
			});

			note(capped);

			return capped.kept.map((item) => flattenReferenceItem({ item, nodes: descendants, state }));
		}

		const capped = capRepeatedChildren({
			children: node.type === "carousel" ? node.props.slides : childNodesOf(node),
			limit: state.limit,
			signature: repeatSignature,
		});

		note(capped);

		return capped.kept.map((child) => flattenReferenceNode({ node: child, nodes: descendants, state }));
	})();

	const flattened = props
		? validateReferenceNode({ authored: { ...node.layout, ...props }, children, key, type: node.type })
		: null;

	if (!flattened) {
		return stub();
	}

	nodes.push(flattened, ...descendants);

	return key;
};

const flattenReferenceSlot = ({
	list,
	nodes,
	state,
}: {
	list: Array<PersistedSiteNode>;
	nodes: Array<SectionReferenceNode>;
	state: ReferenceState;
}): string => {
	const [only, ...rest] = list;

	if (only && rest.length === 0) {
		return flattenReferenceNode({ node: only, nodes, state });
	}

	const type = list.length === 0 ? "box" : "flex";
	const count = (state.counts.get(type) ?? 0) + 1;
	state.counts.set(type, count);
	const key = `${type}-${count}`;
	const descendants: Array<SectionReferenceNode> = [];
	const children = list.map((node) => flattenReferenceNode({ node, nodes: descendants, state }));
	nodes.push(
		type === "box" ? { children, key, props: {}, type } : { children, key, props: { direction: "column" }, type },
		...descendants
	);

	return key;
};

const flattenReferenceItem = ({
	item,
	nodes,
	state,
}: {
	item: { panel: Array<PersistedSiteNode>; trigger: Array<PersistedSiteNode> };
	nodes: Array<SectionReferenceNode>;
	state: ReferenceState;
}): string => {
	const count = (state.counts.get("item") ?? 0) + 1;
	state.counts.set("item", count);
	const key = `item-${count}`;
	const descendants: Array<SectionReferenceNode> = [];
	const trigger = flattenReferenceSlot({ list: item.trigger, nodes: descendants, state });
	const panel = flattenReferenceSlot({ list: item.panel, nodes: descendants, state });
	nodes.push({ children: [trigger, panel], key, props: {}, type: "item" }, ...descendants);

	return key;
};

const buildSectionReference = ({ limit, section }: { limit: number; section: SiteSection }): SectionReference => {
	const nodes: Array<SectionReferenceNode> = [];

	const state: ReferenceState = {
		contentKeyFor: referenceContentKey(new Map()),
		counts: new Map(),
		limit,
		notes: [],
	};

	const root = flattenReferenceNode({ node: section.root, nodes, state });

	return { nodes, notes: state.notes, root };
};

export const inspectSectionReference = ({ section }: { section: SiteSection }): SectionReference => {
	const references = referenceRepeatLimits.map((limit) => buildSectionReference({ limit, section }));

	return (
		references.find((reference) => JSON.stringify(reference).length <= referenceBudgetCharacters) ??
		buildSectionReference({ limit: 1, section })
	);
};

export const inspectSectionLogic = ({
	document,
	section,
}: {
	document: SiteDocument;
	section: SiteSection;
}): SectionLogicAuthoring | null => {
	const program = document.logic?.[section.id];

	if (!program) {
		return null;
	}

	const fields = program.slots.map((slot) => ({ initial: slot.initial, key: slot.key }));

	const logic: SectionLogicAuthoring = (() => {
		if (program.expressionProfile === "site-expression-v1") {
			return { expression: program.source, fields, kind: "expression" };
		}

		if (program.expressionProfile === "site-expression-v2") {
			return {
				events: program.events,
				fields,
				kind: "expression",
				outputs: Object.fromEntries(
					Object.entries(program.outputs).map(([key, output]) => [
						key,
						{ expression: output.source, type: output.type },
					])
				),
			};
		}

		return {
			events: program.events,
			fields,
			kind: "script",
			outputs: program.outputs,
			script: program.script,
		};
	})();

	const parsed = sectionLogicAuthoringSchema.safeParse(logic);

	return parsed.success ? parsed.data : null;
};

const readNamespaceContent = ({
	document,
	locale,
	namespace,
	section,
}: {
	document: SiteDocument;
	locale: "ar" | "en";
	namespace: SectionContentNamespace;
	section: SiteSection;
}) => {
	const sectionContent = document.content[locale]?.sections[section.contentId];
	const parsed = z.object({ [namespace]: z.record(contentKeySchema, z.json()) }).safeParse(sectionContent);

	return parsed.success ? parsed.data[namespace] : null;
};

export const inspectSectionContent = ({
	document,
	section,
	namespace = sectionContentNamespace(section),
}: {
	document: SiteDocument;
	namespace?: SectionContentNamespace;
	section: SiteSection;
}): SectionContent | null => {
	const en = readNamespaceContent({ document, locale: "en", namespace, section });
	const ar = readNamespaceContent({ document, locale: "ar", namespace, section });

	if (!en || !ar) {
		return null;
	}

	const structure = inspectSectionStructure({ namespace, section });

	if (!structure) {
		return null;
	}

	const contract = deriveStructureContract(structure);
	const textSchema = z.string().min(1).max(20_000);
	const assetSchema = z.uuid();
	const enText: Record<string, string> = {};
	const arText: Record<string, string> = {};
	const assets: Record<string, string> = {};
	const links: Record<string, z.infer<typeof linkValueSchema>> = {};

	for (const key of contract.contentKeys) {
		const enValue = textSchema.safeParse(en[key]);
		const arValue = textSchema.safeParse(ar[key]);

		if (!enValue.success || !arValue.success) {
			return null;
		}

		enText[key] = enValue.data;
		arText[key] = arValue.data;
	}

	for (const key of contract.assetKeys) {
		const enValue = assetSchema.safeParse(en[key]);
		const arValue = assetSchema.safeParse(ar[key]);

		if (!enValue.success || !arValue.success || enValue.data !== arValue.data) {
			return null;
		}

		assets[key] = enValue.data;
	}

	for (const key of contract.linkKeys) {
		const enValue = linkValueSchema.safeParse(en[key]);
		const arValue = linkValueSchema.safeParse(ar[key]);

		if (!enValue.success || !arValue.success || JSON.stringify(enValue.data) !== JSON.stringify(arValue.data)) {
			return null;
		}

		links[key] = enValue.data;
	}

	const content: z.input<typeof sectionContentSchema> = { ar: arText, en: enText };

	if (Object.keys(assets).length > 0) {
		content.assets = assets;
	}

	if (Object.keys(links).length > 0) {
		content.links = links;
	}

	const parsed = sectionContentSchema.safeParse(content);

	return parsed.success ? parsed.data : null;
};

export type ComposedSectionInspection = {
	content: SectionContent;
	logic: SectionLogicAuthoring | null;
	structure: SectionStructure;
};

export const inspectComposedSection = ({
	document,
	section,
}: {
	document: SiteDocument;
	section: SiteSection;
}): ComposedSectionInspection | null => {
	if (section.source) {
		return null;
	}

	const structure = inspectSectionStructure({ namespace: "copy", section });
	const content = inspectSectionContent({ document, namespace: "copy", section });

	if (!structure || !content) {
		return null;
	}

	return { content, logic: inspectSectionLogic({ document, section }), structure };
};
