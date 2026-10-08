import { z } from "zod";

import { jsonObjectSchema, jsonValueSchema, type JsonObject } from "../document/content-schema";
import { siteNodeLayoutFields, siteNodeSchema, type PersistedSiteNode } from "../document/structure-schema";
import { entityIdFromSeed } from "../sections/entity-id";
import {
	carouselRuntimeProps,
	disclosureRuntimeProps,
	embedRuntimeProps,
	groupIdFor,
	isCollectionNode,
	tabsRuntimeProps,
	type CollectionNode,
} from "./collection-nodes";
import { compileBehaviorOutputs, compileBehaviorProgram } from "./compile-expression";
import { siteBehaviorProgramSchema, type SiteBehaviorProgramV1 } from "./contracts";
import {
	BehaviorSectionError,
	describeBehaviorError,
	isNamedSectionLogic,
	sectionContentReferenceProps,
	sectionStructureSchema,
	type SectionContent,
	type SectionLogic,
	type SectionStructure,
} from "./specification";

const stringSchema = z.compile(z.string());

export type SectionContentNamespace = "behavior" | "copy";

export const sectionContentNamespace = ({ source }: { source?: unknown }): SectionContentNamespace =>
	source ? "behavior" : "copy";

export const contentKeyPointer = ({ key, namespace }: { key: string; namespace: SectionContentNamespace }) =>
	`/${namespace}/${key}`;

export const sectionNodeId = ({ key, sectionId }: { key: string; sectionId: string }) =>
	entityIdFromSeed({ seed: `${sectionId}:node:${key}` });

export const materializeSectionStructure = ({
	namespace,
	requireBoxRoot = true,
	sectionId,
	structure,
}: {
	namespace: SectionContentNamespace;
	requireBoxRoot?: boolean;
	sectionId: string;
	structure: SectionStructure;
}): PersistedSiteNode => {
	const parsed = sectionStructureSchema.parse(structure);
	const nodeByKey = new Map(parsed.nodes.map((node) => [node.key, node]));

	const ref = (key: string) => ({ $text: contentKeyPointer({ key, namespace }) });

	const materializeItem = (key: string) => {
		const item = nodeByKey.get(key);
		const [trigger, panel] = item?.children ?? [];

		if (item?.type !== "item" || !trigger || !panel) {
			throw new BehaviorSectionError(`Item node "${key}" requires a trigger and a panel child`);
		}

		return {
			id: sectionNodeId({ key, sectionId }),
			key,
			panel: [materialize(panel)],
			trigger: [materialize(trigger)],
		};
	};

	const collectionProps = (node: CollectionNode): JsonObject => {
		switch (node.type) {
			case "carousel":
				return carouselRuntimeProps({
					groupId: (name) => groupIdFor({ key: node.key, name, sectionId }),
					node,
					ref,
					slides: node.children.map(materialize),
				});
			case "disclosure":
				return disclosureRuntimeProps({ items: node.children.map(materializeItem), node });
			case "tabs":
				return tabsRuntimeProps({ items: node.children.map(materializeItem), node, ref });
			case "embed":
				return embedRuntimeProps({ node, ref });
		}
	};

	const materialize = (key: string): z.infer<typeof jsonValueSchema> => {
		const node = nodeByKey.get(key);

		if (!node) {
			throw new BehaviorSectionError(`Structure node "${key}" is unavailable`);
		}

		if (isCollectionNode(node)) {
			const layout = Object.fromEntries(
				Object.entries(node.props).filter(([name]) => Object.hasOwn(siteNodeLayoutFields, name))
			);

			const collection = jsonObjectSchema.parse({
				id: sectionNodeId({ key: node.key, sectionId }),
				key: node.key,
				...(node.props.visibleWhen && { visibleWhen: node.props.visibleWhen }),
				props: collectionProps(node),
				type: node.type,
			});

			return Object.keys(layout).length > 0
				? { ...collection, layout: jsonObjectSchema.parse(layout) }
				: collection;
		}

		if (node.type === "item") {
			throw new BehaviorSectionError(`Item node "${key}" must be a direct child of a tabs or disclosure node`);
		}

		const references: Partial<Record<string, "asset" | "link" | "text">> = sectionContentReferenceProps[node.type];

		const props: JsonObject = {};
		const layout: JsonObject = {};
		const nodeFields: JsonObject = {};

		Object.entries(node.props).forEach(([name, value]) => {
			if (name === "visibleWhen") {
				nodeFields.visibleWhen = value;

				return;
			}

			if (Object.hasOwn(siteNodeLayoutFields, name)) {
				layout[name] = value;

				return;
			}

			const contentKey = stringSchema.safeParse(value);

			const referenceKind = references[name];

			const persistedName = (() => {
				if (node.type === "value" && name === "output") {
					return "value";
				}

				if (node.type === "media" && name === "asset") {
					return "assetId";
				}

				return node.type === "action" && name === "link" ? "href" : name;
			})();

			props[persistedName] =
				referenceKind && contentKey.success
					? { [`$${referenceKind}`]: contentKeyPointer({ key: contentKey.data, namespace }) }
					: value;
		});

		if (node.type !== "text" && node.type !== "media" && node.type !== "icon") {
			props.children = node.children.map(materialize);
		}

		const materialized = jsonObjectSchema.parse({
			id: sectionNodeId({ key: node.key, sectionId }),
			key: node.key,
			...nodeFields,
			props,
			type: node.type,
		});

		if (Object.keys(layout).length > 0) {
			materialized.layout = jsonObjectSchema.parse(layout);
		}

		return materialized;
	};

	try {
		const root = siteNodeSchema.parse(materialize(parsed.root));

		if (requireBoxRoot && root.type !== "box") {
			throw new BehaviorSectionError("The structure root must be a box node");
		}

		return root;
	} catch (error) {
		if (error instanceof BehaviorSectionError) {
			throw error;
		}

		throw new BehaviorSectionError(`The structure layer failed validation.\n${describeBehaviorError(error)}`);
	}
};

export const materializeSectionContent = ({
	content,
	namespace,
}: {
	content: SectionContent;
	namespace: SectionContentNamespace;
}) => ({
	ar: jsonObjectSchema.parse({ [namespace]: { ...content.ar, ...content.assets, ...content.links } }),
	en: jsonObjectSchema.parse({ [namespace]: { ...content.en, ...content.assets, ...content.links } }),
});

export const materializeSectionLogic = ({ logic }: { logic: SectionLogic }): SiteBehaviorProgramV1 => {
	if (logic.kind === "expression") {
		try {
			if (isNamedSectionLogic(logic)) {
				return compileBehaviorOutputs({
					events: logic.events,
					fields: logic.fields,
					outputs: Object.fromEntries(
						Object.entries(logic.outputs).map(([key, output]) => [
							key,
							{ source: output.expression, type: output.type },
						])
					),
				});
			}

			return compileBehaviorProgram({ fields: logic.fields, source: logic.expression });
		} catch (error) {
			throw new BehaviorSectionError(`The logic layer failed validation.\n${describeBehaviorError(error)}`);
		}
	}

	if (!logic.initialOutputs) {
		throw new BehaviorSectionError(
			"Script logic requires validated initial outputs — prepare the logic layer first"
		);
	}

	return siteBehaviorProgramSchema.parse({
		behaviorVersion: 1,
		events: logic.events,
		expressionProfile: "custom-js-v1",
		initialOutputs: logic.initialOutputs,
		outputs: logic.outputs,
		script: logic.script,
		slots: logic.fields.map((field) => ({ initial: field.initial, key: field.key })),
		targets: logic.targets,
	});
};
