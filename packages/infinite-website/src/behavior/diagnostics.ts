import { z } from "zod";

import { isJsonObject, stringValueSchema, type JsonValue } from "../document/content-schema";
import { pixelLengthSchema } from "../document/structure-schema";
import type { ComposedSectionSpecification, SectionStructureNode } from "./specification";

export const sectionDiagnosticRules = {
	"column-overflow": {
		fix: 'Set columns to { base: 1, compact: 2 } (at most 2 at base and 4 at compact), or stack flex rows with direction { base: "column", compact: "row" } or wrap: "wrap".',
		severity: "blocking",
	},
	"copy-budget": {
		fix: "Shorten the copy to the heading or body budget and move supporting detail into another text node.",
		severity: "blocking",
	},
	"excessive-section-spacing": {
		fix: 'Reduce the root block padding to at most 16sp for interactive sections and 32sp otherwise, for example "12sp".',
		severity: "soft",
	},
	"heading-level-skip": {
		fix: "Use consecutive heading levels: h2 for the section heading, then h3, never skipping a level.",
		severity: "blocking",
	},
	"language-mismatch": {
		fix: "Write the English value in English and the Arabic value in Arabic for this copy key.",
		severity: "blocking",
	},
	"media-alt-generic": {
		fix: "Rewrite the alt copy to describe what the image shows, in both locales.",
		severity: "soft",
	},
	"multiple-h1": {
		fix: "Keep one h1 at most and change the other headings to h2 or h3.",
		severity: "blocking",
	},
	"off-scale-spacing": {
		fix: 'Express every padding, margin, and gap in sp, such as "6sp" or "12sp", instead of px, rem, em, or bare numbers.',
		severity: "soft",
	},
	"on-fill-tone": {
		fix: 'Match the tone to the fill: action fill uses tone "action", accent fill "accent", featured fill "featured", black fill "media"; or omit the tone.',
		severity: "soft",
	},
	"overflow-prone-size": {
		fix: 'Replace the base inline size with a responsive or smaller value such as maxInlineSize "240sp" or "100%".',
		severity: "blocking",
	},
	"overlapping-copy": {
		fix: "Rewrite one of the two copy values so it adds new information instead of restating the other.",
		severity: "soft",
	},
	"readable-width": {
		fix: 'Set maxInlineSize (for example "36rem") on this text node or on an ancestor.',
		severity: "soft",
	},
	"repeated-copy": {
		fix: "Rewrite the repeated copy so each key says something different, or remove the duplicate node.",
		severity: "soft",
	},
	"repeated-facts": {
		fix: "State each numeric fact once and rewrite the other copy without repeating it.",
		severity: "soft",
	},
	"repeated-structure": {
		fix: "Reduce the repeated identical blocks to at most 5, or vary their structure.",
		severity: "soft",
	},
	"stretch-prone-field": {
		fix: 'Set align to "start" on the named parent so the field keeps its natural height.',
		severity: "soft",
	},
	"unprotected-media-text": {
		fix: 'Add overlay { kind: "scrim", strength: "medium" } to the media node, or set tone "media" on the text over it.',
		severity: "soft",
	},
	"value-hierarchy": {
		fix: 'Keep exactly one value without emphasis and set emphasis "secondary" on the others.',
		severity: "blocking",
	},
} as const;

export const sectionDiagnosticCodes = Object.keys(sectionDiagnosticRules).filter(
	(code): code is keyof typeof sectionDiagnosticRules => Object.hasOwn(sectionDiagnosticRules, code)
);

export type SectionDiagnosticCode = keyof typeof sectionDiagnosticRules;

export type SectionDiagnosticSeverity = (typeof sectionDiagnosticRules)[SectionDiagnosticCode]["severity"];

export type SectionDiagnostic = {
	code: SectionDiagnosticCode;
	contentKeys: Array<string>;
	fix: string;
	message: string;
	nodeKeys: Array<string>;
	severity: SectionDiagnosticSeverity;
};

const headingElements = new Map([
	["h1", 1],
	["h2", 2],
	["h3", 3],
	["h4", 4],
]);

const diagnosticLimits = {
	bodyCopyCharacters: 2000,
	headingCopyCharacters: 100,
	longFormCharacters: 300,
	maximumInlinePixels: 1440,
	maximumMinimumInlinePixels: 768,
	maximumRepeatedSiblings: 5,
	maximumSectionBlockPaddingPixels: 192,
	maximumUtilityBlockPaddingPixels: 96,
	repeatedCopyCharacters: 20,
} as const;

const spacingUnitPixels = 6;

const multipleGridColumnsSchema = z.compile(z.union([z.number().int().min(2), z.array(z.json()).min(2)]));

const relativeLengthSchema = z.compile(z.string().regex(/^\d+(?:\.\d+)?(?:em|rem)$/u));

const diagnostic = ({
	code,
	contentKeys = [],
	message,
	nodeKeys = [],
}: Pick<SectionDiagnostic, "code" | "message"> &
	Partial<Pick<SectionDiagnostic, "contentKeys" | "nodeKeys">>): SectionDiagnostic => ({
	code,
	contentKeys,
	fix: sectionDiagnosticRules[code].fix,
	message,
	nodeKeys,
	severity: sectionDiagnosticRules[code].severity,
});

const walkStructure = ({ nodes, root }: Pick<ComposedSectionSpecification["structure"], "nodes" | "root">) => {
	const nodesByKey = new Map(nodes.map((node) => [node.key, node]));
	const ordered: Array<SectionStructureNode> = [];
	const parents = new Map<string, string>();
	const visited = new Set<string>();

	const visit = (key: string) => {
		const node = nodesByKey.get(key);

		if (!node || visited.has(key)) {
			return;
		}

		visited.add(key);
		ordered.push(node);
		node.children.forEach((child) => {
			parents.set(child, key);
			visit(child);
		});
	};

	visit(root);

	return { nodesByKey, ordered, parents };
};

const baseValue = (value: JsonValue | undefined): JsonValue | undefined => {
	return isJsonObject(value) && Object.hasOwn(value, "base") ? value.base : value;
};

const pixelLength = (value: JsonValue | undefined) => {
	const base = baseValue(value);
	const pixels = pixelLengthSchema.safeParse(base);

	if (pixels.success) {
		return pixels.data;
	}

	const text = stringValueSchema.safeParse(base);

	if (!text.success) {
		return null;
	}

	const match = /^(?<amount>\d+(?:\.\d+)?)(?<unit>px|sp)$/u.exec(text.data.trim());

	return match?.groups?.amount
		? Number(match.groups.amount) * (match.groups.unit === "sp" ? spacingUnitPixels : 1)
		: null;
};

const hasReadableWidth = ({
	key,
	nodesByKey,
	parents,
}: {
	key: string;
	nodesByKey: Map<string, SectionStructureNode>;
	parents: Map<string, string>;
}): boolean => {
	if (nodesByKey.get(key)?.props.maxInlineSize !== undefined) {
		return true;
	}

	const parent = parents.get(key);

	return parent ? hasReadableWidth({ key: parent, nodesByKey, parents }) : false;
};

const normalizeCopy = (value: string) =>
	value
		.normalize("NFKC")
		.toLocaleLowerCase()
		.replaceAll(/[\p{P}\p{S}]/gu, " ")
		.replaceAll(/\s+/gu, " ")
		.trim();

const referencedCopyKeys = (node: SectionStructureNode) => {
	if (node.type === "text") {
		return [node.props.content];
	}

	if (node.type === "media") {
		return [node.props.alt];
	}

	if (node.type === "icon") {
		return node.props.label ? [node.props.label] : [];
	}

	if (node.type === "trigger") {
		return [node.props.label];
	}

	if (node.type === "field") {
		return [node.props.invalid, node.props.placeholder].filter((key) => key !== undefined);
	}

	if (node.type === "value") {
		return [node.props.unavailable];
	}

	return [];
};

type StructureWalk = ReturnType<typeof walkStructure>;

type SectionContent = ComposedSectionSpecification["content"];

type Heading = { key: string; level: number };

const responsiveValues = (value: JsonValue | undefined): Array<JsonValue> => {
	if (value === undefined) {
		return [];
	}

	return isJsonObject(value)
		? Object.values(value).filter((candidate): candidate is JsonValue => candidate !== undefined)
		: [value];
};

const gridCanShareRow = (node: SectionStructureNode) =>
	node.type === "grid" &&
	responsiveValues(nodeProp(node, "columns")).some((columns) => multipleGridColumnsSchema.safeParse(columns).success);

const flexCanShareRow = (node: SectionStructureNode) =>
	node.type === "flex" &&
	responsiveValues(nodeProp(node, "direction")).some(
		(direction) => direction === "row" || direction === "row-reverse"
	);

const canStretchChildren = (node: Extract<SectionStructureNode, { type: "flex" | "grid" }>) => {
	const alignments = responsiveValues(node.props.align);

	return alignments.length === 0 || alignments.some((alignment) => alignment === "stretch");
};

const containsNodeType = ({
	key,
	nodesByKey,
	type,
	visited = new Set<string>(),
}: {
	key: string;
	nodesByKey: StructureWalk["nodesByKey"];
	type: SectionStructureNode["type"];
	visited?: Set<string>;
}): boolean => {
	if (visited.has(key)) {
		return false;
	}

	visited.add(key);
	const node = nodesByKey.get(key);

	return Boolean(
		node &&
		(node.type === type ||
			node.children.some((child) => containsNodeType({ key: child, nodesByKey, type, visited })))
	);
};

const diagnoseStretchProneFields = ({ nodesByKey, ordered, parents }: StructureWalk): Array<SectionDiagnostic> =>
	ordered.flatMap((node) => {
		if (node.type !== "field") {
			return [];
		}

		const parentKey = parents.get(node.key);
		const parent = parentKey ? nodesByKey.get(parentKey) : undefined;

		if (
			!parent ||
			(parent.type !== "grid" && parent.type !== "flex") ||
			!canStretchChildren(parent) ||
			(!gridCanShareRow(parent) && !flexCanShareRow(parent))
		) {
			return [];
		}

		const outputSibling = parent.children.find(
			(child) => child !== node.key && containsNodeType({ key: child, nodesByKey, type: "value" })
		);

		return outputSibling
			? [
					diagnostic({
						code: "stretch-prone-field",
						message: `Field "${node.key}" can stretch to the height of a result group; set "${parent.key}" alignment to start.`,
						nodeKeys: [parent.key, node.key, outputSibling],
					}),
				]
			: [];
	});

const approximateLengthPixels = (value: JsonValue | undefined) => {
	const pixels = pixelLength(value);

	if (pixels !== null) {
		return pixels;
	}

	const relative = relativeLengthSchema.safeParse(value);

	return relative.success ? Number.parseFloat(relative.data) * 16 : null;
};

const edgeValues = ({
	edge,
	value,
}: {
	edge: "blockEnd" | "blockStart";
	value: JsonValue | undefined;
}): Array<JsonValue> => {
	if (!isJsonObject(value)) {
		return [];
	}

	const direct = value[edge];

	if (direct !== undefined) {
		return [direct];
	}

	return Object.values(value).flatMap((candidate) => edgeValues({ edge, value: candidate }));
};

const diagnoseExcessiveSectionSpacing = ({ nodesByKey, ordered }: StructureWalk): Array<SectionDiagnostic> => {
	const root = ordered[0];

	if (!root) {
		return [];
	}

	const utility = containsNodeType({ key: root.key, nodesByKey, type: "field" });

	const limit = utility
		? diagnosticLimits.maximumUtilityBlockPaddingPixels
		: diagnosticLimits.maximumSectionBlockPaddingPixels;

	const excessive = (["blockStart", "blockEnd"] as const)
		.flatMap((edge) => edgeValues({ edge, value: root.props.padding }))
		.some((value) => {
			const pixels = approximateLengthPixels(value);

			return pixels !== null && pixels > limit;
		});

	return excessive
		? [
				diagnostic({
					code: "excessive-section-spacing",
					message: `Root "${root.key}" props.padding uses more than ${limit / spacingUnitPixels}sp on one block edge.`,
					nodeKeys: [root.key],
				}),
			]
		: [];
};

const jsonPropsSchema = z.record(z.string(), z.json());

const nodeProp = (node: SectionStructureNode, name: string): JsonValue | undefined =>
	jsonPropsSchema.safeParse(node.props).data?.[name];

const breakpointValue = ({ breakpoint, value }: { breakpoint: string; value: JsonValue | undefined }) => {
	if (isJsonObject(value) && Object.hasOwn(value, "base")) {
		return value[breakpoint];
	}

	return breakpoint === "base" ? value : undefined;
};

const columnCountSchema = z.compile(z.union([z.number(), z.array(z.json()).transform((tracks) => tracks.length)]));

const columnCount = (value: JsonValue | undefined) => columnCountSchema.safeParse(value).data ?? null;

const isRowDirection = (value: JsonValue | undefined) => value === "row" || value === "row-reverse";

const diagnoseColumnOverflow = ({ nodesByKey, ordered }: StructureWalk): Array<SectionDiagnostic> =>
	ordered.flatMap((node) => {
		if (node.type === "grid") {
			const base = columnCount(breakpointValue({ breakpoint: "base", value: nodeProp(node, "columns") }));

			const compact =
				columnCount(breakpointValue({ breakpoint: "compact", value: nodeProp(node, "columns") })) ?? base;

			const tooWide = (base ?? 0) > 2 || (compact ?? 0) > 4;

			return tooWide
				? [
						diagnostic({
							code: "column-overflow",
							message: `Grid "${node.key}" props.columns has ${base} columns at base and ${compact} at compact; use at most 2 at base and 4 at compact.`,
							nodeKeys: [node.key],
						}),
					]
				: [];
		}

		const wrap = breakpointValue({ breakpoint: "base", value: nodeProp(node, "wrap") });

		const containers = node.children.filter((child) => {
			const type = nodesByKey.get(child)?.type;

			return type === "box" || type === "flex" || type === "grid" || type === "media";
		});

		return node.type === "flex" &&
			isRowDirection(breakpointValue({ breakpoint: "base", value: nodeProp(node, "direction") })) &&
			wrap !== "wrap" &&
			wrap !== "wrap-reverse" &&
			containers.length > 2
			? [
					diagnostic({
						code: "column-overflow",
						message: `Flex "${node.key}" props.direction is a row at base with ${containers.length} blocks and no wrapping.`,
						nodeKeys: [node.key],
					}),
				]
			: [];
	});

const descendants = ({
	key,
	nodesByKey,
	stopAtFill = false,
}: {
	key: string;
	nodesByKey: StructureWalk["nodesByKey"];
	stopAtFill?: boolean;
}): Array<SectionStructureNode> => {
	const node = nodesByKey.get(key);

	if (!node || (stopAtFill && nodeProp(node, "fill") !== undefined)) {
		return [];
	}

	return [node, ...node.children.flatMap((child) => descendants({ key: child, nodesByKey, stopAtFill: true }))];
};

const onFillTones = new Map([
	["accent", ["accent"]],
	["action", ["action"]],
	["black", ["media"]],
	["featured", ["featured"]],
]);

const diagnoseOnFillTones = ({ nodesByKey, ordered }: StructureWalk): Array<SectionDiagnostic> =>
	ordered.flatMap((node) => {
		const fill = stringValueSchema.safeParse(nodeProp(node, "fill")).data;
		const allowed = fill ? onFillTones.get(fill) : undefined;

		if (!allowed) {
			return [];
		}

		const mismatched = [
			...(nodeProp(node, "foreground") === undefined
				? []
				: [{ key: node.key, prop: "foreground", tone: nodeProp(node, "foreground") }]),
			...node.children
				.flatMap((child) => descendants({ key: child, nodesByKey, stopAtFill: true }))
				.filter(({ type }) => type === "text" || type === "icon" || type === "action")
				.map((descendant) => ({ key: descendant.key, prop: "tone", tone: nodeProp(descendant, "tone") })),
		].filter(
			({ tone }) =>
				Boolean(stringValueSchema.safeParse(tone).data) && tone !== "current" && !allowed.includes(String(tone))
		);

		return mismatched.length > 0
			? [
					diagnostic({
						code: "on-fill-tone",
						message: `Fill "${fill}" on "${node.key}" requires tone "${allowed[0]}", but ${mismatched
							.map(({ key, prop, tone }) => `"${key}" props.${prop} is "${String(tone)}"`)
							.join(", ")}.`,
						nodeKeys: [node.key, ...mismatched.map(({ key }) => key)],
					}),
				]
			: [];
	});

const diagnoseUnprotectedMediaText = ({ nodesByKey, ordered }: StructureWalk): Array<SectionDiagnostic> =>
	ordered.flatMap((parent) => {
		const layers = parent.children.filter((child) => {
			const media = nodesByKey.get(child);

			return (
				media?.type === "media" &&
				media.props.overlay === undefined &&
				responsiveValues(media.props.position).includes("absolute")
			);
		});

		if (
			layers.length === 0 ||
			nodeProp(parent, "background") !== undefined ||
			nodeProp(parent, "foreground") === "media"
		) {
			return [];
		}

		const unprotected = parent.children
			.filter((child) => !layers.includes(child))
			.flatMap((child) => descendants({ key: child, nodesByKey }))
			.filter((node) => node.type === "text" && nodeProp(node, "tone") !== "media");

		return unprotected.length > 0
			? [
					diagnostic({
						code: "unprotected-media-text",
						message: `Text ${unprotected.map(({ key }) => `"${key}"`).join(", ")} sits over media "${layers.join('", "')}" with no overlay or gradient.`,
						nodeKeys: [...layers, ...unprotected.map(({ key }) => key)],
					}),
				]
			: [];
	});

const spacingProps = ["columnGap", "gap", "margin", "padding", "rowGap"] as const;

const lengthLeaves = (value: JsonValue | undefined): Array<JsonValue> => {
	if (value === undefined || value === null) {
		return [];
	}

	if (Array.isArray(value)) {
		return value.flatMap(lengthLeaves);
	}

	return isJsonObject(value) ? Object.values(value).flatMap(lengthLeaves) : [value];
};

const numericLengthSchema = z.compile(z.number().refine((amount) => amount !== 0));

const isOffScaleLength = (value: JsonValue) => {
	const text = stringValueSchema.safeParse(value).data;

	return (
		numericLengthSchema.safeParse(value).success ||
		(text !== undefined && /^(?!0+(?:\.0+)?(?:px|rem|em)$)\d+(?:\.\d+)?(?:px|rem|em)$/u.test(text.trim()))
	);
};

const diagnoseOffScaleSpacing = (ordered: StructureWalk["ordered"]): Array<SectionDiagnostic> => {
	const offenders = ordered.flatMap((node) =>
		spacingProps.flatMap((prop) =>
			lengthLeaves(nodeProp(node, prop)).some(isOffScaleLength) ? [{ key: node.key, prop }] : []
		)
	);

	return offenders.length > 0
		? [
				diagnostic({
					code: "off-scale-spacing",
					message: `Spacing is off the sp scale or mixes units at ${offenders
						.slice(0, 6)
						.map(({ key, prop }) => `"${key}" props.${prop}`)
						.join(", ")}.`,
					nodeKeys: [...new Set(offenders.map(({ key }) => key))],
				}),
			]
		: [];
};

const ignoredSignatureProps = new Set(["alt", "asset", "content", "invalid", "label", "placeholder", "unavailable"]);

const subtreeSignature = ({ key, nodesByKey }: { key: string; nodesByKey: StructureWalk["nodesByKey"] }): string => {
	const node = nodesByKey.get(key);

	if (!node) {
		return "";
	}

	const props = Object.entries(node.props).filter(([name]) => !ignoredSignatureProps.has(name));
	const children = node.children.map((child) => subtreeSignature({ key: child, nodesByKey }));

	return JSON.stringify([node.type, props, children]);
};

const diagnoseRepeatedStructure = ({ nodesByKey, ordered }: StructureWalk): Array<SectionDiagnostic> =>
	ordered.flatMap((parent) => {
		const groups = Map.groupBy(
			parent.children.filter((child) => (nodesByKey.get(child)?.children.length ?? 0) > 0),
			(child) => subtreeSignature({ key: child, nodesByKey })
		);

		return [...groups.values()].flatMap((keys) =>
			keys.length > diagnosticLimits.maximumRepeatedSiblings
				? [
						diagnostic({
							code: "repeated-structure",
							message: `Parent "${parent.key}" has ${keys.length} structurally identical child blocks (${keys.join(", ")}).`,
							nodeKeys: [parent.key, ...keys],
						}),
					]
				: []
		);
	});

const diagnoseValueHierarchy = (ordered: StructureWalk["ordered"]): Array<SectionDiagnostic> => {
	const values = ordered.filter((node) => node.type === "value");
	const primary = values.filter((node) => node.props.emphasis !== "secondary");

	return values.length > 1 && primary.length !== 1
		? [
				diagnostic({
					code: "value-hierarchy",
					message:
						"A section with multiple computed values requires exactly one primary value and secondary emphasis on the rest.",
					nodeKeys: values.map(({ key }) => key),
				}),
			]
		: [];
};

const numericFacts = (value: string) => new Set(value.match(/\p{N}+(?:[.,]\p{N}+)?%?/gu) ?? []);

const ignoredOverlapTerms = new Set([
	"and",
	"are",
	"for",
	"from",
	"into",
	"more",
	"the",
	"this",
	"that",
	"with",
	"your",
]);

const meaningfulTerms = (value: string) =>
	new Set(
		normalizeCopy(value)
			.split(" ")
			.filter((term) => term.length >= 3 && !ignoredOverlapTerms.has(term))
	);

const diagnoseOverlappingCopy = ({
	content,
	ordered,
}: {
	content: SectionContent;
	ordered: StructureWalk["ordered"];
}): Array<SectionDiagnostic> => {
	const textKeys = [...new Set(ordered.flatMap((node) => (node.type === "text" ? [node.props.content] : [])))];

	for (const [index, key] of textKeys.entries()) {
		const terms = meaningfulTerms(content.en[key] ?? "");

		for (const otherKey of textKeys.slice(index + 1)) {
			const otherTerms = meaningfulTerms(content.en[otherKey] ?? "");
			const smallerCount = Math.min(terms.size, otherTerms.size);
			const shared = [...otherTerms].filter((term) => terms.has(term));

			if (smallerCount >= 4 && shared.length >= 3 && shared.length / smallerCount >= 0.5) {
				return [
					diagnostic({
						code: "overlapping-copy",
						contentKeys: [key, otherKey],
						message: `Copy "${key}" and "${otherKey}" substantially overlap: ${shared.join(", ")}.`,
					}),
				];
			}
		}
	}

	return [];
};

const diagnoseRepeatedFacts = ({
	content,
	ordered,
}: {
	content: SectionContent;
	ordered: StructureWalk["ordered"];
}): Array<SectionDiagnostic> => {
	const textKeys = [...new Set(ordered.flatMap((node) => (node.type === "text" ? [node.props.content] : [])))];

	for (const [index, key] of textKeys.entries()) {
		const facts = numericFacts(content.en[key] ?? "");

		for (const otherKey of textKeys.slice(index + 1)) {
			const shared = [...numericFacts(content.en[otherKey] ?? "")].filter((fact) => facts.has(fact));

			if (shared.length >= 2) {
				return [
					diagnostic({
						code: "repeated-facts",
						contentKeys: [key, otherKey],
						message: `Copy "${key}" and "${otherKey}" repeat the same numeric facts: ${shared.join(", ")}.`,
					}),
				];
			}
		}
	}

	return [];
};

const findHeadings = (ordered: StructureWalk["ordered"]): Array<Heading> => {
	return ordered.flatMap((node) => {
		const level = node.type === "text" ? headingElements.get(node.props.element ?? "") : undefined;

		return level ? [{ key: node.key, level }] : [];
	});
};

const diagnoseHeadings = (ordered: StructureWalk["ordered"]): Array<SectionDiagnostic> => {
	const headings = findHeadings(ordered);
	const h1Keys = headings.filter(({ level }) => level === 1).map(({ key }) => key);

	const multipleH1 =
		h1Keys.length > 1
			? [
					diagnostic({
						code: "multiple-h1",
						message: "A custom section contains more than one level-one heading.",
						nodeKeys: h1Keys,
					}),
				]
			: [];

	const levelSkips = headings.flatMap((heading, index) => {
		const previous = headings[index - 1];

		return previous && heading.level > previous.level + 1
			? [
					diagnostic({
						code: "heading-level-skip",
						message: `Heading "${heading.key}" skips from h${previous.level} to h${heading.level}.`,
						nodeKeys: [previous.key, heading.key],
					}),
				]
			: [];
	});

	return [...multipleH1, ...levelSkips];
};

const diagnoseOverflowProneSize = (node: SectionStructureNode): Array<SectionDiagnostic> => {
	const inlineSize = stringValueSchema.safeParse(baseValue(node.props.inlineSize));
	const inlinePixels = pixelLength(node.props.inlineSize);
	const minimumPixels = pixelLength(node.props.minInlineSize);

	const canOverflow =
		(inlinePixels !== null && inlinePixels > diagnosticLimits.maximumInlinePixels) ||
		(minimumPixels !== null && minimumPixels > diagnosticLimits.maximumMinimumInlinePixels) ||
		(inlineSize.success && /^100(?:\.0+)?vw$/u.test(inlineSize.data.trim()));

	return canOverflow
		? [
				diagnostic({
					code: "overflow-prone-size",
					message: `Node "${node.key}" uses a base inline size that can overflow compact containers.`,
					nodeKeys: [node.key],
				}),
			]
		: [];
};

const diagnoseTextNode = ({
	content,
	node,
	nodesByKey,
	parents,
}: {
	content: SectionContent;
	node: SectionStructureNode;
	nodesByKey: StructureWalk["nodesByKey"];
	parents: StructureWalk["parents"];
}): Array<SectionDiagnostic> => {
	if (node.type !== "text") {
		return [];
	}

	const value = content.en[node.props.content] ?? "";
	const heading = headingElements.has(node.props.element ?? "");
	const maximum = heading ? diagnosticLimits.headingCopyCharacters : diagnosticLimits.bodyCopyCharacters;

	const exceedsBudget =
		value.length > maximum || (heading && (content.ar[node.props.content]?.length ?? 0) > maximum);

	const copyBudget = exceedsBudget
		? [
				diagnostic({
					code: "copy-budget",
					contentKeys: [node.props.content],
					message: `Copy "${node.props.content}" exceeds the ${heading ? "heading" : "body"} budget.`,
					nodeKeys: [node.key],
				}),
			]
		: [];

	const lacksReadableWidth =
		!heading &&
		value.length > diagnosticLimits.longFormCharacters &&
		!hasReadableWidth({ key: node.key, nodesByKey, parents });

	const readableWidth = lacksReadableWidth
		? [
				diagnostic({
					code: "readable-width",
					contentKeys: [node.props.content],
					message: `Long-form copy "${node.props.content}" has no maximum readable width.`,
					nodeKeys: [node.key],
				}),
			]
		: [];

	return [...copyBudget, ...readableWidth];
};

const diagnoseMediaNode = ({ content, node }: { content: SectionContent; node: SectionStructureNode }) => {
	if (node.type !== "media") {
		return [];
	}

	const englishAlt = content.en[node.props.alt]?.trim() ?? "";
	const arabicAlt = content.ar[node.props.alt]?.trim() ?? "";
	const generic = /^(?:image|photo|picture)$/iu.test(englishAlt) || /^(?:صورة)$/u.test(arabicAlt);

	return generic
		? [
				diagnostic({
					code: "media-alt-generic",
					contentKeys: [node.props.alt],
					message: `Media alternative text "${node.props.alt}" is generic.`,
					nodeKeys: [node.key],
				}),
			]
		: [];
};

const diagnoseNode = ({
	content,
	node,
	nodesByKey,
	parents,
}: {
	content: SectionContent;
	node: SectionStructureNode;
	nodesByKey: StructureWalk["nodesByKey"];
	parents: StructureWalk["parents"];
}): Array<SectionDiagnostic> => {
	return [
		...diagnoseOverflowProneSize(node),
		...diagnoseTextNode({ content, node, nodesByKey, parents }),
		...diagnoseMediaNode({ content, node }),
	];
};

const hasLanguageMismatch = ({ arabic, english }: { arabic: string; english: string }) => {
	const englishUsesArabic = /\p{Script=Arabic}/u.test(english);
	const englishUsesLatin = /\p{Script=Latin}/u.test(english);
	const arabicUsesArabic = /\p{Script=Arabic}/u.test(arabic);
	const arabicUsesLatin = /\p{Script=Latin}/u.test(arabic);

	return (
		(english.length >= 4 && englishUsesArabic && !englishUsesLatin) ||
		(arabic.length >= 4 && arabicUsesLatin && !arabicUsesArabic)
	);
};

const recordNormalizedCopy = ({
	key,
	locale,
	normalizedByLocale,
	value,
}: {
	key: string;
	locale: "ar" | "en";
	normalizedByLocale: Map<string, Array<string>>;
	value: string;
}) => {
	const normalized = normalizeCopy(value);

	if (normalized.length < diagnosticLimits.repeatedCopyCharacters) {
		return;
	}

	const duplicateKey = `${locale}:${normalized}`;
	const keys = normalizedByLocale.get(duplicateKey) ?? [];
	keys.push(key);
	normalizedByLocale.set(duplicateKey, keys);
};

const diagnoseLocalizedCopy = ({
	content,
	referencedKeys,
}: {
	content: SectionContent;
	referencedKeys: Set<string>;
}): Array<SectionDiagnostic> => {
	const languageDiagnostics: Array<SectionDiagnostic> = [];
	const normalizedByLocale = new Map<string, Array<string>>();

	for (const key of [...referencedKeys].sort()) {
		const english = content.en[key] ?? "";
		const arabic = content.ar[key] ?? "";

		if (hasLanguageMismatch({ arabic, english })) {
			languageDiagnostics.push(
				diagnostic({
					code: "language-mismatch",
					contentKeys: [key],
					message: `Copy "${key}" appears to use the wrong script for one locale.`,
				})
			);
		}

		recordNormalizedCopy({ key, locale: "en", normalizedByLocale, value: english });
		recordNormalizedCopy({ key, locale: "ar", normalizedByLocale, value: arabic });
	}

	const repeatedCopy = [...normalizedByLocale.values()].flatMap((keys) => {
		return keys.length > 1
			? [
					diagnostic({
						code: "repeated-copy",
						contentKeys: keys,
						message: `The same long-form copy is repeated across keys: ${keys.join(", ")}.`,
					}),
				]
			: [];
	});

	return [...languageDiagnostics, ...repeatedCopy];
};

export const blockingSectionDiagnostics = (diagnostics: Array<SectionDiagnostic>) =>
	diagnostics.filter(({ severity }) => severity === "blocking");

export const diagnoseComposedSection = ({
	content,
	structure,
}: Pick<ComposedSectionSpecification, "content" | "structure">): Array<SectionDiagnostic> => {
	const { nodesByKey, ordered, parents } = walkStructure(structure);
	const referencedKeys = new Set(ordered.flatMap(referencedCopyKeys));

	return [
		...diagnoseHeadings(ordered),
		...diagnoseExcessiveSectionSpacing({ nodesByKey, ordered, parents }),
		...diagnoseColumnOverflow({ nodesByKey, ordered, parents }),
		...diagnoseOnFillTones({ nodesByKey, ordered, parents }),
		...diagnoseUnprotectedMediaText({ nodesByKey, ordered, parents }),
		...diagnoseOffScaleSpacing(ordered),
		...diagnoseRepeatedStructure({ nodesByKey, ordered, parents }),
		...diagnoseStretchProneFields({ nodesByKey, ordered, parents }),
		...diagnoseValueHierarchy(ordered),
		...ordered.flatMap((node) => diagnoseNode({ content, node, nodesByKey, parents })),
		...diagnoseLocalizedCopy({ content, referencedKeys }),
		...diagnoseOverlappingCopy({ content, ordered }),
		...diagnoseRepeatedFacts({ content, ordered }),
	];
};
