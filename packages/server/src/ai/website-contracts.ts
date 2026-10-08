import { jsonSchema, zodSchema } from "ai";
import { z } from "zod";

import {
	BehaviorSectionError,
	composedSectionAnchorSchema,
	composedSectionCategorySchema,
	composedSectionSpecificationSchema,
	contentMapKeySchema,
	blockingSectionDiagnostics,
	diagnoseComposedSection,
	iso6391LanguageCodeSchema,
	linkValueSchema,
	prepareSectionLogic,
	sectionContentSchema,
	sectionLogicAuthoringSchema,
	sectionAuthoringResourceLimits,
	sectionNodeKeySchema,
	sectionStructureNodePatchSchema,
	sectionStructureNodeProviderSchema,
	sectionStructureSchema,
	type LinkValue,
} from "@starter/infinite-website/editing";

export const websitePageHandleSchema = z.compile(
	z.string().regex(/^p\d+$/u, "Use an inspected page handle such as p0")
);

export const websiteSectionHandleSchema = z.compile(
	z.string().regex(/^s\d+$/u, "Use an inspected section handle such as s0")
);

export const websiteTextHandleSchema = z.compile(
	z.string().regex(/^t\d+$/u, "Use an inspected text handle such as t0")
);

export const websiteLinkHandleSchema = z.compile(
	z.string().regex(/^l\d+$/u, "Use an inspected link handle such as l0")
);

const localizedCopySchema = z.strictObject({
	ar: z.string().min(1).max(20_000),
	en: z.string().min(1).max(20_000),
});

export const websiteCopySchema = z.compile(
	z
		.record(contentMapKeySchema, localizedCopySchema)
		.refine(
			(copy) => new TextEncoder().encode(JSON.stringify(copy)).byteLength <= sectionAuthoringResourceLimits.bytes,
			`Section copy exceeds the limit of ${sectionAuthoringResourceLimits.bytes} bytes`
		)
		.describe("Changed copy keyed once, with required English and Arabic values together.")
);

export const websiteImagesSchema = z.compile(
	z
		.record(
			contentMapKeySchema,
			z
				.strictObject({
					alt: localizedCopySchema,
					fileId: z.uuid().optional(),
					query: z.string().trim().min(2).max(160).optional(),
				})
				.refine(
					(image) => Boolean(image.fileId) !== Boolean(image.query),
					"Provide either an uploaded fileId or a search query"
				)
		)
		.refine(
			(images) => Object.keys(images).length <= sectionAuthoringResourceLimits.media,
			`A section accepts at most ${sectionAuthoringResourceLimits.media} images`
		)
		.refine(
			(images) =>
				new TextEncoder().encode(JSON.stringify(images)).byteLength <= sectionAuthoringResourceLimits.bytes,
			`Section images exceed the limit of ${sectionAuthoringResourceLimits.bytes} bytes`
		)
		.describe("Images keyed by the media node asset key. The server owns URLs and asset IDs.")
);

export type WebsiteImages = z.infer<typeof websiteImagesSchema>;

export const materializeWebsiteCopy = ({
	assets,
	copy,
	images,
	links,
	structure,
}: {
	assets?: Record<string, string>;
	copy: z.infer<typeof websiteCopySchema> | undefined;
	images: WebsiteImages | undefined;
	links?: Record<string, LinkValue>;
	structure: z.infer<typeof sectionStructureSchema>;
}) => {
	const en = Object.fromEntries(Object.entries(copy ?? {}).map(([key, value]) => [key, value.en]));
	const ar = Object.fromEntries(Object.entries(copy ?? {}).map(([key, value]) => [key, value.ar]));

	Object.entries(images ?? {}).forEach(([asset, image]) => {
		const media = structure.nodes.find((node) => node.type === "media" && node.props.asset === asset);

		if (!media || media.type !== "media") {
			throw new BehaviorSectionError(`Media asset key "${asset}" is not used`);
		}

		en[media.props.alt] = image.alt.en;
		ar[media.props.alt] = image.alt.ar;
	});

	return sectionContentSchema.parse({
		ar,
		assets: assets && Object.keys(assets).length > 0 ? assets : undefined,
		en,
		links: links && Object.keys(links).length > 0 ? links : undefined,
	});
};

const findReplaceTextEditSchema = z.strictObject({
	find: z.string().min(1).max(200),
	locale: iso6391LanguageCodeSchema.optional(),
	operation: z.literal("find-replace-text"),
	replace: z.string().max(200),
});

const textEditSchema = z.strictObject({
	locale: iso6391LanguageCodeSchema,
	operation: z.literal("update-text"),
	section: websiteSectionHandleSchema,
	target: websiteTextHandleSchema,
	value: z.string().max(20_000),
});

const [
	externalLinkSchema,
	relativeLinkSchema,
	_pageLinkSchema,
	_sectionLinkSchema,
	anchorLinkSchema,
	emailLinkSchema,
	phoneLinkSchema,
	bookingLinkSchema,
] = linkValueSchema.options;

export const websiteLinkValueSchema = z.compile(
	z.discriminatedUnion("kind", [
		externalLinkSchema,
		relativeLinkSchema,
		z.strictObject({
			kind: z.literal("page"),
			page: websitePageHandleSchema,
			section: websiteSectionHandleSchema.optional(),
		}),
		z.strictObject({ kind: z.literal("section"), section: websiteSectionHandleSchema }),
		anchorLinkSchema,
		emailLinkSchema,
		phoneLinkSchema,
		bookingLinkSchema,
	])
);

export type WebsiteLinkValue = z.infer<typeof websiteLinkValueSchema>;

const websiteLinksSchema = z.compile(
	z
		.record(contentMapKeySchema, websiteLinkValueSchema)
		.refine(
			(links) => Object.keys(links).length <= sectionAuthoringResourceLimits.nodes,
			`A section accepts at most ${sectionAuthoringResourceLimits.nodes} links`
		)
		.describe("Typed action destinations keyed by each action node's link content key.")
);

export type WebsiteLinks = z.infer<typeof websiteLinksSchema>;

const placeholderEntityId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d399";

const linkEditSchema = z.strictObject({
	label: z.string().max(20_000).optional(),
	locale: iso6391LanguageCodeSchema,
	operation: z.literal("update-link"),
	section: websiteSectionHandleSchema,
	target: websiteLinkHandleSchema,
	value: websiteLinkValueSchema,
});

const collectionEditSchema = z.discriminatedUnion("operation", [
	z.strictObject({
		collection: z.string().regex(/^c\d+$/u),
		operation: z.literal("add-collection-item"),
		section: websiteSectionHandleSchema,
	}),
	z.strictObject({
		collection: z.string().regex(/^c\d+$/u),
		item: z.string().regex(/^i\d+$/u),
		operation: z.literal("delete-collection-item"),
		section: websiteSectionHandleSchema,
	}),
]);

const copyEditSchema = z.strictObject({
	copy: websiteCopySchema,
	operation: z.literal("update-copy"),
	section: websiteSectionHandleSchema,
});

const menuEditSchema = z.discriminatedUnion("operation", [
	z.strictObject({
		operation: z.literal("delete-menu-item"),
		section: websiteSectionHandleSchema,
		target: websiteLinkHandleSchema,
	}),
	z.strictObject({
		items: z
			.array(
				z.strictObject({
					label: z.string().min(1).max(1000),
					target: websiteLinkHandleSchema.optional(),
					value: websiteLinkValueSchema,
				})
			)
			.max(12),
		kind: z.enum(["dropdown", "link"]),
		label: z.string().min(1).max(1000),
		locale: iso6391LanguageCodeSchema,
		operation: z.literal("update-menu-item"),
		section: websiteSectionHandleSchema,
		target: websiteLinkHandleSchema,
		value: websiteLinkValueSchema,
	}),
]);

export const websiteSectionEditSchema = z.discriminatedUnion("operation", [
	z.strictObject({ operation: z.literal("delete"), section: websiteSectionHandleSchema }),
	z.strictObject({ operation: z.literal("move-up"), section: websiteSectionHandleSchema }),
	z.strictObject({ operation: z.literal("move-down"), section: websiteSectionHandleSchema }),
	z.strictObject({
		operation: z.literal("swap-layout"),
		pattern: z.string().min(1).max(100),
		section: websiteSectionHandleSchema,
	}),
]);

const websiteEditingEditSchema = z.discriminatedUnion("operation", [
	z.strictObject({
		alt: z
			.strictObject({
				ar: z.string().trim().max(300).optional(),
				en: z.string().trim().max(300).optional(),
			})
			.optional()
			.describe(
				"Alt text for the new image in English and Arabic. Describe the actual image. Omit to clear the alt text."
			),
		fileId: z
			.uuid()
			.describe(
				"Exact media file ID returned by listUploadedMedia, findStockImage or selectStockImage. Replaces this media slot in every locale."
			),
		operation: z.literal("update-media"),
		section: websiteSectionHandleSchema,
		target: z.string().regex(/^m\d+$/),
	}),
	...menuEditSchema.options,
	...websiteSectionEditSchema.options,
	textEditSchema,
	linkEditSchema,
	...collectionEditSchema.options,
	copyEditSchema,
	findReplaceTextEditSchema,
]);

export const editWebsiteToolInputSchema = z.compile(
	z.strictObject({
		edits: z.array(websiteEditingEditSchema).min(1).max(50),
		revision: z.string().min(1),
	})
);

const prepareValidSectionLogic = async ({
	context,
	logic,
}: {
	context: z.core.$RefinementCtx;
	logic: z.infer<typeof sectionLogicAuthoringSchema> | null | undefined;
}) => {
	if (!logic) {
		return undefined;
	}

	try {
		return await prepareSectionLogic(logic);
	} catch (error) {
		context.addIssue({
			code: "custom",
			message: error instanceof Error ? error.message : "Invalid section logic",
			path: ["logic"],
		});

		return null;
	}
};

export const buildWebsiteToolInputSchema = z
	.strictObject({
		copy: websiteCopySchema.optional(),
		images: websiteImagesSchema.optional(),
		links: websiteLinksSchema.optional(),
		logic: sectionLogicAuthoringSchema.nullable().optional(),
		nodes: z.array(sectionStructureNodePatchSchema).min(1).max(50).optional(),
		remove: z.array(sectionNodeKeySchema).min(1).max(50).optional(),
		revision: z.string().min(1),
		section: websiteSectionHandleSchema,
	})
	.refine(
		(input) =>
			input.nodes || input.remove || input.copy || input.logic !== undefined || input.images || input.links,
		"Provide at least one section change"
	)
	.superRefine(async (input, context) => {
		await prepareValidSectionLogic({ context, logic: input.logic });
	});

const composeWebsiteSectionObjectSchema = z.strictObject({
	anchor: composedSectionAnchorSchema.optional(),
	category: composedSectionCategorySchema.optional(),
	copy: websiteCopySchema,
	images: websiteImagesSchema.optional(),
	index: z.number().int().nonnegative(),
	links: websiteLinksSchema.optional(),
	logic: sectionLogicAuthoringSchema.optional(),
	page: websitePageHandleSchema,
	revision: z.string().min(1),
	structure: sectionStructureSchema,
});

const parseComposeSpecification = ({
	input,
	logic,
}: {
	input: z.infer<typeof composeWebsiteSectionObjectSchema>;
	logic: Awaited<ReturnType<typeof prepareSectionLogic>> | undefined;
}) => {
	const content = materializeWebsiteCopy({
		assets: Object.fromEntries(Object.keys(input.images ?? {}).map((key) => [key, placeholderEntityId])),
		copy: input.copy,
		images: input.images,
		links: input.links
			? Object.fromEntries(
					Object.entries(input.links).map(([key, value]) => {
						if (value.kind === "page") {
							return [
								key,
								{
									kind: "page" as const,
									pageId: placeholderEntityId,
									sectionId: value.section ? placeholderEntityId : undefined,
								},
							];
						}

						if (value.kind === "section") {
							return [key, { kind: "section" as const, sectionId: placeholderEntityId }];
						}

						return [key, value];
					})
				)
			: undefined,
		structure: input.structure,
	});

	return composedSectionSpecificationSchema.safeParse({ content, logic, structure: input.structure });
};

export const diagnoseComposeDraft = async (input: z.infer<typeof composeWebsiteSectionObjectSchema>) => {
	const parsed = parseComposeSpecification({
		input,
		logic: input.logic ? await prepareSectionLogic(input.logic) : undefined,
	});

	return parsed.success ? diagnoseComposedSection(parsed.data) : [];
};

export const composeWebsiteSectionToolInputSchema = z.compile(
	composeWebsiteSectionObjectSchema.superRefine(async (input, context) => {
		const logic = await prepareValidSectionLogic({ context, logic: input.logic });

		if (logic === null) {
			return;
		}

		try {
			const parsed = parseComposeSpecification({ input, logic });

			if (!parsed.success) {
				parsed.error.issues.forEach((issue) => {
					context.addIssue({ code: "custom", message: issue.message, path: issue.path });
				});

				return;
			}

			blockingSectionDiagnostics(diagnoseComposedSection(parsed.data)).forEach((issue) => {
				const index = input.structure.nodes.map(({ key }) => key).indexOf(issue.nodeKeys.at(0) ?? "");
				context.addIssue({
					code: "custom",
					message: `[${issue.code}] ${issue.message} Fix: ${issue.fix}`,
					path: index >= 0 ? ["structure", "nodes", index] : ["copy", ...issue.contentKeys.slice(0, 1)],
				});
			});
		} catch (error) {
			context.addIssue({
				code: "custom",
				message: error instanceof Error ? error.message : "Invalid copy",
				path: ["copy"],
			});
		}
	})
);

export type EditWebsiteToolInput = z.infer<typeof editWebsiteToolInputSchema>;

export type BuildWebsiteToolInput = z.infer<typeof buildWebsiteToolInputSchema>;

export type ComposeWebsiteSectionToolInput = z.infer<typeof composeWebsiteSectionToolInputSchema>;

const sectionLogicProviderFieldsSchema = z
	.array(z.strictObject({ initial: z.string(), key: z.string() }))
	.min(1)
	.max(sectionAuthoringResourceLimits.fields);

const sectionLogicProviderSchema = z
	.strictObject({
		events: z.union([z.record(z.string(), z.string()), z.array(z.string())]).optional(),
		expression: z.string().optional(),
		fields: sectionLogicProviderFieldsSchema,
		kind: z.enum(["expression", "script"]),
		outputs: z
			.union([
				z.record(z.string(), z.strictObject({ expression: z.string(), type: z.enum(["boolean", "decimal"]) })),
				z.array(z.string()).min(1).max(sectionAuthoringResourceLimits.outputs),
			])
			.optional(),
		script: z.string().optional(),
	})
	.describe(
		"Expression logic uses expression or typed named outputs. Script logic uses script plus output keys. fields declares decimal inputs; events are named anchors for expressions or event keys for scripts."
	);

const buildWebsiteProviderContract = z.strictObject({
	copy: websiteCopySchema.optional(),
	images: websiteImagesSchema.optional(),
	links: websiteLinksSchema.optional(),
	logic: sectionLogicProviderSchema.nullable().optional(),
	nodes: z.array(sectionStructureNodePatchSchema).min(1).max(50).optional(),
	remove: z.array(sectionNodeKeySchema).min(1).max(50).optional(),
	revision: z.string().min(1),
	section: websiteSectionHandleSchema,
});

const providerMutationNodeSchema = z.looseObject({ props: z.record(z.string(), z.json()) });

const omittedNullProviderFields = new Set(["copy", "images", "links", "nodes", "remove"]);

const emptyProviderLogicSchema = z.compile(z.union([z.null(), z.strictObject({})]));

const providerMutationValueSchema = z.looseObject({
	logic: z.json().optional(),
	structure: z.looseObject({ nodes: z.array(providerMutationNodeSchema) }).optional(),
});

const normalizeProviderMutation = ({ composing, value }: { composing: boolean; value: unknown }) => {
	const parsed = providerMutationValueSchema.safeParse(value);

	if (!parsed.success) {
		return value;
	}

	const omitLogic = composing && emptyProviderLogicSchema.safeParse(parsed.data.logic).success;

	for (const node of composing ? (parsed.data.structure?.nodes ?? []) : []) {
		for (const [key, prop] of Object.entries(node.props)) {
			if (prop === null) {
				delete node.props[key];
			}
		}
	}

	return Object.fromEntries(
		Object.entries(parsed.data).filter(
			([field, fieldValue]) =>
				!(fieldValue === null && omittedNullProviderFields.has(field)) && !(field === "logic" && omitLogic)
		)
	);
};

const nodeKeyedValueSchema = z.looseObject({
	nodes: z.array(z.looseObject({ key: z.string() })).optional(),
	structure: z.looseObject({ nodes: z.array(z.looseObject({ key: z.string() })).optional() }).optional(),
});

const locateIssue = ({ issue, value }: { issue: z.core.$ZodIssue; value: unknown }) => {
	const nodes = nodeKeyedValueSchema.safeParse(value).data;
	const keyed = issue.path[0] === "structure" ? nodes?.structure?.nodes : nodes?.nodes;
	const nodeIndex = issue.path.indexOf("nodes") + 1;

	const location = issue.path
		.map((segment, index) => {
			const key = index === nodeIndex && nodeIndex > 0 ? keyed?.[Number(segment)]?.key : undefined;

			if (key) {
				return `["${key}"]`;
			}

			return z.number().safeParse(segment).success ? `[${String(segment)}]` : `.${String(segment)}`;
		})
		.join("")
		.replace(/^\./u, "");

	return `${location || "input"}: ${issue.message}${issue.message.includes("Fix:") ? "" : " Fix: change only this value to one the schema allows."}`;
};

const exactProviderSchema = <Value>(provider: z.ZodType, exact: z.ZodType<Value>, composing = false) =>
	jsonSchema<Value>(zodSchema(provider, { useReferences: true }).jsonSchema, {
		validate: async (value) => {
			const normalized = normalizeProviderMutation({ composing, value });
			const parsed = await exact.safeParseAsync(normalized);

			return parsed.success
				? { success: true, value: parsed.data }
				: {
						error: new BehaviorSectionError(
							parsed.error.issues
								.map((issue) => locateIssue({ issue, value: normalized }))
								.join("\n")
								.slice(0, 3000)
						),
						success: false,
					};
		},
	});

export const buildWebsiteProviderInputSchema = z.compile(buildWebsiteProviderContract);

const buildWebsiteExactInputSchema = exactProviderSchema(buildWebsiteProviderContract, buildWebsiteToolInputSchema);

const composeWebsiteSectionProviderContract = z.strictObject({
	anchor: composedSectionAnchorSchema.optional().describe("Kebab-case anchor slug for the section's purpose."),
	category: composedSectionCategorySchema.optional().describe("Section category; defaults to content."),
	copy: websiteCopySchema,
	images: websiteImagesSchema.optional(),
	index: z.number().int().nonnegative(),
	links: websiteLinksSchema.optional(),
	logic: sectionLogicProviderSchema.nullable().optional(),
	page: websitePageHandleSchema,
	revision: z.string().min(1),
	structure: z.strictObject({
		nodes: z.array(sectionStructureNodeProviderSchema).min(1).max(64),
		root: sectionNodeKeySchema,
	}),
});

export const composeWebsiteSectionProviderInputSchema = z.compile(composeWebsiteSectionProviderContract);

const composeWebsiteSectionExactInputSchema = exactProviderSchema(
	composeWebsiteSectionProviderContract,
	composeWebsiteSectionToolInputSchema,
	true
);

const example = { page: "p0", revision: "2026-08-22T12:00:00.000Z", section: "s2" };

export const editWebsiteToolContract = {
	description:
		"Apply one revision-safe, atomic batch of content-only edits. Inspect in the same turn and use only its revision-scoped section, text, and link handles.",
	inputExamples: [
		{
			input: {
				edits: [
					{
						locale: "en" as const,
						operation: "update-text" as const,
						section: example.section,
						target: "t0",
						value: "A clearer heading",
					},
				],
				revision: example.revision,
			},
		},
	],
	inputSchema: editWebsiteToolInputSchema,
};

export const buildWebsiteToolContract = {
	description:
		"Modify exactly one inspected section. nodes patches by stable key: send only changed props or children for the same type; a type change requires complete props, and a new key requires a complete node. remove deletes keys. In node props, null unsets an optional prop. copy groups required English and Arabic values under each content key. images groups each asset search query or uploaded fileId with bilingual alt copy. links maps each action link key to a typed external, relative, page, section, anchor, email, phone, or booking intent; page and section destinations use inspected handles. Omit unchanged fields and use logic: null to remove logic. Only uploaded fileId may be a UUID. Never emit persistent website UUIDs, image URLs, CSS image backgrounds, an operation field, or an edits array.",
	inputExamples: [
		{
			input: {
				nodes: [
					{
						children: ["card-one", "card-two", "card-three"],
						key: "card-grid",
						props: { columns: { base: 1, compact: 3 }, gap: "6sp" },
						type: "grid" as const,
					},
				],
				revision: example.revision,
				section: example.section,
			},
		},
	],
	inputSchema: buildWebsiteExactInputSchema,
};

export const composeWebsiteSectionToolContract = {
	description:
		"Create one new bilingual custom section. index must be one of the inspected page's insertionIndexes. structure, copy, logic, images, and links are direct sibling fields. In node props, null means omitted. copy groups English and Arabic together once per key; images groups each search query or uploaded fileId with bilingual alt copy; links maps action link keys to typed destinations and uses inspected handles for page or section targets, the phone kind with an E.164 number for calls, and the email kind with an address for email. Every structure node uses key, type, props, and children. Omit logic for a static section; add it only for fields, computed values, or triggers. Only uploaded fileId may be a UUID. Never emit persistent website UUIDs, image URLs, CSS image backgrounds, or a specification wrapper. Inspect the destination page in the same turn and copy its outer-frame spacing.",
	inputExamples: [
		{
			input: {
				copy: {
					body: {
						ar: "نصنع كل قطعة يدويًا في مشغلنا، من تشكيل الطين حتى الحرق الأخير.",
						en: "Every piece is made by hand in our workshop, from shaping the clay to the final firing.",
					},
					heading: { ar: "دفعات صغيرة وفرن واحد", en: "Small batches, one kiln" },
					"visit-label": { ar: "احجز زيارة", en: "Book a visit" },
				},
				images: {
					"studio-photo": {
						alt: { ar: "طاولة عمل في مشغل خزف", en: "Workbench in a ceramics studio" },
						query: "sunlit ceramics studio workbench",
					},
				},
				index: 1,
				links: { "visit-link": { kind: "section" as const, section: example.section } },
				page: example.page,
				revision: example.revision,
				structure: {
					nodes: [
						{
							children: ["frame"],
							key: "surface",
							props: {
								padding: {
									base: {
										blockEnd: "16sp",
										blockStart: "16sp",
										inlineEnd: "6sp",
										inlineStart: "6sp",
									},
								},
							},
							type: "box" as const,
						},
						{
							children: ["photo", "story"],
							key: "frame",
							props: { align: "center" as const, columns: { base: 1, compact: 2 }, gap: "12sp" },
							type: "grid" as const,
						},
						{
							children: [],
							key: "photo",
							props: {
								alt: "studio-photo-alt",
								aspectRatio: { height: 5, width: 4 },
								asset: "studio-photo",
								fit: "cover" as const,
								radius: "theme" as const,
							},
							type: "media" as const,
						},
						{
							children: ["heading", "body", "visit"],
							key: "story",
							props: { align: "start" as const, direction: "column" as const, gap: "6sp" },
							type: "flex" as const,
						},
						{
							children: [],
							key: "heading",
							props: { appearance: "heading-lg" as const, content: "heading", element: "h2" as const },
							type: "text" as const,
						},
						{
							children: [],
							key: "body",
							props: {
								appearance: "body-lg" as const,
								content: "body",
								element: "p" as const,
								maxInlineSize: "36rem",
								tone: "muted" as const,
							},
							type: "text" as const,
						},
						{
							children: ["visit-label"],
							key: "visit",
							props: {
								fill: "action" as const,
								link: "visit-link",
								padding: {
									blockEnd: "3sp",
									blockStart: "3sp",
									inlineEnd: "6sp",
									inlineStart: "6sp",
								},
								radius: "theme" as const,
							},
							type: "action" as const,
						},
						{
							children: [],
							key: "visit-label",
							props: {
								appearance: "label-lg" as const,
								content: "visit-label",
								element: "span" as const,
							},
							type: "text" as const,
						},
					],
					root: "surface",
				},
			},
		},
	],
	inputSchema: composeWebsiteSectionExactInputSchema,
};

/* oxlint-disable-next-line anti-slop/no-unknown-parameters -- the tool schema validates the raw model arguments here */
export const diagnoseComposeToolInput = async (args: unknown) => {
	const validated = await composeWebsiteSectionToolContract.inputSchema.validate?.(args);

	return validated?.success ? diagnoseComposeDraft(validated.value) : [];
};
