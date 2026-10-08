import { z } from "zod";

import { brandFoundationSchema } from "@starter/infinite-brand";

import {
	applyComposedContentUpdate,
	applyComposedSectionAddition,
	applyComposedStructureUpdate,
	applySectionLogic,
	applySectionLogicRemoval,
	composedSectionAnchorSchema,
	composedSectionCategorySchema,
	sectionLogicBindingsSchema,
} from "../behavior/edit";
import {
	BehaviorSectionError,
	composedSectionSpecificationSchema,
	prepareSectionLogic,
	sectionContentSchema,
	sectionLogicSchema,
	sectionStructureSchema,
} from "../behavior/specification";
import type { WebsiteSnapshotV1 } from "../generation/contracts";
import type { Iso6391LanguageCode } from "../language-codes";
import { siteDocumentResourceLimits } from "../resource-limits";
import { sectionRegistry } from "../section-registry";
import { entityIdFromSeed } from "../sections/entity-id";
import {
	instantiateSectionRepeaterValues,
	listNestedRepeaters,
	resolveRepeaterCollection,
	type EntityIdKind,
	type SectionRepeater,
} from "../sections/section-definition";
import {
	authoringJsonObjectSchema,
	contentReferencePointer,
	decodeContentPointer,
	encodeContentPointer,
	entityIdSchema,
	isContentArrayIndex,
	iso6391LanguageCodeSchema,
	jsonObjectSchema,
	jsonPointerSchema,
	jsonValueSchema,
	linkValueSchema,
	localeContentSchema,
	mergeContentValue,
	readContentPointer,
	type JsonObject,
	type JsonValue,
	type LinkValue,
} from "./content-schema";
import { parseSiteDocument, SiteDocumentValidationError } from "./document-validation";
import {
	applyWebsitePageSectionEdit,
	websitePageSectionEditInputSchema,
	WebsitePageSectionEditError,
} from "./edit-page-section";
import { validateSiteSectionRootResourceLimits } from "./resource-validation";
import {
	listSectionContentReferences,
	listSectionLinkElementReferences,
	listSectionMediaNodeReferences,
} from "./section-content-references";
import type { SiteDocument } from "./site-document-schema";
import { siteNodeSchema, type SiteSection } from "./structure-schema";
import { websiteSettingsSchema } from "./website-settings";

const getSectionDefinition = (section: SiteSection | undefined) =>
	section?.source ? sectionRegistry.get(section.source.pattern) : undefined;

export const websiteTextEditInputSchema = z.compile(
	z.strictObject({
		locale: iso6391LanguageCodeSchema,
		operation: z.literal("update-text"),
		pageId: entityIdSchema.optional(),
		pointer: jsonPointerSchema,
		sectionId: entityIdSchema,
		value: z.string().max(20_000),
	})
);

export const websiteLinkEditInputSchema = z.compile(
	z.strictObject({
		label: z
			.strictObject({
				pointers: z.array(jsonPointerSchema).min(1),
				value: z.string().max(20_000),
			})
			.optional(),
		locale: iso6391LanguageCodeSchema,
		operation: z.literal("update-link"),
		pageId: entityIdSchema.optional(),
		pointer: jsonPointerSchema,
		sectionId: entityIdSchema,
		value: linkValueSchema,
	})
);

const websiteMenuDropdownItemEditSchema = z.strictObject({
	id: entityIdSchema,
	label: z.string().min(1).max(20_000),
	value: linkValueSchema,
});

export const websiteMenuItemEditInputSchema = z.compile(
	z.discriminatedUnion("operation", [
		z.strictObject({
			elementId: entityIdSchema,
			index: z.number().int().nonnegative(),
			label: z.string().trim().min(1).max(20_000),
			locale: iso6391LanguageCodeSchema,
			menuId: entityIdSchema,
			operation: z.literal("add-menu-item"),
			sectionId: entityIdSchema,
			value: linkValueSchema,
		}),
		z.strictObject({
			elementId: entityIdSchema,
			index: z.number().int().nonnegative(),
			operation: z.literal("move-menu-item"),
			sectionId: entityIdSchema,
		}),

		z.strictObject({
			elementId: entityIdSchema,
			items: z.array(websiteMenuDropdownItemEditSchema).max(12),
			kind: z.enum(["dropdown", "link"]),
			label: z.string().min(1).max(20_000),
			locale: iso6391LanguageCodeSchema,
			operation: z.literal("update-menu-item"),
			sectionId: entityIdSchema,
			value: linkValueSchema,
		}),
		z.strictObject({
			elementId: entityIdSchema,
			operation: z.literal("delete-menu-item"),
			sectionId: entityIdSchema,
		}),
	])
);

export const websiteCollectionEditInputSchema = z.compile(
	z.discriminatedUnion("operation", [
		z.strictObject({
			collection: jsonPointerSchema,
			itemId: entityIdSchema,
			operation: z.literal("add-collection-item"),
			sectionId: entityIdSchema,
		}),
		z.strictObject({
			collection: jsonPointerSchema,
			itemId: entityIdSchema,
			operation: z.literal("delete-collection-item"),
			sectionId: entityIdSchema,
		}),
	])
);

const websiteSectionRootEditOperationSchema = z.strictObject({
	operation: z.literal("replace-section-root"),
	pageId: entityIdSchema.optional(),
	root: siteNodeSchema.refine((node) => node.type === "box", "A section root must be a box node"),
	sectionId: entityIdSchema,
});

const websiteDocumentEditOperationSchema = z.discriminatedUnion("operation", [
	z.strictObject({ operation: z.literal("update-settings"), settings: websiteSettingsSchema }),
	z.strictObject({ locale: iso6391LanguageCodeSchema, operation: z.literal("remove-language") }),
	z.strictObject({
		content: localeContentSchema.optional(),
		locale: iso6391LanguageCodeSchema,
		operation: z.literal("add-language"),
	}),
	z.strictObject({ locale: iso6391LanguageCodeSchema, operation: z.literal("set-default-language") }),
	z.strictObject({ operation: z.literal("set-blog-navigation"), visible: z.boolean() }),
	z.strictObject({
		description: z.string().trim().max(320),
		locale: iso6391LanguageCodeSchema,
		operation: z.literal("update-page-seo"),
		pageId: entityIdSchema,
		title: z.string().trim().min(1).max(120),
	}),
	...websitePageSectionEditInputSchema.options,
	websiteTextEditInputSchema,
	websiteLinkEditInputSchema,
	...websiteMenuItemEditInputSchema.options,
	...websiteCollectionEditInputSchema.options,
	websiteSectionRootEditOperationSchema,
	z.strictObject({
		alt: z.partialRecord(iso6391LanguageCodeSchema, z.string().trim().max(300)).optional(),
		fileId: entityIdSchema,
		operation: z.literal("update-media"),
		pointer: jsonPointerSchema,
		sectionId: entityIdSchema,
	}),
]);

const websiteEditOperationSchema = z.discriminatedUnion("operation", [
	...websiteDocumentEditOperationSchema.options,
	z.strictObject({
		anchor: composedSectionAnchorSchema.optional(),
		category: composedSectionCategorySchema.optional(),
		index: z.number().int().nonnegative(),
		operation: z.literal("add-composed-section"),
		pageId: entityIdSchema,
		seed: entityIdSchema,
		specification: composedSectionSpecificationSchema,
	}),
	z
		.strictObject({
			bindings: sectionLogicBindingsSchema.optional(),
			content: sectionContentSchema.optional(),
			logic: sectionLogicSchema.nullable().optional(),
			operation: z.literal("update-section"),
			pageId: entityIdSchema,
			sectionId: entityIdSchema,
			structure: sectionStructureSchema.optional(),
		})
		.refine(
			(input) => input.structure || input.content || input.logic !== undefined || input.bindings,
			"Provide at least one section change"
		)
		.refine((input) => input.bindings === undefined || Boolean(input.logic), {
			message: "Logic bindings require a non-null logic layer in the same edit",
			path: ["bindings"],
		}),
	z.strictObject({
		brand: brandFoundationSchema,
		operation: z.literal("update-brand"),
	}),
]);

const validateSectionRootEditResources = (root: JsonValue) => {
	const issue = validateSiteSectionRootResourceLimits(root);

	if (!issue) {
		return;
	}

	switch (issue.code) {
		case "document_has_too_many_values":
			return `Section root exceeds the limit of ${siteDocumentResourceLimits.jsonValues} JSON values`;
		case "document_json_too_deep":
			return `Section root exceeds the JSON depth limit of ${siteDocumentResourceLimits.jsonDepth}`;
		case "document_too_large":
			return `Section root exceeds the limit of ${siteDocumentResourceLimits.bytes} bytes`;
		case "invalid_json_graph":
			return "Section root must be acyclic JSON";
		case "section_has_too_many_nodes":
			return `Section root exceeds the node limit of ${siteDocumentResourceLimits.sectionNodes}`;
		case "section_too_deep":
			return `Section root exceeds the node depth limit of ${siteDocumentResourceLimits.nodeDepth}`;
		default:
			return issue.message;
	}
};

const rawSectionRootEditSchema = z.looseObject({
	operation: z.literal("replace-section-root"),
	root: z.custom<JsonValue>(),
});

const websiteEditResourceSchema = <Input>() =>
	z.custom<Input>().superRefine((input, context) => {
		const rawInput = rawSectionRootEditSchema.safeParse(input);
		const issue = rawInput.success ? validateSectionRootEditResources(rawInput.data.root) : undefined;

		if (issue) {
			context.addIssue({ code: "custom", message: issue, path: ["root"] });
		}
	});

export const websiteEditInputSchema =
	websiteEditResourceSchema<z.input<typeof websiteEditOperationSchema>>().pipe(websiteEditOperationSchema);

export const websiteDocumentEditInputSchema = websiteEditResourceSchema<
	z.input<typeof websiteDocumentEditOperationSchema>
>().pipe(websiteDocumentEditOperationSchema);

export const websiteSectionRootEditInputSchema = websiteEditResourceSchema<
	z.input<typeof websiteSectionRootEditOperationSchema>
>().pipe(websiteSectionRootEditOperationSchema);

const collectionOrderSchema = z.compile(z.array(z.uuid()));

export type WebsiteDocumentEditInput = z.infer<typeof websiteDocumentEditOperationSchema>;

export type WebsiteEditInput = z.infer<typeof websiteEditOperationSchema>;

export const prepareWebsiteEditInputs = async (inputs: Array<WebsiteEditInput>) =>
	Promise.all(
		websiteEditInputSchema
			.array()
			.parse(inputs)
			.map(async (input) => {
				if (input.operation === "add-composed-section" && input.specification.logic) {
					return {
						...input,
						specification: {
							...input.specification,
							logic: await prepareSectionLogic(input.specification.logic),
						},
					};
				}

				if (input.operation === "update-section" && input.logic) {
					return { ...input, logic: await prepareSectionLogic(input.logic) };
				}

				return input;
			})
	);

export class WebsiteEditError extends Error {
	constructor(message = "The requested website edit is unavailable.") {
		super(message);
		this.name = "WebsiteEditError";
	}
}

const writeContentPointer = ({
	nextValue,
	segments,
	value,
}: {
	nextValue: JsonValue;
	segments: Array<string>;
	value: JsonValue | undefined;
}): JsonValue => {
	const [segment, ...remaining] = segments;

	if (!segment) {
		return nextValue;
	}

	const object = jsonObjectSchema.safeParse(value);
	const current = object.success ? object.data : {};

	return jsonObjectSchema.parse({
		...current,
		[segment]: writeContentPointer({ nextValue, segments: remaining, value: current[segment] }),
	});
};

const findWebsiteSection = ({
	document,
	pageId,
	sectionId,
}: {
	document: SiteDocument;
	pageId?: string;
	sectionId: string;
}) => {
	if (pageId) {
		return document.structure.pages
			.find((page) => page.id === pageId)
			?.sections.find((section) => section.id === sectionId);
	}

	return [
		...document.structure.layout.header,
		...document.structure.pages.flatMap((page) => page.sections),
		...document.structure.layout.footer,
	].find((section) => section.id === sectionId);
};

const replaceWebsiteSectionRoot = ({
	document,
	pageId,
	root,
	sectionId,
}: {
	document: SiteDocument;
	pageId?: string;
	root: z.infer<typeof siteNodeSchema>;
	sectionId: string;
}) => {
	const nextDocument = structuredClone(document);
	const section = findWebsiteSection({ document: nextDocument, pageId, sectionId });

	if (!section || root.type !== "box") {
		throw new WebsiteEditError();
	}

	section.root = root;

	return nextDocument;
};

const updateWebsiteText = ({
	document,
	locale,
	pageId,
	pointer,
	sectionId,
	value,
}: {
	document: SiteDocument;
	locale: Iso6391LanguageCode;
	pageId?: string;
	pointer: string;
	sectionId: string;
	value: string;
}) => {
	const section = findWebsiteSection({ document, pageId, sectionId });

	const textPointers = section
		? listSectionContentReferences({ kind: "text", node: section.root }).map((reference) =>
				contentReferencePointer({ reference })
			)
		: [];

	if (!section || !document.locales.includes(locale) || !textPointers.includes(pointer)) {
		throw new WebsiteEditError();
	}

	const nextDocument = { ...document, content: { ...document.content } };
	writeSectionContentValue({ document: nextDocument, locale, pointer, section, value });

	return nextDocument;
};

const updateWebsiteMedia = ({
	alt,
	document,
	fileId,
	pointer,
	sectionId,
}: {
	alt?: Partial<Record<string, string>>;
	document: SiteDocument;
	fileId: string;
	pointer: string;
	sectionId: string;
}) => {
	const section = findWebsiteSection({ document, sectionId });

	if (
		!section ||
		!listSectionContentReferences({ kind: "asset", node: section.root }).some(
			(reference) => contentReferencePointer({ reference }) === pointer
		)
	) {
		throw new WebsiteEditError();
	}

	const altPointer = listSectionMediaNodeReferences({ node: section.root }).find(
		(target) => target.pointer === pointer
	)?.altPointer;

	const nextDocument = { ...document, content: { ...document.content } };

	for (const locale of document.locales) {
		writeSectionContentValue({ document: nextDocument, locale, pointer, section, value: fileId });

		if (altPointer) {
			writeSectionContentValue({
				document: nextDocument,
				locale,
				pointer: altPointer,
				section,
				value: alt?.[locale] ?? "",
			});
		}
	}

	return nextDocument;
};

const updateWebsiteLink = ({
	document,
	label,
	locale,
	pageId,
	pointer,
	sectionId,
	value,
}: {
	document: SiteDocument;
	label?: { pointers: Array<string>; value: string };
	locale: Iso6391LanguageCode;
	pageId?: string;
	pointer: string;
	sectionId: string;
	value: LinkValue;
}) => {
	const section = findWebsiteSection({ document, pageId, sectionId });

	const linkTarget = section
		? listSectionLinkElementReferences({ node: section.root }).find((target) => target.pointer === pointer)
		: undefined;

	if (
		!section ||
		!linkTarget ||
		!document.locales.includes(locale) ||
		(label !== undefined &&
			label.pointers.some((pointer) => !linkTarget.labels.some((item) => item.pointer === pointer)))
	) {
		throw new WebsiteEditError();
	}

	const nextDocument = { ...document, content: { ...document.content } };
	writeSectionContentValue({ document: nextDocument, locale, pointer, section, value });
	label?.pointers.forEach((labelPointer) =>
		writeSectionContentValue({
			document: nextDocument,
			locale,
			pointer: labelPointer,
			section,
			value: label.value,
		})
	);

	return nextDocument;
};

type MenuDropdownItemEdit = z.infer<typeof websiteMenuDropdownItemEditSchema> & {
	labelPointers: Array<string>;
	pointer: string;
};

const isDropdownIndicator = (value: JsonValue) => {
	const node = authoringJsonObjectSchema.safeParse(value);
	const props = node.success ? authoringJsonObjectSchema.safeParse(node.data.props) : undefined;

	return node?.success && node.data.type === "icon" && props?.success && props.data.name === "chevron-down";
};

const setDropdownIndicator = ({
	enabled,
	id,
	size,
	value,
}: {
	enabled: boolean;
	id: string;
	size: string;
	value: JsonValue | undefined;
}) => {
	const children = Array.isArray(value) ? value.filter((child) => !isDropdownIndicator(child)) : [];

	if (!enabled) {
		return children;
	}

	return [
		...children,
		jsonObjectSchema.parse({
			id,
			props: { name: "chevron-down", size, tone: "primary" },
			type: "icon",
		}),
	];
};

const createMenuDropdownAction = ({ item, sectionId }: { item: MenuDropdownItemEdit; sectionId: string }) =>
	jsonObjectSchema.parse({
		id: item.id,
		layout: {
			padding: {
				blockEnd: "0.5rem",
				blockStart: "0.5rem",
				inlineEnd: "0.75rem",
				inlineStart: "0.75rem",
			},
		},
		props: {
			children: [
				{
					id: entityIdFromSeed({ seed: `${sectionId}:menu-dropdown:${item.id}:label` }),
					props: {
						content: { $text: item.labelPointers[0] },
						element: "span",
						font: "body",
						fontSize: "1rem",
						tone: "current",
						weight: "normal",
					},
					type: "text",
				},
			],
			fill: "transparent",
			font: "body",
			fontSize: "1rem",
			foreground: "primary",
			href: { $link: item.pointer },
			radius: "0.5rem",
			weight: "normal",
		},
		type: "action",
	});

const editMenuItemRoot = ({
	elementId,
	insertion,
	items,
	kind,
	moveTo,
	root,
	sectionId,
}: {
	elementId: string;
	insertion?: { index: number; item: JsonObject; menuId: string };
	items?: Array<MenuDropdownItemEdit>;
	kind?: "dropdown" | "link";
	moveTo?: number;
	root: JsonValue;
	sectionId: string;
}) => {
	type MenuRootVisit = { found: boolean; value: JsonValue };

	const visit = (value: JsonValue): MenuRootVisit => {
		if (Array.isArray(value)) {
			const children = value.map(visit);

			return { found: children.some(({ found }) => found), value: children.map(({ value }) => value) };
		}

		const node = authoringJsonObjectSchema.safeParse(value);

		if (!node.success) {
			return { found: false, value };
		}

		const props = authoringJsonObjectSchema.safeParse(node.data.props);

		if (node.data.type === "menu" && props.success && Array.isArray(props.data.items)) {
			if (insertion && insertion.menuId === node.data.id) {
				if (insertion.index > props.data.items.length) {
					throw new WebsiteEditError();
				}

				return {
					found: true,
					value: jsonObjectSchema.parse({
						...node.data,
						props: { ...props.data, items: props.data.items.toSpliced(insertion.index, 0, insertion.item) },
					}),
				};
			}

			const itemIndex = props.data.items.findIndex((candidate) => {
				const item = authoringJsonObjectSchema.safeParse(candidate);

				return !insertion && item.success && item.data.id === elementId;
			});

			if (moveTo !== undefined && itemIndex !== -1 && moveTo >= props.data.items.length) {
				throw new WebsiteEditError();
			}

			if (itemIndex !== -1) {
				if (moveTo !== undefined || !kind || !items) {
					const remaining = props.data.items.toSpliced(itemIndex, 1);

					const nextItems =
						moveTo === undefined
							? remaining
							: remaining.toSpliced(moveTo, 0, jsonValueSchema.parse(props.data.items[itemIndex]));

					return {
						found: true,
						value: jsonObjectSchema.parse({
							...node.data,
							props: { ...props.data, items: nextItems },
						}),
					};
				}

				const currentItem = authoringJsonObjectSchema.parse(props.data.items[itemIndex]);
				const currentPanel = Array.isArray(currentItem.panel) ? currentItem.panel : [];

				const panelItems = new Map(
					currentPanel.flatMap((candidate) => {
						const panelItem = authoringJsonObjectSchema.safeParse(candidate);
						const panelItemId = panelItem.success ? entityIdSchema.safeParse(panelItem.data.id) : undefined;

						return panelItem?.success && panelItemId?.success
							? [[panelItemId.data, panelItem.data] as const]
							: [];
					})
				);

				const { panel: _panel, ...itemWithoutPanel } = currentItem;
				const dropdown = kind === "dropdown";

				const nextItemValue: JsonObject = {
					...itemWithoutPanel,
					trigger: setDropdownIndicator({
						enabled: dropdown,
						id: entityIdFromSeed({ seed: `${sectionId}:menu:${elementId}:indicator` }),
						size: "0.625rem",
						value: jsonValueSchema.parse(currentItem.trigger),
					}),
				};

				if (currentItem.mobileTrigger !== undefined) {
					nextItemValue.mobileTrigger = setDropdownIndicator({
						enabled: dropdown,
						id: entityIdFromSeed({ seed: `${sectionId}:menu:${elementId}:mobile-indicator` }),
						size: "1.25rem",
						value: jsonValueSchema.parse(currentItem.mobileTrigger),
					});
				}

				if (dropdown) {
					nextItemValue.panel = items.map((item) =>
						jsonObjectSchema.parse(panelItems.get(item.id) ?? createMenuDropdownAction({ item, sectionId }))
					);
				}

				const nextItem = jsonObjectSchema.parse(nextItemValue);

				return {
					found: true,
					value: jsonObjectSchema.parse({
						...node.data,
						props: { ...props.data, items: props.data.items.with(itemIndex, nextItem) },
					}),
				};
			}
		}

		const children = Object.entries(node.data).map(
			([key, child]) => [key, visit(jsonValueSchema.parse(child))] as const
		);

		return {
			found: children.some(([, child]) => child.found),
			value: jsonObjectSchema.parse(Object.fromEntries(children.map(([key, child]) => [key, child.value]))),
		};
	};

	const result = visit(root);
	const nextRoot = siteNodeSchema.parse(result.value);

	if (!result.found || nextRoot.type !== "box") {
		throw new WebsiteEditError();
	}

	return nextRoot;
};

export const normalizeGeneratedHeaderMenu = ({
	homeItemIds,
	section,
}: {
	homeItemIds: ReadonlySet<string>;
	section: SiteSection;
}) => ({
	...section,
	root: listSectionLinkElementReferences({ node: section.root })
		.filter(({ menuRole }) => menuRole === "dropdown-trigger" || menuRole === "navigation-item")
		.reduce((root, { elementId, menuRole }) => {
			if (homeItemIds.has(elementId)) {
				return editMenuItemRoot({ elementId, root, sectionId: section.id });
			}

			return menuRole === "dropdown-trigger"
				? editMenuItemRoot({ elementId, items: [], kind: "link", root, sectionId: section.id })
				: root;
		}, section.root),
});

const writeSectionContentValue = ({
	document,
	locale,
	pointer,
	section,
	value,
}: {
	document: SiteDocument;
	locale: Iso6391LanguageCode;
	pointer: string;
	section: SiteSection;
	value: JsonValue;
}) => {
	const localeContent = document.content[locale] ?? { pages: {}, sections: {}, site: {} };
	const sectionContent = localeContent.sections[section.contentId];

	document.content[locale] = {
		...localeContent,
		sections: {
			...localeContent.sections,
			[section.contentId]: jsonObjectSchema.parse(
				writeContentPointer({
					nextValue: value,
					segments: decodeContentPointer({ pointer }),
					value: sectionContent,
				})
			),
		},
	};
};

const updateWebsiteMenuItem = ({
	document,
	elementId,
	items,
	kind,
	label,
	locale,
	sectionId,
	value,
}: {
	document: SiteDocument;
	elementId: string;
	items: Array<z.infer<typeof websiteMenuDropdownItemEditSchema>>;
	kind: "dropdown" | "link";
	label: string;
	locale: Iso6391LanguageCode;
	sectionId: string;
	value: LinkValue;
}) => {
	const nextDocument = structuredClone(document);
	const section = findWebsiteSection({ document: nextDocument, sectionId });
	const references = section ? listSectionLinkElementReferences({ node: section.root }) : [];

	const menuItem = references.find(
		(reference) => reference.elementId === elementId && reference.menuItemId === elementId
	);

	const existingItems = new Map(
		references
			.filter((reference) => reference.menuItemId === elementId && reference.menuRole === "dropdown-item")
			.map((reference) => [reference.elementId, reference])
	);

	const itemIds = new Set(items.map((item) => item.id));

	if (
		!section ||
		!menuItem ||
		!document.locales.includes(locale) ||
		(kind === "dropdown" ? items.length === 0 : items.length !== 0) ||
		itemIds.size !== items.length
	) {
		throw new WebsiteEditError();
	}

	const resolvedItems = items.map<MenuDropdownItemEdit>((item) => {
		const existing = existingItems.get(item.id);
		const contentBase = `/authoring/menu/${elementId}/items/${item.id}`;

		return {
			...item,
			labelPointers: existing?.labels.map(({ pointer }) => pointer) ?? [`${contentBase}/label`],
			pointer: existing?.pointer ?? `${contentBase}/link`,
		};
	});

	writeSectionContentValue({ document: nextDocument, locale, pointer: menuItem.pointer, section, value });
	menuItem.labels.forEach(({ pointer }) =>
		writeSectionContentValue({ document: nextDocument, locale, pointer, section, value: label })
	);

	resolvedItems.forEach((item) => {
		const locales = existingItems.has(item.id) ? [locale] : [...new Set([document.defaultLocale, locale])];

		locales.forEach((itemLocale) => {
			writeSectionContentValue({
				document: nextDocument,
				locale: itemLocale,
				pointer: item.pointer,
				section,
				value: item.value,
			});
			item.labelPointers.forEach((pointer) =>
				writeSectionContentValue({
					document: nextDocument,
					locale: itemLocale,
					pointer,
					section,
					value: item.label,
				})
			);
		});
	});

	section.root = editMenuItemRoot({ elementId, items: resolvedItems, kind, root: section.root, sectionId });

	return nextDocument;
};

const insertWebsiteMenuItem = ({
	document,
	...input
}: { document: SiteDocument } & Extract<
	z.infer<typeof websiteMenuItemEditInputSchema>,
	{ operation: "add-menu-item" }
>) => {
	const nextDocument = structuredClone(document);
	const section = nextDocument.structure.layout.header.find(({ id }) => id === input.sectionId);

	if (!section || !document.locales.includes(input.locale)) {
		throw new WebsiteEditError();
	}

	const contentBase = `/authoring/menu/${input.menuId}/items/${input.elementId}`;

	const trigger = [
		{
			id: entityIdFromSeed({ seed: `${input.elementId}:label` }),
			props: {
				content: { $text: `${contentBase}/label` },
				element: "span",
				font: "body",
				fontSize: "1rem",
				tone: "current",
				weight: "normal",
			},
			type: "text",
		},
	];

	section.root = editMenuItemRoot({
		elementId: input.elementId,
		insertion: {
			index: input.index,
			item: jsonObjectSchema.parse({ href: { $link: `${contentBase}/link` }, id: input.elementId, trigger }),
			menuId: input.menuId,
		},
		root: section.root,
		sectionId: section.id,
	});

	for (const locale of new Set([document.defaultLocale, input.locale])) {
		writeSectionContentValue({
			document: nextDocument,
			locale,
			pointer: `${contentBase}/label`,
			section,
			value: input.label,
		});
		writeSectionContentValue({
			document: nextDocument,
			locale,
			pointer: `${contentBase}/link`,
			section,
			value: input.value,
		});
	}

	return nextDocument;
};

const editWebsiteMenuItemPosition = ({
	document,
	elementId,
	index,
	sectionId,
}: {
	document: SiteDocument;
	elementId: string;
	index?: number;
	sectionId: string;
}) => {
	const nextDocument = structuredClone(document);
	const section = findWebsiteSection({ document: nextDocument, sectionId });

	if (!section) {
		throw new WebsiteEditError();
	}

	section.root = editMenuItemRoot({ elementId, moveTo: index, root: section.root, sectionId });

	return nextDocument;
};

const mapValueAtPointer = ({
	map,
	segments,
	value,
}: {
	map: (value: JsonValue | undefined) => JsonValue;
	segments: Array<string>;
	value: JsonValue | undefined;
}): JsonValue => {
	const [segment, ...remaining] = segments;

	if (!segment) {
		return map(value);
	}

	if (Array.isArray(value)) {
		if (!isContentArrayIndex({ segment })) {
			throw new WebsiteEditError();
		}

		return value.with(
			Number(segment),
			mapValueAtPointer({ map, segments: remaining, value: value[Number(segment)] })
		);
	}

	const object = jsonObjectSchema.safeParse(value);

	if (!object.success) {
		throw new WebsiteEditError();
	}

	return jsonObjectSchema.parse({
		...object.data,
		[segment]: mapValueAtPointer({ map, segments: remaining, value: object.data[segment] }),
	});
};

const readAuthoringValueAtPointer = ({ pointer, value }: { pointer: string; value: JsonValue }) =>
	decodeContentPointer({ pointer }).reduce<JsonValue | undefined>((current, segment) => {
		if (Array.isArray(current)) {
			return isContentArrayIndex({ segment }) ? current[Number(segment)] : undefined;
		}

		const object = jsonObjectSchema.safeParse(current);

		return object.success ? object.data[segment] : undefined;
	}, value);

type CollectionEditResult = {
	nextItems: JsonObject;
	nextOrder: Array<string>;
	nextTarget: Array<JsonValue>;
};

const addWebsiteCollectionItem = ({
	cloneItem,
	createEntry,
	itemId,
	items,
	max,
	order,
	target,
}: {
	cloneItem: (item: JsonValue) => JsonValue;
	createEntry: ({ index, order }: { index: number; order: Array<string> }) => Array<JsonValue>;
	itemId: string;
	items: JsonObject;
	max: number;
	order: Array<string>;
	target: Array<JsonValue>;
}): CollectionEditResult => {
	const previousItemId = order.at(-1);
	const previousItem = previousItemId ? items[previousItemId] : undefined;

	if (order.length >= max || order.includes(itemId) || !previousItemId || previousItem === undefined) {
		throw new WebsiteEditError();
	}

	const nextOrder = [...order, itemId];

	return {
		nextItems: { ...items, [itemId]: cloneItem(previousItem) },
		nextOrder,
		nextTarget: [...target, ...createEntry({ index: order.length, order: nextOrder })],
	};
};

const deleteWebsiteCollectionItem = ({
	entrySize,
	itemId,
	items,
	min,
	order,
	target,
}: {
	entrySize: ({ index }: { index: number }) => number;
	itemId: string;
	items: JsonObject;
	min: number;
	order: Array<string>;
	target: Array<JsonValue>;
}): CollectionEditResult => {
	const itemIndex = order.indexOf(itemId);

	if (order.length <= min || itemIndex === -1) {
		throw new WebsiteEditError();
	}

	const targetIndex = order.slice(0, itemIndex).reduce((offset, _id, index) => offset + entrySize({ index }), 0);
	const deleteCount = entrySize({ index: itemIndex });

	if (deleteCount < 1 || targetIndex + deleteCount > target.length) {
		throw new WebsiteEditError();
	}

	return {
		nextItems: Object.fromEntries(Object.entries(items).filter(([id]) => id !== itemId)),
		nextOrder: order.filter((id) => id !== itemId),
		nextTarget: target.toSpliced(targetIndex, deleteCount),
	};
};

const updateLocalizedCollection = ({
	cloneItem,
	collection,
	content,
	includeOrder,
	itemId,
	nextItems,
	nextOrder,
	operation,
	previousItemId,
}: {
	cloneItem: (item: JsonValue) => JsonValue;
	collection: string;
	content: JsonValue;
	includeOrder: boolean;
	itemId: string;
	nextItems: JsonObject;
	nextOrder: Array<string>;
	operation: "add-collection-item" | "delete-collection-item";
	previousItemId?: string;
}) =>
	mapValueAtPointer({
		map: (value) => {
			const object = jsonObjectSchema.parse(value);
			const localeItems = jsonObjectSchema.parse(object.items);
			const previousItem = previousItemId ? localeItems[previousItemId] : undefined;

			if (operation === "add-collection-item" && previousItem === undefined) {
				throw new WebsiteEditError();
			}

			const localizedItems =
				operation === "add-collection-item" && previousItem !== undefined
					? { ...localeItems, [itemId]: cloneItem(previousItem) }
					: Object.fromEntries(Object.entries(localeItems).filter(([id]) => id !== itemId));

			const nextCollection: JsonObject = {
				...object,
				items: includeOrder ? nextItems : localizedItems,
			};

			if (includeOrder) {
				nextCollection.order = nextOrder;
			}

			return jsonObjectSchema.parse(nextCollection);
		},
		segments: decodeContentPointer({ pointer: collection }),
		value: content,
	});

const parseCollectionPointer = ({ collection }: { collection: string }) => {
	const segments = decodeContentPointer({ pointer: collection });

	const itemsIndex = segments.findIndex(
		(segment, index) => segment === "items" && entityIdSchema.safeParse(segments[index + 1]).success
	);

	if (itemsIndex === -1) {
		return { pattern: collection };
	}

	return {
		parentCollection: encodeContentPointer({ segments: segments.slice(0, itemsIndex) }),
		parentId: segments[itemsIndex + 1],
		pattern: encodeContentPointer({
			segments: [...segments.slice(0, itemsIndex), "*", ...segments.slice(itemsIndex + 2)],
		}),
	};
};

const resolveNestedCollectionTarget = ({
	parent,
	parentIndex,
	repeater,
}: {
	parent: SectionRepeater;
	parentIndex: number;
	repeater: SectionRepeater;
}) => {
	const [entryOffset, ...rest] = decodeContentPointer({ pointer: repeater.target });

	const parentEntryStart = Array.from({ length: parentIndex }).reduce<number>(
		(offset, _entry, index) => offset + parent.createValues({ index, parentIndex: 0 }).length,
		0
	);

	return encodeContentPointer({
		segments: [
			...decodeContentPointer({ pointer: parent.target }),
			String(parentEntryStart + Number(entryOffset)),
			...rest,
		],
	});
};

const readPersistedCollection = ({ pointer, value }: { pointer: string; value: JsonValue | undefined }) => {
	const parsed = jsonObjectSchema.safeParse(readContentPointer({ pointer, value }));
	const order = parsed.success ? collectionOrderSchema.safeParse(parsed.data.order) : undefined;
	const items = parsed.success ? jsonObjectSchema.safeParse(parsed.data.items) : undefined;

	return order?.success && items?.success ? { items: items.data, order: order.data } : undefined;
};

const resolveCollectionEditContext = ({
	collection,
	document,
	sectionId,
}: {
	collection: string;
	document: SiteDocument;
	sectionId: string;
}) => {
	const section = findWebsiteSection({ document, sectionId });
	const definition = getSectionDefinition(section);
	const { parentCollection, parentId, pattern } = parseCollectionPointer({ collection });
	const repeater = definition?.repeaters?.find((candidate) => candidate.collection === pattern);

	const parent = parentCollection
		? definition?.repeaters?.find((candidate) => candidate.collection === parentCollection)
		: undefined;

	const defaultSectionContent = section
		? document.content[document.defaultLocale]?.sections[section.contentId]
		: undefined;

	const persisted = readPersistedCollection({ pointer: collection, value: defaultSectionContent });

	const parentPersisted = parentCollection
		? readPersistedCollection({ pointer: parentCollection, value: defaultSectionContent })
		: undefined;

	const parentIndex = parentPersisted && parentId ? parentPersisted.order.indexOf(parentId) : 0;

	if (
		!section ||
		!definition ||
		!repeater ||
		repeater.editable === false ||
		!persisted ||
		(parentCollection && (!parent || !parentPersisted || parentIndex < 0))
	) {
		throw new WebsiteEditError();
	}

	return {
		defaultSectionContent,
		definition,
		items: persisted.items,
		order: persisted.order,
		parent,
		parentCollection,
		parentIndex,
		parentOrder: parentPersisted?.order,
		repeater,
		section,
	};
};

type NestedIdRemap = { child: SectionRepeater; ids: Map<string, string>; suffix: string };

const remapNestedCollectionIds = ({ item, remaps }: { item: JsonValue; remaps: Array<NestedIdRemap> }) =>
	remaps.reduce<JsonValue>((current, { ids, suffix }) => {
		const pointer = `/${suffix}`;

		if (readContentPointer({ pointer, value: current }) === undefined) {
			return current;
		}

		return mapValueAtPointer({
			map: (value) => {
				const collection = jsonObjectSchema.parse(value);
				const nestedItems = jsonObjectSchema.parse(collection.items);
				const order = collectionOrderSchema.safeParse(collection.order);

				return jsonObjectSchema.parse({
					...collection,
					items: Object.fromEntries(
						Object.entries(nestedItems).map(([id, entry]) => [ids.get(id) ?? id, entry])
					),
					...(order.success && { order: order.data.map((id) => ids.get(id) ?? id) }),
				});
			},
			segments: decodeContentPointer({ pointer }),
			value: current,
		});
	}, structuredClone(item));

const editWebsiteCollection = ({
	collection,
	document,
	itemId,
	operation,
	sectionId,
}: {
	collection: string;
	document: SiteDocument;
	itemId: string;
	operation: "add-collection-item" | "delete-collection-item";
	sectionId: string;
}) => {
	const {
		defaultSectionContent,
		definition,
		items,
		order,
		parent,
		parentCollection,
		parentIndex,
		parentOrder,
		repeater,
		section,
	} = resolveCollectionEditContext({ collection, document, sectionId });

	const targetPointer = parent ? resolveNestedCollectionTarget({ parent, parentIndex, repeater }) : repeater.target;

	const target = readAuthoringValueAtPointer({ pointer: targetPointer, value: section.root });

	if (!Array.isArray(target)) {
		throw new WebsiteEditError();
	}

	const createId = ({ kind, path }: { kind: EntityIdKind; path: string }) =>
		entityIdFromSeed({ seed: `website-collection:${section.id}:${itemId}:${kind}:${path}` });

	const nestedRemaps: Array<NestedIdRemap> =
		operation === "add-collection-item" && !parent
			? listNestedRepeaters({ definition, repeater }).map((child) => {
					const suffix = child.collection.slice(`${repeater.collection}/*/`.length);

					const nestedOrder = collectionOrderSchema.safeParse(
						readContentPointer({
							pointer: `${collection}/items/${order.at(-1)}/${suffix}/order`,
							value: defaultSectionContent,
						})
					);

					if (!nestedOrder.success) {
						throw new WebsiteEditError();
					}

					return {
						child,
						ids: new Map(
							nestedOrder.data.map((id, index) => [
								id,
								createId({ kind: "collection-item", path: `${child.collection}/${index}` }),
							])
						),
						suffix,
					};
				})
			: [];

	const cloneItem = (item: JsonValue) => remapNestedCollectionIds({ item, remaps: nestedRemaps });

	const { nextItems, nextOrder, nextTarget } =
		operation === "add-collection-item"
			? addWebsiteCollectionItem({
					cloneItem,
					createEntry: ({ index, order: nextOrder }) =>
						instantiateSectionRepeaterValues({
							collectionIds: new Map([
								...(parent && parentOrder && parentCollection
									? [[parentCollection, parentOrder] as const]
									: []),
								[resolveRepeaterCollection({ parentIndex, repeater }), nextOrder],
								...nestedRemaps.map(
									({ child, ids }) =>
										[
											resolveRepeaterCollection({ parentIndex: index, repeater: child }),
											[...ids.values()],
										] as const
								),
							]),
							createId,
							definition,
							index,
							parentIndex,
							path: `${targetPointer}/${index}`,
							repeater,
						}),
					itemId,
					items,
					max: repeater.max,
					order,
					target,
				})
			: deleteWebsiteCollectionItem({
					entrySize: ({ index }) => repeater.createValues({ index, parentIndex }).length,
					itemId,
					items,
					min: repeater.min,
					order,
					target,
				});

	const nextDocument = structuredClone(document);
	const nextSection = findWebsiteSection({ document: nextDocument, sectionId });

	if (!nextSection) {
		throw new WebsiteEditError();
	}

	const nextRoot = siteNodeSchema.parse(
		mapValueAtPointer({
			map: () => nextTarget,
			segments: decodeContentPointer({ pointer: targetPointer }),
			value: nextSection.root,
		})
	);

	if (nextRoot.type !== "box") {
		throw new WebsiteEditError();
	}

	nextSection.root = nextRoot;

	Object.entries(nextDocument.content).forEach(([locale, localeContent]) => {
		const sectionContent = localeContent.sections[section.contentId];

		if (!sectionContent) {
			return;
		}

		if (readContentPointer({ pointer: collection, value: sectionContent }) === undefined) {
			return;
		}

		localeContent.sections[section.contentId] = jsonObjectSchema.parse(
			updateLocalizedCollection({
				cloneItem,
				collection,
				content: sectionContent,
				includeOrder: locale === document.defaultLocale,
				itemId,
				nextItems,
				nextOrder,
				operation,
				previousItemId: order.at(-1),
			})
		);
	});

	return nextDocument;
};

const applyWebsiteLanguageEdit = <Website extends Pick<WebsiteSnapshotV1, "brand" | "document">>({
	input,
	snapshot,
}: {
	input: Extract<WebsiteEditInput, { operation: "add-language" | "set-default-language" | "remove-language" }>;
	snapshot: Website;
}) => {
	const { brand, document } = snapshot;

	if (input.operation === "remove-language") {
		if (input.locale === document.defaultLocale || !document.locales.includes(input.locale)) {
			throw new WebsiteEditError();
		}

		const locales = document.locales.filter((locale) => locale !== input.locale);

		const content = Object.fromEntries(
			Object.entries(document.content).filter(([locale]) => locale !== input.locale)
		);

		return { ...snapshot, brand: { ...brand, locales }, document: { ...document, content, locales } };
	}

	const adding = input.operation === "add-language";

	if (adding === document.locales.includes(input.locale)) {
		throw new WebsiteEditError();
	}

	const locales = adding ? [...document.locales, input.locale] : document.locales;
	const defaultLocale = adding ? document.defaultLocale : input.locale;

	const content = adding
		? (input.content ?? document.content[document.defaultLocale])
		: mergeContentValue({
				fallback: document.content[document.defaultLocale],
				localized: document.content[input.locale],
			});

	return {
		...snapshot,
		brand: { ...brand, defaultLocale, locales },
		document: {
			...document,
			content: { ...document.content, [input.locale]: localeContentSchema.parse(content) },
			defaultLocale,
			direction: undefined,
			locales,
		},
	};
};

type WebsiteMetadataEdit = Extract<
	WebsiteEditInput,
	{
		operation:
			| "add-language"
			| "set-default-language"
			| "update-settings"
			| "remove-language"
			| "set-blog-navigation"
			| "update-page-seo"
			| "update-brand";
	}
>;

const isWebsiteMetadataEdit = (input: WebsiteEditInput): input is WebsiteMetadataEdit =>
	[
		"add-language",
		"set-default-language",
		"update-settings",
		"remove-language",
		"set-blog-navigation",
		"update-page-seo",
		"update-brand",
	].includes(input.operation);

const applyPageSeoEdit = <Document extends WebsiteSnapshotV1["document"]>({
	document,
	input,
}: {
	document: Document;
	input: Extract<WebsiteEditInput, { operation: "update-page-seo" }>;
}) => {
	const content = document.content[input.locale];

	if (!content || !document.structure.pages.some((page) => page.id === input.pageId)) {
		throw new WebsiteEditError();
	}

	const page = content.pages[input.pageId] ?? {};

	const seo = {
		...page.seo,
		description: input.description || undefined,
		title: input.title,
	};

	return {
		...document,
		content: {
			...document.content,
			[input.locale]: { ...content, pages: { ...content.pages, [input.pageId]: { ...page, seo } } },
		},
	};
};

const applyWebsiteMetadataEdit = <Website extends Pick<WebsiteSnapshotV1, "brand" | "document">>({
	input,
	snapshot,
}: {
	input: WebsiteMetadataEdit;
	snapshot: Website;
}) => {
	if (
		input.operation === "add-language" ||
		input.operation === "set-default-language" ||
		input.operation === "remove-language"
	) {
		return applyWebsiteLanguageEdit({ input, snapshot });
	}

	if (input.operation === "update-settings") {
		return { ...snapshot, document: { ...snapshot.document, settings: input.settings } };
	}

	if (input.operation === "set-blog-navigation") {
		return { ...snapshot, document: { ...snapshot.document, blogNavigationHidden: !input.visible } };
	}

	if (input.operation === "update-page-seo") {
		return { ...snapshot, document: applyPageSeoEdit({ document: snapshot.document, input }) };
	}

	return { ...snapshot, brand: input.brand };
};

const applyWebsiteSnapshotEdit = <Website extends Pick<WebsiteSnapshotV1, "brand" | "document">>({
	input,
	snapshot,
}: {
	input: WebsiteEditInput;
	snapshot: Website;
}) => {
	const result = websiteEditInputSchema.safeParse(input);

	if (!result.success) {
		throw new WebsiteEditError();
	}

	const parsed = result.data;

	if (isWebsiteMetadataEdit(parsed)) {
		return applyWebsiteMetadataEdit({ input: parsed, snapshot });
	}

	try {
		if (parsed.operation === "add-composed-section") {
			return {
				...snapshot,
				document: applyComposedSectionAddition({ document: snapshot.document, ...parsed }),
			};
		}

		if (parsed.operation === "update-section") {
			const structureDocument = parsed.structure
				? applyComposedStructureUpdate({
						document: snapshot.document,
						...parsed,
						structure: parsed.structure,
					})
				: snapshot.document;

			const contentDocument =
				parsed.content && !parsed.structure && !parsed.bindings
					? applyComposedContentUpdate({
							document: structureDocument,
							...parsed,
							content: parsed.content,
						})
					: structureDocument;

			const document = (() => {
				if ((parsed.logic === undefined || parsed.structure) && !parsed.bindings) {
					return contentDocument;
				}

				return parsed.logic === null
					? applySectionLogicRemoval({ document: contentDocument, ...parsed })
					: applySectionLogic({
							document: contentDocument,
							...parsed,
							logic: z.parse(sectionLogicSchema, parsed.logic),
						});
			})();

			return {
				...snapshot,
				document,
			};
		}

		if (parsed.operation === "update-media") {
			return { ...snapshot, document: updateWebsiteMedia({ document: snapshot.document, ...parsed }) };
		}

		if (parsed.operation === "update-text") {
			return {
				...snapshot,
				document: updateWebsiteText({ document: snapshot.document, ...parsed }),
			};
		}

		if (parsed.operation === "update-link") {
			return {
				...snapshot,
				document: updateWebsiteLink({ document: snapshot.document, ...parsed }),
			};
		}

		if (parsed.operation === "update-menu-item") {
			return {
				...snapshot,
				document: updateWebsiteMenuItem({ document: snapshot.document, ...parsed }),
			};
		}

		if (parsed.operation === "add-menu-item") {
			return { ...snapshot, document: insertWebsiteMenuItem({ document: snapshot.document, ...parsed }) };
		}

		if (parsed.operation === "delete-menu-item" || parsed.operation === "move-menu-item") {
			return {
				...snapshot,
				document: editWebsiteMenuItemPosition({ document: snapshot.document, ...parsed }),
			};
		}

		if (parsed.operation === "add-collection-item" || parsed.operation === "delete-collection-item") {
			return {
				...snapshot,
				document: editWebsiteCollection({ document: snapshot.document, ...parsed }),
			};
		}

		if (parsed.operation === "replace-section-root") {
			return {
				...snapshot,
				document: replaceWebsiteSectionRoot({ document: snapshot.document, ...parsed }),
			};
		}

		return {
			...snapshot,
			document: applyWebsitePageSectionEdit({ document: snapshot.document, ...parsed }),
		};
	} catch (error) {
		if (error instanceof BehaviorSectionError) {
			throw new WebsiteEditError(error.message);
		}

		if (error instanceof SiteDocumentValidationError) {
			throw new WebsiteEditError();
		}

		if (error instanceof WebsitePageSectionEditError) {
			throw new WebsiteEditError();
		}

		throw error;
	}
};

const finalizeWebsiteSnapshot = <Website extends Pick<WebsiteSnapshotV1, "brand" | "document">>({
	draft,
	originalDocument,
}: {
	draft: Website;
	originalDocument: SiteDocument;
}) => {
	try {
		const document = parseSiteDocument(draft.document);

		return draft.document === originalDocument ? draft : { ...draft, document };
	} catch (error) {
		if (error instanceof SiteDocumentValidationError) {
			const issue = error.issues[0];
			throw new WebsiteEditError(issue ? `${issue.code}: ${issue.message}` : undefined);
		}

		throw error;
	}
};

export const editWebsiteSnapshot = <Website extends Pick<WebsiteSnapshotV1, "brand" | "document">>({
	input,
	snapshot,
}: {
	input: WebsiteEditInput;
	snapshot: Website;
}) => {
	const draft = applyWebsiteSnapshotEdit({ input, snapshot });

	return finalizeWebsiteSnapshot({ draft, originalDocument: snapshot.document });
};

export const editWebsiteSnapshots = <Website extends Pick<WebsiteSnapshotV1, "brand" | "document">>({
	inputs,
	snapshot,
}: {
	inputs: Array<WebsiteEditInput>;
	snapshot: Website;
}) => {
	if (inputs.length === 0) {
		throw new WebsiteEditError();
	}

	const draft = inputs.reduce((current, input) => applyWebsiteSnapshotEdit({ input, snapshot: current }), snapshot);

	return finalizeWebsiteSnapshot({ draft, originalDocument: snapshot.document });
};
