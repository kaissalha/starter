import { z } from "zod";

import { compileBehaviorOutputs, compileBehaviorProgram } from "../behavior/compile-expression";
import type { SiteBehaviorProgramV1 } from "../behavior/contracts";
import { interactiveDescendantNodeTypes } from "../behavior/semantics";
import { sectionRegistry } from "../section-registry";
import {
	entityIdSchema,
	isJsonObject,
	iso6391LanguageCodeSchema,
	jsonObjectSchema,
	jsonValueSchema,
	linkValueSchema,
	mergeContentValue,
	pageContentSchema,
	resolveSectionContentReference,
	siteContentSchema,
	textReferenceSchema,
	type JsonObject,
	type JsonValue,
	type TextReference,
} from "./content-schema";
import { validateSiteDocumentResourceLimits } from "./resource-validation";
import { createSectionContentSchema } from "./section-content-contract";
import { listSectionContentReferences } from "./section-content-references";
import { siteDocumentSchema, type SiteDocument } from "./site-document-schema";
import type { SiteSection } from "./structure-schema";

export type DocumentValidationIssue = {
	code: string;
	message: string;
	path: Array<number | string>;
};

export const websiteBrandGuidelinesSlug = "brand-guidelines";

const behaviorNodeTypeSchema = z.compile(z.enum(["field", "trigger", "value"]));

const interactiveNodeTypes = new Set<string>(interactiveDescendantNodeTypes);

const collectionOrderSchema = z.compile(z.array(z.string()));

const nodeIdentitySchema = z.compile(z.object({ id: z.string(), key: z.string(), type: z.string() }));

const stringSchema = z.compile(z.string());

const validationPathSegmentSchema = z.compile(z.union([z.string(), z.number()]));

const normalizeValidationPathSegment = (segment: PropertyKey): number | string => {
	const parsed = validationPathSegmentSchema.safeParse(segment);

	return parsed.success ? parsed.data : String(segment);
};

const visitJsonObjects = ({
	path,
	value,
	visit,
}: {
	path: Array<number | string>;
	value: JsonValue;
	visit: ({ path, value }: { path: Array<number | string>; value: JsonObject }) => void;
}) => {
	const pending = [{ path, value }];

	while (pending.length > 0) {
		const current = pending.pop();

		if (!current) {
			continue;
		}

		const currentValue = current.value;

		if (Array.isArray(currentValue)) {
			currentValue.toReversed().forEach((child, reverseIndex) => {
				pending.push({
					path: [...current.path, currentValue.length - reverseIndex - 1],
					value: child,
				});
			});
			continue;
		}

		if (!isJsonObject(currentValue)) {
			continue;
		}

		visit({ path: current.path, value: currentValue });
		Object.entries(currentValue)
			.toReversed()
			.forEach(([key, child]) => {
				if (child !== undefined) {
					pending.push({ path: [...current.path, key], value: child });
				}
			});
	}
};

export type DocumentValidationResult =
	| { data: SiteDocument; success: true }
	| { issues: Array<DocumentValidationIssue>; success: false };

export class SiteDocumentValidationError extends Error {
	readonly issues: Array<DocumentValidationIssue>;

	constructor(issues: Array<DocumentValidationIssue>) {
		super(`Invalid Infinite Website document (${issues.length} ${issues.length === 1 ? "issue" : "issues"})`);
		this.name = "SiteDocumentValidationError";
		this.issues = issues;
	}
}

const sectionAuthoringContentSchema = z.strictObject({
	menu: z.record(
		entityIdSchema,
		z.strictObject({
			items: z.record(
				entityIdSchema,
				z.strictObject({
					label: z.string(),
					link: linkValueSchema,
				})
			),
		})
	),
});

type SectionLocation = {
	pageId?: string;
	path: Array<number | string>;
	section: SiteSection;
};

const sectionLocations = ({ document }: { document: SiteDocument }): Array<SectionLocation> => {
	return [
		...document.structure.layout.header.map((section, index) => ({
			path: ["structure", "layout", "header", index],
			section,
		})),
		...document.structure.pages.flatMap((page, pageIndex) =>
			page.sections.map((section, sectionIndex) => ({
				pageId: page.id,
				path: ["structure", "pages", pageIndex, "sections", sectionIndex],
				section,
			}))
		),
		...document.structure.layout.footer.map((section, index) => ({
			path: ["structure", "layout", "footer", index],
			section,
		})),
	];
};

const createEntityIdRegistrar = ({ issues }: { issues: Array<DocumentValidationIssue> }) => {
	const identities = new Map<string, Array<number | string>>();

	return ({ id, path }: { id: string; path: Array<number | string> }) => {
		const existing = identities.get(id);

		if (existing) {
			issues.push({
				code: "duplicate_entity_id",
				message: `Entity ID "${id}" is already used at ${existing.join(".")}`,
				path,
			});

			return;
		}

		identities.set(id, path);
	};
};

const collectStructureIdentities = ({
	path,
	register,
	value,
}: {
	path: Array<number | string>;
	register: ({ id, path }: { id: string; path: Array<number | string> }) => void;
	value: JsonValue;
}) => {
	visitJsonObjects({
		path,
		value,
		visit: ({ path: objectPath, value: object }) => {
			const id = entityIdSchema.safeParse(object.id);

			if (id.success) {
				register({ id: id.data, path: [...objectPath, "id"] });
			}
		},
	});
};

const materializeContentCollections = ({
	issues,
	path,
	register,
	value,
}: {
	issues: Array<DocumentValidationIssue>;
	path: Array<number | string>;
	register?: ({ id, path }: { id: string; path: Array<number | string> }) => void;
	value: JsonValue | undefined;
}): JsonValue | undefined => {
	if (Array.isArray(value)) {
		return value.map((item, index) =>
			jsonValueSchema.parse(
				materializeContentCollections({ issues, path: [...path, index], register, value: item })
			)
		);
	}

	const parsed = jsonObjectSchema.safeParse(value);

	if (!parsed.success) {
		return value;
	}

	const order = collectionOrderSchema.safeParse(parsed.data.order);
	const items = jsonObjectSchema.safeParse(parsed.data.items);

	if (order.success && items.success) {
		const itemIds = Object.keys(items.data);
		const orderedIds = order.data;
		const orderedIdSet = new Set(orderedIds);

		if (
			orderedIdSet.size !== orderedIds.length ||
			itemIds.length !== orderedIds.length ||
			itemIds.some((id) => !orderedIdSet.has(id))
		) {
			issues.push({
				code: "invalid_collection_identity",
				message: "Collection order and item IDs must be the same unique set",
				path,
			});
		}

		orderedIds.forEach((id) => register?.({ id, path: [...path, "items", id] }));

		return orderedIds.flatMap((id) => {
			if (!Object.hasOwn(items.data, id)) {
				return [];
			}

			return [
				jsonValueSchema.parse(
					materializeContentCollections({
						issues,
						path: [...path, "items", id],
						register,
						value: items.data[id],
					})
				),
			];
		});
	}

	return Object.fromEntries(
		Object.entries(parsed.data).map(([key, child]) => [
			key,
			materializeContentCollections({ issues, path: [...path, key], register, value: child }),
		])
	);
};

const addSchemaIssues = ({
	code,
	issues,
	path,
	result,
}: {
	code: string;
	issues: Array<DocumentValidationIssue>;
	path: Array<number | string>;
	result: ReturnType<ReturnType<typeof createSectionContentSchema>["safeParse"]>;
}) => {
	if (result.success) {
		return;
	}

	result.error.issues.forEach((issue) => {
		issues.push({
			code,
			message: issue.message,
			path: [...path, ...issue.path.map(normalizeValidationPathSegment)],
		});
	});
};

type BehaviorBinding = { key: string; type: "condition" | "field" | "trigger" | "value" };

const collectNodeBindings = ({ node }: { node: JsonObject }): Array<BehaviorBinding> => {
	const type = behaviorNodeTypeSchema.safeParse(node.type);
	const props = jsonObjectSchema.safeParse(node.props);
	const bindings: Array<BehaviorBinding> = [];

	const visibleWhen = stringSchema.safeParse(node.visibleWhen);

	if (visibleWhen.success) {
		bindings.push({ key: visibleWhen.data, type: "condition" });
	}

	if (!props.success) {
		return bindings;
	}

	const disabledWhen = stringSchema.safeParse(props.data.disabledWhen);

	if (disabledWhen.success) {
		bindings.push({ key: disabledWhen.data, type: "condition" });
	}

	if (type.success) {
		const property = { field: "slot", trigger: "event", value: "value" }[type.data];
		const key = stringSchema.safeParse(props.data[property]);

		if (key.success) {
			bindings.push({ key: key.data, type: type.data });
		}
	}

	return bindings;
};

const collectBehaviorBindings = ({ value }: { value: JsonValue }): Array<BehaviorBinding> => {
	const bindings: Array<BehaviorBinding> = [];
	visitJsonObjects({
		path: [],
		value,
		visit: ({ value: node }) => bindings.push(...collectNodeBindings({ node })),
	});

	return bindings;
};

const behaviorEventTargets = (behavior: SiteBehaviorProgramV1): Record<string, string> => {
	if (behavior.expressionProfile === "custom-js-v1") {
		return behavior.targets ?? {};
	}

	if (behavior.expressionProfile === "site-expression-v2") {
		return behavior.events ?? {};
	}

	return {};
};

const accessibleReferenceForNode = ({
	hidden,
	props,
	type,
}: {
	hidden: boolean;
	props: ReturnType<typeof jsonObjectSchema.safeParse>;
	type: ReturnType<typeof stringSchema.safeParse>;
}): TextReference | undefined => {
	if (hidden || !type.success || !props.success) {
		return;
	}

	if (type.data === "text") {
		return textReferenceSchema.safeParse(props.data.content).data;
	}

	if (type.data === "media") {
		return textReferenceSchema.safeParse(props.data.alt).data;
	}

	if (type.data === "icon") {
		return textReferenceSchema.safeParse(props.data.label).data;
	}

	return undefined;
};

const accessibleActionReferences = (
	value: JsonValue | undefined,
	conditionallyHidden = false
): Array<TextReference> => {
	if (Array.isArray(value)) {
		return value.flatMap((child) => accessibleActionReferences(child, conditionallyHidden));
	}

	const node = jsonObjectSchema.safeParse(value);

	if (!node.success) {
		return [];
	}

	const type = stringSchema.safeParse(node.data.type);
	const props = jsonObjectSchema.safeParse(node.data.props);
	const layout = jsonObjectSchema.safeParse(node.data.layout);
	const visibility = layout.success ? layout.data.visibility : undefined;
	const responsiveVisibility = jsonObjectSchema.safeParse(visibility);

	const hiddenByLayout =
		visibility === "hidden" ||
		visibility === "removed" ||
		(responsiveVisibility.success &&
			Object.values(responsiveVisibility.data).some((value) => value === "hidden" || value === "removed"));

	const descendantConditionallyHidden = conditionallyHidden || node.data.visibleWhen !== undefined || hiddenByLayout;

	const reference = accessibleReferenceForNode({ hidden: descendantConditionallyHidden, props, type });
	const own = reference ? [reference] : [];

	return [
		...own,
		...Object.values(node.data).flatMap((child) =>
			accessibleActionReferences(child, descendantConditionallyHidden)
		),
	];
};

const hasAccessibleActionContent = (value: JsonValue | undefined) => accessibleActionReferences(value).length > 0;

type AccessibleNameTarget = {
	path: Array<number | string>;
	references: Array<TextReference>;
	type: string;
};

const targetReferences = ({
	props,
	type,
}: {
	props: ReturnType<typeof jsonObjectSchema.safeParse>;
	type: ReturnType<typeof stringSchema.safeParse>;
}): Array<TextReference> => {
	if (!type.success || !props.success) {
		return [];
	}

	if (type.data === "action") {
		return accessibleActionReferences(props.data.children);
	}

	if (type.data === "trigger") {
		const label = textReferenceSchema.safeParse(props.data.label);

		return label.success ? [label.data] : [];
	}

	if (type.data !== "field" && type.data !== "value") {
		return [];
	}

	const children = Array.isArray(props.data.children) ? props.data.children : [];
	const label = jsonObjectSchema.safeParse(children[0]);
	const labelProps = jsonObjectSchema.safeParse(label.success ? label.data.props : undefined);
	const content = textReferenceSchema.safeParse(labelProps.success ? labelProps.data.content : undefined);

	return content.success ? [content.data] : [];
};

const collectAccessibleNameTargets = ({
	path,
	value,
}: {
	path: Array<number | string>;
	value: JsonValue;
}): Array<AccessibleNameTarget> => {
	const targets: Array<AccessibleNameTarget> = [];
	visitJsonObjects({
		path,
		value,
		visit: ({ path: nodePath, value: node }) => {
			const type = stringSchema.safeParse(node.type);
			const props = jsonObjectSchema.safeParse(node.props);
			const references = targetReferences({ props, type });

			if (type.success && references.length > 0) {
				targets.push({ path: nodePath, references, type: type.data });
			}
		},
	});

	return targets;
};

const validateSectionAccessibleNames = ({
	document,
	issues,
	location,
}: {
	document: SiteDocument;
	issues: Array<DocumentValidationIssue>;
	location: SectionLocation;
}) => {
	const { path, section } = location;
	const targets = collectAccessibleNameTargets({ path: [...path, "root"], value: section.root });

	targets.forEach((target) => {
		document.locales.forEach((locale) => {
			const hasName = target.references.some((reference) => {
				try {
					const value = resolveSectionContentReference({
						content: document.content,
						contentId: section.contentId,
						defaultLocale: document.defaultLocale,
						locale,
						reference,
					});

					const text = stringSchema.safeParse(value);

					return text.success && text.data.trim().length > 0;
				} catch {
					return false;
				}
			});

			if (!hasName) {
				issues.push({
					code: "invalid_accessible_label",
					message: `${target.type} requires a nonblank accessible label for locale "${locale}"`,
					path: target.path,
				});
			}
		});
	});
};

const expressionsMatch = (left: JsonValue, right: JsonValue) => JSON.stringify(left) === JSON.stringify(right);

const behaviorSourceMatches = (behavior: SiteBehaviorProgramV1) => {
	if (behavior.expressionProfile === "custom-js-v1") {
		return true;
	}

	if (behavior.expressionProfile === "site-expression-v1") {
		const compiled = compileBehaviorProgram({ fields: behavior.slots, source: behavior.source });

		return (
			compiled.expressionProfile === "site-expression-v1" && expressionsMatch(compiled.result, behavior.result)
		);
	}

	const compiled = compileBehaviorOutputs({
		events: behavior.events,
		fields: behavior.slots,
		outputs: Object.fromEntries(
			Object.entries(behavior.outputs).map(([key, output]) => [key, { source: output.source, type: output.type }])
		),
	});

	return Object.entries(behavior.outputs).every(([key, output]) => {
		const compiledOutput = compiled.outputs[key];

		return compiledOutput !== undefined && expressionsMatch(compiledOutput.result, output.result);
	});
};

const hasValidDirectBehaviorLabel = (props: JsonValue) => {
	const parsed = jsonObjectSchema.safeParse(props);
	const children = parsed.success && Array.isArray(parsed.data.children) ? parsed.data.children : [];
	const label = children.length === 1 && isJsonObject(children[0]) ? children[0] : undefined;
	const labelLayout = isJsonObject(label?.layout) ? label.layout : undefined;
	const labelVisibility = labelLayout?.visibility;
	const responsiveLabelVisibility = isJsonObject(labelVisibility) ? labelVisibility : undefined;

	const labelCanHide =
		label?.visibleWhen !== undefined ||
		labelVisibility === "hidden" ||
		labelVisibility === "removed" ||
		Object.values(responsiveLabelVisibility ?? {}).some((value) => value === "hidden" || value === "removed");

	return Boolean(label?.type === "text" && !labelCanHide);
};

const validateBehaviorMarkup = ({
	issues,
	path,
	value,
}: {
	issues: Array<DocumentValidationIssue>;
	path: Array<number | string>;
	value: JsonValue;
}) => {
	const stack: Array<{ interactiveAncestor: string | undefined; path: Array<number | string>; value: JsonValue }> = [
		{ interactiveAncestor: undefined, path, value },
	];

	while (stack.length > 0) {
		const current = stack.pop();

		if (!current) {
			continue;
		}

		if (Array.isArray(current.value)) {
			current.value.forEach((child, index) =>
				stack.push({ ...current, path: [...current.path, index], value: child })
			);
			continue;
		}

		const node = jsonObjectSchema.safeParse(current.value);

		if (!node.success) {
			continue;
		}

		const type = stringSchema.safeParse(node.data.type);
		const props = jsonObjectSchema.safeParse(node.data.props);
		const isInteractive = type.success && interactiveNodeTypes.has(type.data);

		if (current.interactiveAncestor && isInteractive) {
			issues.push({
				code: "invalid_interactive_containment",
				message: `${current.interactiveAncestor} nodes cannot contain interactive ${type.data} descendants`,
				path: current.path,
			});
		}

		if (type.success && (type.data === "field" || type.data === "value") && props.success) {
			if (!hasValidDirectBehaviorLabel(props.data)) {
				issues.push({
					code: "invalid_behavior_label",
					message: `${type.data} nodes require exactly one direct text-label child`,
					path: [...current.path, "props", "children"],
				});
			}
		}

		if (
			type.success &&
			type.data === "action" &&
			props.success &&
			!hasAccessibleActionContent(props.data.children)
		) {
			issues.push({
				code: "invalid_action_label",
				message: "Action nodes require a text, labeled icon, or media descendant",
				path: [...current.path, "props", "children"],
			});
		}

		Object.entries(node.data).forEach(([key, child]) => {
			stack.push({
				interactiveAncestor:
					current.interactiveAncestor ?? (isInteractive && type.success ? type.data : undefined),
				path: [...current.path, key],
				value: child,
			});
		});
	}
};

const validateSectionNodeKeys = ({
	issues,
	location,
}: {
	issues: Array<DocumentValidationIssue>;
	location: SectionLocation;
}) => {
	const { path, section } = location;
	const keys = new Set<string>();

	visitJsonObjects({
		path: [...path, "root"],
		value: section.root,
		visit: ({ value }) => {
			const node = nodeIdentitySchema.safeParse(value);

			if (!node.success) {
				return;
			}

			if (keys.has(node.data.key)) {
				issues.push({
					code: "duplicate_node_key",
					message: `Node key "${node.data.key}" is already used in this section`,
					path: [...path, "root"],
				});
			}

			keys.add(node.data.key);
		},
	});
};

const validateSectionBehavior = ({
	anchors,
	document,
	issues,
	location,
}: {
	anchors: ReadonlySet<string>;
	document: SiteDocument;
	issues: Array<DocumentValidationIssue>;
	location: SectionLocation;
}) => {
	const { path, section } = location;
	const bindings = collectBehaviorBindings({ value: section.root });
	const behavior = document.logic?.[section.id];

	validateBehaviorMarkup({ issues, path: [...path, "root"], value: section.root });

	if (!behavior) {
		if (bindings.length > 0) {
			issues.push({
				code: "missing_section_behavior",
				message: "Behavior nodes require a section behavior program",
				path: [...path, "root"],
			});
		}

		return;
	}

	try {
		if (!behaviorSourceMatches(behavior)) {
			issues.push({
				code: "behavior_source_mismatch",
				message: "Behavior source does not match its executable expression",
				path: ["logic", section.id],
			});
		}
	} catch {
		issues.push({
			code: "invalid_behavior_source",
			message: "Behavior source cannot be compiled with its declared fields",
			path: ["logic", section.id],
		});
	}

	const slots = new Set(behavior.slots.map((slot) => slot.key));
	const outputTypes = new Map<string, "boolean" | "decimal">();
	const eventKeys: Array<string> = [];

	if (behavior.expressionProfile === "custom-js-v1") {
		behavior.outputs.forEach((output) => outputTypes.set(output, "decimal"));
		eventKeys.push(...(behavior.events ?? []));
	} else if (behavior.expressionProfile === "site-expression-v1") {
		outputTypes.set("result", "decimal");
	} else {
		Object.entries(behavior.outputs).forEach(([key, output]) => outputTypes.set(key, output.type));
		eventKeys.push(...Object.keys(behavior.events ?? {}));
	}

	const events = new Set(eventKeys);

	const keys = {
		condition: new Set([...outputTypes].flatMap(([key, type]) => (type === "boolean" ? [key] : []))),
		field: slots,
		trigger: events,
		value: new Set([...outputTypes].flatMap(([key, type]) => (type === "decimal" ? [key] : []))),
	};

	bindings.forEach((binding) => {
		if (!keys[binding.type].has(binding.key)) {
			issues.push({
				code: "invalid_behavior_binding",
				message: `${binding.type} binds unknown behavior value "${binding.key}"`,
				path: [...path, "root"],
			});
		}
	});

	const countBindings = (type: BehaviorBinding["type"], key: string) =>
		bindings.filter((binding) => binding.type === type && binding.key === key).length;

	behavior.slots.forEach((slot) => {
		if (countBindings("field", slot.key) !== 1) {
			issues.push({
				code: "invalid_behavior_binding",
				message: `Behavior slot "${slot.key}" requires exactly one field`,
				path: [...path, "root"],
			});
		}
	});

	outputTypes.forEach((type, output) => {
		const bindingType = type === "boolean" ? "condition" : "value";

		if (countBindings(bindingType, output) !== 1) {
			issues.push({
				code: "invalid_behavior_binding",
				message: `Behavior ${type} output "${output}" requires exactly one ${bindingType} binding`,
				path: [...path, "root"],
			});
		}
	});

	events.forEach((event) => {
		if (countBindings("trigger", event) !== 1) {
			issues.push({
				code: "invalid_behavior_binding",
				message: `Behavior event "${event}" requires exactly one trigger`,
				path: [...path, "root"],
			});
		}
	});

	const targets = behaviorEventTargets(behavior);

	Object.values(targets).forEach((anchor) => {
		if (!anchors.has(anchor)) {
			issues.push({
				code: "invalid_behavior_target",
				message: `Behavior target anchor "${anchor}" does not exist`,
				path: ["logic", section.id, behavior.expressionProfile === "site-expression-v2" ? "events" : "targets"],
			});
		}
	});
};

const validateSectionContract = ({
	document,
	issues,
	location,
	register,
}: {
	document: SiteDocument;
	issues: Array<DocumentValidationIssue>;
	location: SectionLocation;
	register: ({ id, path }: { id: string; path: Array<number | string> }) => void;
}) => {
	const { path, section } = location;
	const definition = section.source ? sectionRegistry.get(section.source.pattern) : undefined;

	if (section.source && !definition) {
		issues.push({
			code: "unknown_section_pattern",
			message: `Unknown section pattern "${section.source.pattern}"`,
			path: [...path, "source", "pattern"],
		});

		return;
	}

	const defaultPersistedContent = document.content[document.defaultLocale]?.sections[section.contentId];

	if (!defaultPersistedContent) {
		issues.push({
			code: "missing_section_content",
			message: `Default locale has no content for section content ID "${section.contentId}"`,
			path: ["content", document.defaultLocale, "sections", section.contentId],
		});

		return;
	}

	if (!definition) {
		if (section.settings !== undefined) {
			issues.push({
				code: "unexpected_section_settings",
				message: "Composed sections do not accept settings",
				path: [...path, "settings"],
			});
		}
	} else {
		if (definition.category !== section.category) {
			issues.push({
				code: "invalid_section_category",
				message: `Section pattern "${definition.pattern}" belongs to category "${definition.category}"`,
				path: [...path, "category"],
			});
		}

		if (definition.settings) {
			const settingsResult = definition.settings.safeParse(section.settings);

			if (!settingsResult.success) {
				settingsResult.error.issues.forEach((issue) => {
					issues.push({
						code: "invalid_section_settings",
						message: issue.message,
						path: [...path, "settings", ...issue.path.map(normalizeValidationPathSegment)],
					});
				});
			}
		} else if (section.settings !== undefined) {
			issues.push({
				code: "unexpected_section_settings",
				message: `Section pattern "${definition.pattern}" does not accept settings`,
				path: [...path, "settings"],
			});
		}
	}

	const contentSchema = definition ? createSectionContentSchema({ definition }) : undefined;
	validateSectionAccessibleNames({ document, issues, location });

	const withoutReservedNamespaces = (value: JsonValue | undefined) => {
		const object = jsonObjectSchema.safeParse(value);

		if (!object.success || (object.data.behavior === undefined && object.data.authoring === undefined)) {
			return value;
		}

		return Object.fromEntries(
			Object.entries(object.data).filter(([key]) => key !== "authoring" && key !== "behavior")
		);
	};

	const validateAuthoringContent = ({
		path: contentPath,
		value,
	}: {
		path: Array<number | string>;
		value: JsonValue | undefined;
	}) => {
		const content = jsonObjectSchema.safeParse(value);

		if (content.success && content.data.authoring !== undefined) {
			addSchemaIssues({
				code: "invalid_section_authoring_content",
				issues,
				path: [...contentPath, "authoring"],
				result: sectionAuthoringContentSchema.safeParse(content.data.authoring),
			});
		}
	};

	const defaultContentPath: Array<number | string> = [
		"content",
		document.defaultLocale,
		"sections",
		section.contentId,
	];

	const defaultMaterializedContent = materializeContentCollections({
		issues,
		path: defaultContentPath,
		register,
		value: defaultPersistedContent,
	});

	validateAuthoringContent({ path: defaultContentPath, value: defaultMaterializedContent });

	if (contentSchema) {
		addSchemaIssues({
			code: "invalid_section_content",
			issues,
			path: defaultContentPath,
			result: contentSchema.safeParse(withoutReservedNamespaces(defaultMaterializedContent)),
		});
	}

	(["text", "asset", "link"] as const).forEach((kind) => {
		const schema = { asset: entityIdSchema, link: linkValueSchema, text: z.string() }[kind];

		listSectionContentReferences({ kind, node: section.root }).forEach((reference) => {
			document.locales.forEach((locale) => {
				const resolved = (() => {
					try {
						return resolveSectionContentReference({
							content: document.content,
							contentId: section.contentId,
							defaultLocale: document.defaultLocale,
							locale,
							reference,
						});
					} catch {
						return undefined;
					}
				})();

				if (!schema.safeParse(resolved).success) {
					issues.push({
						code: "invalid_section_reference",
						message: `Section ${kind} reference does not resolve for locale "${locale}"`,
						path: [...path, "root"],
					});
				}
			});
		});
	});

	document.locales.forEach((locale) => {
		if (locale === document.defaultLocale) {
			return;
		}

		const persistedContent = mergeContentValue({
			fallback: defaultPersistedContent,
			localized: document.content[locale]?.sections[section.contentId],
		});

		const materializedContent = materializeContentCollections({
			issues,
			path: ["content", locale, "sections", section.contentId],
			value: persistedContent,
		});

		const localizedContentPath: Array<number | string> = ["content", locale, "sections", section.contentId];
		validateAuthoringContent({ path: localizedContentPath, value: materializedContent });

		if (contentSchema) {
			addSchemaIssues({
				code: "invalid_section_content",
				issues,
				path: localizedContentPath,
				result: contentSchema.safeParse(withoutReservedNamespaces(materializedContent)),
			});
		}
	});
};

const collectLinkIssues = ({
	document,
	pageIds,
	sectionLocationsByAnchor,
	sectionLocationsByContentId,
	sectionLocationsById,
}: {
	document: SiteDocument;
	pageIds: Set<string>;
	sectionLocationsByAnchor: Map<string, SectionLocation>;
	sectionLocationsByContentId: Map<string, SectionLocation>;
	sectionLocationsById: Map<string, SectionLocation>;
}) => {
	const singlePageId = document.structure.pages.length === 1 ? document.structure.pages[0]?.id : undefined;

	const rendersWithSource = ({ source, target }: { source?: SectionLocation; target: SectionLocation }) =>
		!source ||
		target.pageId === undefined ||
		source.pageId === target.pageId ||
		(source.pageId === undefined && target.pageId === singlePageId);

	const visit = ({
		path,
		source,
		value,
	}: {
		path: Array<number | string>;
		source?: SectionLocation;
		value: JsonValue;
	}): Array<DocumentValidationIssue> => {
		if (Array.isArray(value)) {
			return value.flatMap((item, index) => visit({ path: [...path, index], source, value: item }));
		}

		const parsed = jsonObjectSchema.safeParse(value);

		if (!parsed.success) {
			return [];
		}

		const link = linkValueSchema.safeParse(value);

		if (link.success && link.data.kind === "page" && !pageIds.has(link.data.pageId)) {
			return [{ code: "missing_link_page", message: `Link targets missing page "${link.data.pageId}"`, path }];
		}

		if (link.success && link.data.kind === "page" && link.data.sectionId) {
			const section = sectionLocationsById.get(link.data.sectionId);

			if (!section || section.pageId !== link.data.pageId) {
				return [
					{
						code: "invalid_page_section_link",
						message: "Page link targets a section outside that page",
						path,
					},
				];
			}
		}

		if (link.success && link.data.kind === "section") {
			const target = sectionLocationsById.get(link.data.sectionId);

			if (!target) {
				return [{ code: "missing_link_section", message: "Link targets a missing section", path }];
			}

			if (!rendersWithSource({ source, target })) {
				return [
					{
						code: "cross_page_section_link",
						message: "Section links must target a section rendered with their source",
						path,
					},
				];
			}
		}

		if (link.success && link.data.kind === "anchor") {
			const target = sectionLocationsByAnchor.get(link.data.anchor);

			if (!target) {
				return [
					{ code: "missing_link_anchor", message: `Link targets missing anchor "${link.data.anchor}"`, path },
				];
			}

			if (!rendersWithSource({ source, target })) {
				return [
					{
						code: "cross_page_anchor_link",
						message: "Anchor links must target a section rendered with their source",
						path,
					},
				];
			}
		}

		return Object.entries(parsed.data).flatMap(([key, child]) =>
			visit({ path: [...path, key], source, value: child })
		);
	};

	const defaultContent = document.content[document.defaultLocale];

	return document.locales.flatMap((locale) => {
		const localized = document.content[locale];
		const pages = mergeContentValue({ fallback: defaultContent?.pages, localized: localized?.pages });
		const site = mergeContentValue({ fallback: defaultContent?.site, localized: localized?.site });

		const sections = jsonObjectSchema.safeParse(
			mergeContentValue({ fallback: defaultContent?.sections, localized: localized?.sections })
		);

		return [
			...visit({ path: ["content", locale, "pages"], value: pages ?? {} }),
			...visit({ path: ["content", locale, "site"], value: site ?? {} }),
			...(sections.success
				? Object.entries(sections.data).flatMap(([contentId, value]) =>
						visit({
							path: ["content", locale, "sections", contentId],
							source: sectionLocationsByContentId.get(contentId),
							value,
						})
					)
				: []),
		];
	});
};

const createBehaviorAnchorResolver = ({
	document,
	locations,
}: {
	document: SiteDocument;
	locations: Array<SectionLocation>;
}) => {
	const layoutAnchors = new Set(
		locations.flatMap(({ pageId, section }) => (pageId === undefined ? [section.anchor] : []))
	);

	const pageAnchors = new Map<string, Set<string>>();
	locations.forEach(({ pageId, section }) => {
		if (pageId) {
			const anchors = pageAnchors.get(pageId) ?? new Set<string>();
			anchors.add(section.anchor);
			pageAnchors.set(pageId, anchors);
		}
	});

	return (location: SectionLocation) => {
		const onlyPageId = document.structure.pages.length === 1 ? document.structure.pages[0]?.id : undefined;
		const pageId = location.pageId ?? onlyPageId;

		return new Set([...layoutAnchors, ...(pageId ? (pageAnchors.get(pageId) ?? []) : [])]);
	};
};

export const validateSiteDocument = (input: JsonValue | SiteDocument): DocumentValidationResult => {
	const resourceIssues = validateSiteDocumentResourceLimits(input);

	if (resourceIssues.length > 0) {
		return { issues: resourceIssues, success: false };
	}

	const parsed = siteDocumentSchema.safeParse(input);

	if (!parsed.success) {
		return {
			issues: parsed.error.issues.map((issue) => ({
				code: issue.code,
				message: issue.message,
				path: issue.path.map(normalizeValidationPathSegment),
			})),
			success: false,
		} satisfies DocumentValidationResult;
	}

	const document = parsed.data;
	const issues: Array<DocumentValidationIssue> = [];
	const register = createEntityIdRegistrar({ issues });
	const locales = new Set(document.locales);

	if (locales.size !== document.locales.length) {
		issues.push({ code: "duplicate_locale", message: "Document locales must be unique", path: ["locales"] });
	}

	if (!locales.has(document.defaultLocale)) {
		issues.push({
			code: "missing_default_locale",
			message: "Default locale must be listed in locales",
			path: ["defaultLocale"],
		});
	}

	const defaultContent = document.content[document.defaultLocale];

	if (!defaultContent) {
		issues.push({
			code: "missing_default_content",
			message: "Default locale content is required",
			path: ["content", document.defaultLocale],
		});
	}

	Object.keys(document.content).forEach((locale) => {
		if (!locales.has(iso6391LanguageCodeSchema.parse(locale))) {
			issues.push({
				code: "unlisted_content_locale",
				message: `Content locale "${locale}" is not listed in locales`,
				path: ["content", locale],
			});
		}
	});

	const homePages = document.structure.pages.filter((page) => page.home);

	if (homePages.length !== 1) {
		issues.push({
			code: "invalid_home_page",
			message: "Document must contain exactly one home page",
			path: ["structure", "pages"],
		});
	}

	const pageIds = new Set<string>();

	document.structure.pages.forEach((page, pageIndex) => {
		register({ id: page.id, path: ["structure", "pages", pageIndex, "id"] });
		pageIds.add(page.id);
	});

	const locations = sectionLocations({ document });
	const sectionLocationsById = new Map(locations.map((location) => [location.section.id, location]));
	const sectionLocationsByAnchor = new Map(locations.map((location) => [location.section.anchor, location]));
	const sectionLocationsByContentId = new Map(locations.map((location) => [location.section.contentId, location]));
	const resolveBehaviorAnchors = createBehaviorAnchorResolver({ document, locations });
	const contentIds = new Set<string>();
	const anchors = new Set<string>();

	locations.forEach((location) => {
		const { path, section } = location;
		register({ id: section.id, path: [...path, "id"] });
		register({ id: section.contentId, path: [...path, "contentId"] });
		contentIds.add(section.contentId);

		if (anchors.has(section.anchor)) {
			issues.push({
				code: "duplicate_section_anchor",
				message: `Section anchor "${section.anchor}" is already in use`,
				path: [...path, "anchor"],
			});
		}

		anchors.add(section.anchor);
		collectStructureIdentities({ path: [...path, "root"], register, value: section.root });
		validateSectionNodeKeys({ issues, location });
		validateSectionBehavior({
			anchors: resolveBehaviorAnchors(location),
			document,
			issues,
			location,
		});
		validateSectionContract({ document, issues, location, register });
	});

	Object.keys(document.logic ?? {}).forEach((sectionId) => {
		if (!sectionLocationsById.has(sectionId)) {
			issues.push({
				code: "orphan_section_logic",
				message: `Logic entry targets missing section "${sectionId}"`,
				path: ["logic", sectionId],
			});
		}
	});

	if (defaultContent) {
		const defaultPageIds = new Set(Object.keys(defaultContent.pages));
		const defaultSectionIds = new Set(Object.keys(defaultContent.sections));

		if (defaultPageIds.size !== pageIds.size || [...pageIds].some((id) => !defaultPageIds.has(id))) {
			issues.push({
				code: "invalid_page_content_join",
				message: "Default page content must exactly match the structure page IDs",
				path: ["content", document.defaultLocale, "pages"],
			});
		}

		if (defaultSectionIds.size !== contentIds.size || [...contentIds].some((id) => !defaultSectionIds.has(id))) {
			issues.push({
				code: "invalid_section_content_join",
				message: "Default section content must exactly match the structure content IDs",
				path: ["content", document.defaultLocale, "sections"],
			});
		}
	}

	document.locales.forEach((locale) => {
		const localized = document.content[locale];

		if (!localized || !defaultContent) {
			return;
		}

		Object.keys(localized.pages).forEach((id) => {
			if (!pageIds.has(id)) {
				issues.push({
					code: "orphan_page_content",
					message: `Page content "${id}" has no structure page`,
					path: ["content", locale, "pages", id],
				});
			}
		});

		Object.keys(localized.sections).forEach((id) => {
			if (!contentIds.has(id)) {
				issues.push({
					code: "orphan_section_content",
					message: `Section content "${id}" has no structure section`,
					path: ["content", locale, "sections", id],
				});
			}
		});

		addSchemaIssues({
			code: "invalid_site_content",
			issues,
			path: ["content", locale, "site"],
			result: siteContentSchema.safeParse(
				mergeContentValue({ fallback: defaultContent.site, localized: localized.site })
			),
		});

		const slugs = new Set<string>();

		document.structure.pages.forEach((page) => {
			const completePage = mergeContentValue({
				fallback: defaultContent.pages[page.id],
				localized: localized.pages[page.id],
			});

			const pageResult = pageContentSchema.safeParse(completePage);

			addSchemaIssues({
				code: "invalid_page_content",
				issues,
				path: ["content", locale, "pages", page.id],
				result: pageResult,
			});

			if (pageResult.success) {
				const pageSlug = pageResult.data.route.slug;
				const [firstSegment] = pageSlug.split("/");

				if (
					pageSlug === websiteBrandGuidelinesSlug ||
					pageSlug === "links" ||
					pageSlug === "blog" ||
					pageSlug.startsWith("blog/")
				) {
					issues.push({
						code: "reserved_page_slug",
						message: `Page slug "${pageSlug}" is reserved by the public website runtime`,
						path: ["content", locale, "pages", page.id, "route", "slug"],
					});
				}

				if (
					locale === document.defaultLocale &&
					document.locales.some(
						(candidate) => candidate !== document.defaultLocale && candidate === firstSegment
					)
				) {
					issues.push({
						code: "page_slug_locale_prefix_collision",
						message: `Default-locale page slug "${pageSlug}" conflicts with the public route prefix for locale "${firstSegment}"`,
						path: ["content", locale, "pages", page.id, "route", "slug"],
					});
				}

				if (slugs.has(pageSlug)) {
					issues.push({
						code: "duplicate_page_slug",
						message: `Page slug "${pageSlug}" is duplicated for locale "${locale}"`,
						path: ["content", locale, "pages", page.id, "route", "slug"],
					});
				}

				slugs.add(pageSlug);
			}
		});
	});

	issues.push(
		...collectLinkIssues({
			document,
			pageIds,
			sectionLocationsByAnchor,
			sectionLocationsByContentId,
			sectionLocationsById,
		})
	);

	if (issues.length === 0) {
		return { data: document, success: true } satisfies DocumentValidationResult;
	}

	return { issues, success: false } satisfies DocumentValidationResult;
};

export const parseSiteDocument = (input: JsonValue | SiteDocument) => {
	const result = validateSiteDocument(input);

	if (!result.success) {
		throw new SiteDocumentValidationError(result.issues);
	}

	return result.data;
};
