import { z } from "zod";

import {
	anchorSchema,
	entityIdSchema,
	jsonObjectSchema,
	linkValueSchema,
	type JsonValue,
} from "../document/content-schema";
import {
	fillSchema,
	foregroundSchema,
	iconNameSchema,
	lengthSchema,
	nodeKeySchema,
	siteActionAppearanceFields,
	siteBoxAppearanceFields,
	siteFlexPropsFields,
	siteGridPropsFields,
	siteIconAppearanceFields,
	siteMediaAppearanceFields,
	siteNodeLayoutFields,
	siteTextAppearanceFields,
	siteTextNodeFields,
} from "../document/structure-schema";
import { sectionAuthoringResourceLimits, siteDocumentResourceLimits } from "../resource-limits";
import { compileBehaviorOutputs, compileBehaviorProgram } from "./compile-expression";
import {
	behaviorExpressionSourceSchema,
	behaviorKeySchema,
	behaviorScriptSourceSchema,
	behaviorSlotsSchema,
	decimalValueSchema,
	siteBehaviorOutputTypeSchema,
	siteBehaviorValueFormatSchema,
	type SiteBehaviorOutputType,
} from "./contracts";
import { createSiteScriptSession } from "./custom-script";
import { evaluateSiteBehavior, evaluateSiteBehaviorOutputs } from "./expression-runtime";
import { validateStructureLiveness } from "./liveness";
import { interactiveDescendantNodeTypes } from "./semantics";

export class BehaviorSectionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "BehaviorSectionError";
	}
}

export const describeBehaviorError = (cause: unknown) => {
	if (cause instanceof z.ZodError) {
		return z.prettifyError(cause);
	}

	return cause instanceof Error ? cause.message : "Invalid section specification";
};

export const sectionNodeKeySchema = z.compile(
	nodeKeySchema
		.describe("Stable node identity. Reuse inspected keys to keep a node's identity; a new key creates a new node.")
		.meta({ id: "SectionNodeKey" })
);

export const contentKeySchema = z.compile(
	nodeKeySchema
		.describe("Flat content key. Every referenced key must be defined in content.en and content.ar.")
		.meta({ id: "SectionContentKey" })
);

export const contentMapKeySchema = z.compile(nodeKeySchema.describe("Flat content key."));

export const sectionStructureNodeTypes = [
	"box",
	"flex",
	"grid",
	"text",
	"media",
	"icon",
	"action",
	"trigger",
	"field",
	"value",
	"carousel",
	"disclosure",
	"tabs",
	"item",
	"embed",
] as const;

export const sectionStructureNodeTypeSchema = z.compile(z.enum(sectionStructureNodeTypes));

const sectionInteractiveNodeTypes = new Set<SectionStructureNode["type"]>(interactiveDescendantNodeTypes);

const sectionCompositeNodeTypes = new Set<SectionStructureNode["type"]>(["carousel", "disclosure", "embed", "tabs"]);

const sectionNodeChildrenSchema = z.array(sectionNodeKeySchema).max(100).meta({ id: "SectionNodeChildren" });

const structureNodeFields = {
	children: sectionNodeChildrenSchema,
	key: sectionNodeKeySchema,
};

const sectionItemNodeSchema = z.strictObject({
	...structureNodeFields,
	children: structureNodeFields.children.length(2),
	props: z.strictObject({}),
	type: z.literal("item"),
});

const responsiveSectionValue = <Schema extends z.ZodType>(schema: Schema) =>
	z.union([
		schema,
		z.strictObject({
			base: schema,
			compact: schema.optional(),
			medium: schema.optional(),
			wide: schema.optional(),
		}),
	]);

const gridPlacementSchema = z
	.strictObject({ span: z.number().int().min(1).max(12), start: z.number().int().min(1).max(12) })
	.refine(({ span, start }) => start + span - 1 <= 12, "Grid placement must stay within twelve tracks");

const gridTrackCountSchema = responsiveSectionValue(z.number().int().min(1).max(12));

const sectionNodeLayoutFields = {
	...siteNodeLayoutFields,
	gridColumn: responsiveSectionValue(gridPlacementSchema).optional(),
	gridRow: responsiveSectionValue(gridPlacementSchema).optional(),
};

const sectionGridPropsFields = {
	...siteGridPropsFields,
	columns: gridTrackCountSchema,
	rows: gridTrackCountSchema.optional(),
};

const sectionMediaAppearanceFields = {
	...siteMediaAppearanceFields,
	focal: z.strictObject({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).optional(),
};

const sectionLayoutSchema = z.strictObject(sectionNodeLayoutFields);

const visibleWhenSchema = { visibleWhen: behaviorKeySchema.optional() };

const sectionRevealFields = {
	animation: z.enum(["rise", "zoom", "fade"]),
	delayMs: z.number().int().min(0).max(2000).optional(),
	durationMs: z.number().int().min(100).max(2000).optional(),
};

const sectionRevealSchema = z.strictObject(sectionRevealFields);

const sectionResponsiveLengthSchema = responsiveSectionValue(lengthSchema);

const sectionCollectionLabelFields = { label: contentKeySchema };

export const sectionCarouselFields = {
	arrows: z.boolean().optional(),
	autoplayMs: z.number().int().min(1000).max(60_000).optional(),
	controlsAlign: z.enum(["start", "center", "end"]).optional(),
	controlsPlacement: z.enum(["before", "after"]).optional(),
	dots: z.boolean().optional(),
	dotsLabel: contentKeySchema.optional(),
	gap: sectionResponsiveLengthSchema.optional(),
	loop: z.boolean().optional(),
	nextLabel: contentKeySchema.optional(),
	previousLabel: contentKeySchema.optional(),
	slideAlign: z.enum(["start", "center"]).optional(),
	slideBasis: sectionResponsiveLengthSchema,
};

export const sectionTabsFields = {
	autoplayMs: z.number().int().min(2000).max(30_000).optional(),
	crossfadeMs: z.number().int().min(100).max(1500).optional(),
	indicator: z.boolean().optional(),
	listGap: lengthSchema.optional(),
	listPlacement: z.enum(["before", "after"]).optional(),
	orientation: z.enum(["horizontal", "vertical"]).optional(),
	panels: z.enum(["swap", "crossfade"]).optional(),
	progress: z.boolean().optional(),
};

export const sectionDisclosureFields = {
	defaultOpen: z.enum(["none", "first"]).optional(),
	divider: z.union([z.boolean(), z.literal("between")]).optional(),
	multiple: z.boolean().optional(),
	openIndicator: z.enum(["none", "rotate-45", "rotate-180"]).optional(),
	panelPadding: sectionResponsiveLengthSchema.optional(),
	triggerPadding: sectionResponsiveLengthSchema.optional(),
};

export const sectionMapFields = {
	address: contentKeySchema,
	coordinates: z.strictObject({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
	mapType: z.enum(["roadmap", "satellite"]).optional(),
	provider: z.literal("google-map"),
	tint: z.boolean().optional(),
	zoom: z.number().int().min(1).max(21).optional(),
};

export const sectionContactFormLabelFields = {
	anotherLabel: contentKeySchema,
	emailLabel: contentKeySchema,
	error: contentKeySchema,
	messageLabel: contentKeySchema,
	nameLabel: contentKeySchema,
	pendingLabel: contentKeySchema,
	submitLabel: contentKeySchema,
	success: contentKeySchema,
};

export const sectionContactFormFields = {
	...sectionContactFormLabelFields,
	columns: z.union([z.literal(1), z.literal(2)]).optional(),
	phoneLabel: contentKeySchema.optional(),
	provider: z.literal("contact-form"),
	submitWidth: z.enum(["fit", "full"]).optional(),
};

const sectionEmbedAppearanceFields = {
	...siteBoxAppearanceFields,
	...visibleWhenSchema,
	...sectionCollectionLabelFields,
};

export const sectionStructureNodeSchema = z.compile(
	z
		.discriminatedUnion("type", [
			z.strictObject({
				...structureNodeFields,
				props: sectionLayoutSchema.extend({
					...siteBoxAppearanceFields,
					...visibleWhenSchema,
					decorative: z.boolean().optional(),
					reveal: sectionRevealSchema.optional(),
				}),
				type: z.literal("box"),
			}),
			z.strictObject({
				...structureNodeFields,
				props: sectionLayoutSchema.extend({
					...siteBoxAppearanceFields,
					...siteFlexPropsFields,
					...visibleWhenSchema,
				}),
				type: z.literal("flex"),
			}),
			z.strictObject({
				...structureNodeFields,
				props: sectionLayoutSchema.extend({
					...siteBoxAppearanceFields,
					...sectionGridPropsFields,
					...visibleWhenSchema,
				}),
				type: z.literal("grid"),
			}),
			z.strictObject({
				...structureNodeFields,
				props: sectionLayoutSchema.extend({
					...siteTextAppearanceFields,
					...visibleWhenSchema,
					...siteTextNodeFields,
					content: contentKeySchema,
				}),
				type: z.literal("text"),
			}),
			z.strictObject({
				...structureNodeFields,
				props: sectionLayoutSchema.extend({
					...sectionMediaAppearanceFields,
					...visibleWhenSchema,
					alt: contentKeySchema,
					asset: contentKeySchema,
				}),
				type: z.literal("media"),
			}),
			z.strictObject({
				...structureNodeFields,
				props: sectionLayoutSchema.extend({
					...siteIconAppearanceFields,
					...visibleWhenSchema,
					label: contentKeySchema.optional(),
				}),
				type: z.literal("icon"),
			}),
			z.strictObject({
				...structureNodeFields,
				children: structureNodeFields.children.min(1),
				props: sectionLayoutSchema.extend({
					...siteActionAppearanceFields,
					...visibleWhenSchema,
					link: contentKeySchema,
				}),
				type: z.literal("action"),
			}),
			z.strictObject({
				...structureNodeFields,
				children: structureNodeFields.children.min(1),
				props: sectionLayoutSchema.extend({
					...visibleWhenSchema,
					disabledWhen: behaviorKeySchema.optional(),
					event: behaviorKeySchema,
					label: contentKeySchema,
				}),
				type: z.literal("trigger"),
			}),
			z.strictObject({
				...structureNodeFields,
				props: sectionLayoutSchema.extend({
					...visibleWhenSchema,
					disabledWhen: behaviorKeySchema.optional(),
					emptyValue: decimalValueSchema.optional(),
					invalid: contentKeySchema.optional(),
					placeholder: contentKeySchema.optional(),
					slot: behaviorKeySchema,
				}),
				type: z.literal("field"),
			}),
			z.strictObject({
				...structureNodeFields,
				props: sectionLayoutSchema.extend({
					...visibleWhenSchema,
					emphasis: z.enum(["primary", "secondary"]).optional(),
					format: siteBehaviorValueFormatSchema,
					output: behaviorKeySchema,
					unavailable: contentKeySchema,
				}),
				type: z.literal("value"),
			}),
			z.strictObject({
				...structureNodeFields,
				props: sectionLayoutSchema.extend({
					...visibleWhenSchema,
					...sectionCollectionLabelFields,
					...sectionCarouselFields,
				}),
				type: z.literal("carousel"),
			}),
			z.strictObject({
				...structureNodeFields,
				props: sectionLayoutSchema.extend({ ...visibleWhenSchema, ...sectionDisclosureFields }),
				type: z.literal("disclosure"),
			}),
			z.strictObject({
				...structureNodeFields,
				props: sectionLayoutSchema.extend({
					...visibleWhenSchema,
					...sectionCollectionLabelFields,
					...sectionTabsFields,
				}),
				type: z.literal("tabs"),
			}),
			sectionItemNodeSchema,
			z.strictObject({
				...structureNodeFields,
				props: z.discriminatedUnion("provider", [
					sectionLayoutSchema.extend({ ...sectionEmbedAppearanceFields, ...sectionMapFields }),
					sectionLayoutSchema.extend({ ...sectionEmbedAppearanceFields, ...sectionContactFormFields }),
				]),
				type: z.literal("embed"),
			}),
		])
		.superRefine((node, context) => {
			if (
				(node.type === "text" || node.type === "media" || node.type === "icon" || node.type === "embed") &&
				node.children.length > 0
			) {
				context.addIssue({
					code: "custom",
					message: `${node.type} nodes require an empty children array`,
					path: ["children"],
				});
			}

			if (node.type === "carousel") {
				validateCarouselProps({ context, props: node.props });
			}

			if (node.type === "tabs" && node.props.progress && node.props.autoplayMs === undefined) {
				context.addIssue({
					code: "custom",
					message: "tabs progress requires autoplayMs",
					path: ["props", "progress"],
				});
			}
		})
		.meta({ id: "SectionStructureNode" })
);

export type SectionStructureNode = z.infer<typeof sectionStructureNodeSchema>;

const validateCarouselProps = ({
	context,
	props,
}: {
	context: IssueContext;
	props: { arrows?: boolean; dots?: boolean; dotsLabel?: string; nextLabel?: string; previousLabel?: string };
}) => {
	const requirements: Array<[boolean, Array<[string, string | undefined]>]> = [
		[
			props.arrows === true,
			[
				["previousLabel", props.previousLabel],
				["nextLabel", props.nextLabel],
			],
		],
		[props.dots === true, [["dotsLabel", props.dotsLabel]]],
	];

	requirements.forEach(([enabled, labels]) =>
		labels.forEach(([name, value]) => {
			if (enabled !== (value !== undefined)) {
				context.addIssue({
					code: "custom",
					message: enabled
						? `carousel ${name} content key is required when its controls are enabled`
						: `carousel ${name} is only valid when its controls are enabled`,
					path: ["props", name],
				});
			}
		})
	);
};

export const sectionContentReferenceProps = {
	action: { link: "link" },
	box: {},
	carousel: { dotsLabel: "text", label: "text", nextLabel: "text", previousLabel: "text" },
	disclosure: {},
	embed: {
		address: "text",
		anotherLabel: "text",
		emailLabel: "text",
		error: "text",
		label: "text",
		messageLabel: "text",
		nameLabel: "text",
		pendingLabel: "text",
		phoneLabel: "text",
		submitLabel: "text",
		success: "text",
	},
	field: { invalid: "text", placeholder: "text" },
	flex: {},
	grid: {},
	icon: { label: "text" },
	item: {},
	media: { alt: "text", asset: "asset" },
	tabs: { label: "text" },
	text: { content: "text" },
	trigger: { label: "text" },
	value: { unavailable: "text" },
} as const satisfies Record<SectionStructureNode["type"], Partial<Record<string, "asset" | "link" | "text">>>;

const providerJsonValueSchema = z.json().meta({ id: "SectionNodePropValue" });

const propNameEnum = (names: Array<string>) => {
	const [first, ...rest] = names;

	if (!first) {
		throw new Error("Provider props require at least one field");
	}

	return z.enum([first, ...rest]);
};

const sharedPropNames = ({ fields, id }: { fields: Record<string, z.ZodType>; id: string }) => {
	const names = Object.keys(fields);

	return { names: new Set(names), schema: propNameEnum(names).meta({ id }) };
};

const layoutPropNames = sharedPropNames({
	fields: { ...sectionNodeLayoutFields, ...visibleWhenSchema },
	id: "SectionLayoutPropName",
});

const boxPropNames = sharedPropNames({ fields: siteBoxAppearanceFields, id: "SectionBoxPropName" });

const textPropNames = sharedPropNames({ fields: siteTextAppearanceFields, id: "SectionTextPropName" });

const providerPropsSchema = (fields: Record<string, z.ZodType>, ...shared: Array<typeof layoutPropNames>) => {
	const groups = [layoutPropNames, ...shared];
	const own = Object.keys(fields).filter((name) => !groups.some((group) => group.names.has(name)));

	return z.partialRecord(
		z
			.union([...groups.map((group) => group.schema), ...(own.length > 0 ? [propNameEnum(own)] : [])])
			.meta({ type: "string" }),
		providerJsonValueSchema
	);
};

export const sectionStructureNodeProviderSchema = z
	.discriminatedUnion("type", [
		z.strictObject({
			...structureNodeFields,
			props: providerPropsSchema(
				{
					...sectionNodeLayoutFields,
					...siteBoxAppearanceFields,
					...visibleWhenSchema,
					decorative: z.boolean(),
					reveal: sectionRevealSchema,
				},
				boxPropNames
			).describe("Box layout and appearance props. Never a JSON string."),
			type: z.literal("box"),
		}),
		z.strictObject({
			...structureNodeFields,
			props: providerPropsSchema(
				{
					...sectionNodeLayoutFields,
					...siteBoxAppearanceFields,
					...siteFlexPropsFields,
					...visibleWhenSchema,
				},
				boxPropNames
			).describe("Flex layout and appearance props. direction is required; columns is invalid."),
			type: z.literal("flex"),
		}),
		z.strictObject({
			...structureNodeFields,
			props: providerPropsSchema(
				{
					...sectionNodeLayoutFields,
					...siteBoxAppearanceFields,
					...sectionGridPropsFields,
					...visibleWhenSchema,
				},
				boxPropNames
			).describe(
				"Grid layout and appearance props. columns is required and is an integer from 1 to 12 or Responsive<integer>; direction is invalid."
			),
			type: z.literal("grid"),
		}),
		z.strictObject({
			...structureNodeFields,
			props: providerPropsSchema(
				{
					...sectionNodeLayoutFields,
					...siteTextAppearanceFields,
					...visibleWhenSchema,
					content: contentKeySchema,
					element: z.enum(["p", "span", "h1", "h2", "h3", "h4"]),
					scrollReveal: z.boolean(),
				},
				textPropNames
			).describe("Text layout and typography props. content is required; children must be empty."),
			type: z.literal("text"),
		}),
		z.strictObject({
			...structureNodeFields,
			props: providerPropsSchema(
				{
					...sectionNodeLayoutFields,
					...sectionMediaAppearanceFields,
					...visibleWhenSchema,
					alt: contentKeySchema,
					asset: contentKeySchema,
				},
				boxPropNames
			).describe(
				"Media: asset/alt required; children []. Supports bounded focal/overlay/fit/scale/opacity/clip props. No URLs or CSS backgrounds."
			),
			type: z.literal("media"),
		}),
		z.strictObject({
			...structureNodeFields,
			props: providerPropsSchema({
				...sectionNodeLayoutFields,
				...siteIconAppearanceFields,
				...visibleWhenSchema,
				label: contentKeySchema.optional(),
			}).describe("Built-in icon. name is required; label is optional and omitted icons are decorative."),
			type: z.literal("icon"),
		}),
		z.strictObject({
			...structureNodeFields,
			children: structureNodeFields.children.min(1),
			props: providerPropsSchema(
				{
					...sectionNodeLayoutFields,
					...siteActionAppearanceFields,
					...visibleWhenSchema,
					link: contentKeySchema,
				},
				boxPropNames,
				textPropNames
			).describe(
				"Typed navigation action. link is a key from the sibling links map; include an unconditional text, labeled icon, or media descendant."
			),
			type: z.literal("action"),
		}),
		z.strictObject({
			...structureNodeFields,
			children: structureNodeFields.children.min(1),
			props: providerPropsSchema({
				...sectionNodeLayoutFields,
				...visibleWhenSchema,
				disabledWhen: behaviorKeySchema.optional(),
				event: behaviorKeySchema,
				label: contentKeySchema,
			}).describe("Script event trigger. event and accessible label are required; include at least one child."),
			type: z.literal("trigger"),
		}),
		z.strictObject({
			...structureNodeFields,
			props: providerPropsSchema({
				...sectionNodeLayoutFields,
				...visibleWhenSchema,
				disabledWhen: behaviorKeySchema.optional(),
				emptyValue: decimalValueSchema,
				invalid: contentKeySchema,
				placeholder: contentKeySchema,
				slot: behaviorKeySchema,
			}).describe(
				"Decimal input binding props. slot is required; emptyValue, invalid, and placeholder are optional."
			),
			type: z.literal("field"),
		}),
		z.strictObject({
			...structureNodeFields,
			props: providerPropsSchema({
				...sectionNodeLayoutFields,
				...visibleWhenSchema,
				emphasis: z.enum(["primary", "secondary"]).optional(),
				format: siteBehaviorValueFormatSchema,
				output: behaviorKeySchema,
				unavailable: contentKeySchema,
			}).describe("Computed output binding props. format, output, and unavailable are required."),
			type: z.literal("value"),
		}),
		z.strictObject({
			...structureNodeFields,
			props: providerPropsSchema({
				...sectionNodeLayoutFields,
				...visibleWhenSchema,
				...sectionCollectionLabelFields,
				...sectionCarouselFields,
			}).describe("Carousel; children are slides. label and slideBasis required."),
			type: z.literal("carousel"),
		}),
		z.strictObject({
			...structureNodeFields,
			props: providerPropsSchema({
				...sectionNodeLayoutFields,
				...visibleWhenSchema,
				...sectionDisclosureFields,
			}).describe("Accordion; children are items."),
			type: z.literal("disclosure"),
		}),
		z.strictObject({
			...structureNodeFields,
			props: providerPropsSchema({
				...sectionNodeLayoutFields,
				...visibleWhenSchema,
				...sectionCollectionLabelFields,
				...sectionTabsFields,
			}).describe("Tabs; children are items. label required."),
			type: z.literal("tabs"),
		}),
		sectionItemNodeSchema.describe("Item: children are [trigger, panel]."),
		z.strictObject({
			...structureNodeFields,
			props: providerPropsSchema(
				{
					...sectionNodeLayoutFields,
					...sectionEmbedAppearanceFields,
					...sectionMapFields,
					...sectionContactFormFields,
				},
				boxPropNames
			).describe("Embed, children []. provider and label required."),
			type: z.literal("embed"),
		}),
	])
	.superRefine((node, context) => {
		const parsed = sectionStructureNodeSchema.safeParse(node);

		if (parsed.success) {
			return;
		}

		parsed.error.issues.forEach((issue) => {
			context.addIssue({ code: "custom", message: issue.message, path: issue.path });
		});
	});

const listOptions = (options: ReadonlyArray<string>) => options.join("/");

const numberRange = (schema: z.ZodOptional<z.ZodNumber>) => `${schema.unwrap().minValue}-${schema.unwrap().maxValue}`;

export const sectionAuthoringReference = `## Current v1 primitive reference

Compose a freeform flat graph; these are primitives, not section blueprints.

- Every node: { key, type, props, children }. props and every item in nodes/children are JSON values, never JSON-encoded strings. children lists child node keys as strings, never nested node objects. Only text uses content.
- structure.root names a box node: the full-width section surface. Put flex and grid arrangement inside it, never as the root. Every node must be reachable from root exactly once.
- The root box or its direct content-frame child sets nonzero padding on all four logical edges; copy the adjacent inspected sections' outer-frame spacing.
- Node and content keys match lowercase kebab-case [a-z][a-z0-9-]{0,63}. Field slots, logic outputs, and trigger event keys match [a-z][a-z0-9_]{0,31}; events use underscores, never hyphens.
- Length: a number (pixels), ${listOptions(lengthSchema.options[1].options)}, or a numeric string ending in sp/px/em/rem/%/cqi/cqw/svh/vh ("0" is zero). sp is the fluid spacing unit, 4px in a 360px container growing to 6px at wide widths: use it for all padding, margin, gap, inset, sizes, and fontSize, such as "6sp"; use rem or px only for fixed max widths like maxInlineSize "36rem".
- Responsive<T>: T or { base: T, compact?: T, medium?: T, wide?: T }. Every responsive object requires base; { medium: T } alone is invalid. Container widths: base is below 40rem, compact starts at 40rem, wide starts above 80rem; medium (42rem) is nearly the same as compact, so use base/compact/wide and avoid medium.
- padding/margin/inset use Responsive<Edges<Length>>, where Edges is { blockStart?, inlineEnd?, blockEnd?, inlineStart? }. Put breakpoints around the complete edges object: { base: { blockStart: "12sp", ... }, wide: { blockStart: "20sp", ... } }. Never put { base, wide } inside an individual edge and never use scalar shorthand: padding: "8sp" is invalid; use { blockStart: "8sp", inlineEnd: "8sp", blockEnd: "8sp", inlineStart: "8sp" }.
- Shared optional props: ${Object.keys(sectionNodeLayoutFields).join(", ")}. gridColumn/gridRow use { start, span }, each from 1 to 12, and must remain within twelve tracks; they may also use Responsive<{ start, span }>.
- Every node may set props.visibleWhen to one named boolean CEL output. field and trigger may also set props.disabledWhen to a different named boolean CEL output. Boolean outputs bind exactly once to visibility or disabled state; decimal outputs bind exactly once to value nodes.
- aspectRatio is "auto" or { width: positive number, height: positive number }, including inside Responsive<T>; never use a number or numeric string.
- box, flex, and grid share appearance: ${Object.keys(siteBoxAppearanceFields).join(", ")}. box also supports decorative and reveal. fill is ${listOptions(fillSchema.options)}; foreground is ${listOptions(foregroundSchema.options)} (accent-text is readable accent-colored text; accent is for fills and borders); radius is none/theme/full or Length, or a per-corner object { startStart?, startEnd?, endStart?, endEnd? } of those values; pattern is ${listOptions(siteBoxAppearanceFields.pattern.unwrap().options)}, a decorative hatch over the fill; border is { width: Length, color: border/accent/action/current, sides? } with no opacity property, where sides lists kebab-case block-start/inline-end/block-end/inline-start (never blockStart). background is only a decorative gradient { kind: "linear-gradient", angle, stops: [{ color: transparent/black/featured, opacity, position }] }; set solid surfaces with fill and never write background: "tint" or any string.
- flex requires direction (${listOptions(siteFlexPropsFields.direction.options[0].options)}) and adds: ${Object.keys(siteFlexPropsFields).join(", ")}. align is ${listOptions(siteFlexPropsFields.align.unwrap().options[0].options)}; justify is ${listOptions(siteFlexPropsFields.justify.unwrap().options[0].options)}; wrap is ${listOptions(siteFlexPropsFields.wrap.unwrap().options[0].options)}, never a boolean.
- grid requires columns and adds: ${Object.keys(siteGridPropsFields).join(", ")}. columns is an integer from 1 to 12 or Responsive<integer>, such as { base: 1, compact: 3 }; never use a string or array.
- Never guess a prop or copy one between node types. Omit optional props when uncertain.
- In node props, null unsets an optional prop before exact validation. A required prop cannot be unset.
- text requires content and adds: ${[...Object.keys(siteTextAppearanceFields), "element", "scrollReveal"].join(", ")}. Set type with appearance, one of ${listOptions(siteTextAppearanceFields.appearance.unwrap().options)}: display-* for a hero or primary headline, heading-* for section headings, title-* for card and item titles, body-* for paragraphs (-em emphasized), label-* for buttons, eyebrows and captions, watermark for oversized decorative text. When appearance is set, fontSize, lineHeight, and weight are ignored; choose a different appearance instead of overriding them, and use fontSize (Responsive<Length>), lineHeight (positive number), and weight only without appearance. element is p/span/h1/h2/h3/h4 (never label), align is Responsive<${listOptions(siteTextAppearanceFields.align.unwrap().options[0].options)}>, font is ${listOptions(siteTextAppearanceFields.font.unwrap().options)}, weight is ${listOptions(siteTextAppearanceFields.weight.unwrap().options)}, tone is ${listOptions(foregroundSchema.options)}, decoration is ${listOptions(siteTextAppearanceFields.decoration.unwrap().options)}, wrap is ${listOptions(siteTextAppearanceFields.wrap.unwrap().options)}, and children must be [].
- media requires asset and alt content keys and children must be []. It supports the box appearance props plus clip, contentScale, fit, focal, hoverOpacity, imageOpacity, intrinsicInlineSize, objectAlign, overlay, filter, and playback. focal is { x, y } with each percentage from 0 to 100. overlay is { kind: "scrim", strength: subtle/medium/strong } or { kind: "linear-gradient", angle, stops: [{ opacity: 0-1, position: 0-100 }] } with at least two stops. filter is ${listOptions(siteMediaAppearanceFields.filter.unwrap().options)}. Size and position it with shared layout props; for a square use aspectRatio: { width: 1, height: 1 }. Add a matching media intent with the same asset key and a concise stock-image query. Never emit image URLs or put an image in box.background.
- icon requires a built-in name (${listOptions(iconNameSchema.options)}), supports optional size/tone and an optional bilingual label content key, and children must be []. Omit label for a decorative icon.
- action requires a link key from the sibling links map plus an unconditional text, labeled icon, or media descendant for its accessible name. It supports box and text appearance props. Supply a typed link intent; never put a URL or handle directly in props.link. Local section/anchor intents must target content rendered with the source; use a page intent with a section handle for cross-page navigation.
- trigger requires event and label content keys plus at least one child. It runs either a matching custom-script event or a named CEL declarative event on click or keyboard activation. Use it around media or other content that initiates a host-mediated interaction.
- field requires slot. Set emptyValue to a decimal such as "0" when clearing the input should compute from that value. invalid and placeholder are optional content keys, never booleans or literal copy. Use invalid: null in a modification to remove the validation message. Include a direct text child as its label.
- value requires output, unavailable, and format. unavailable is a content key, never literal copy. Include a direct text child as its label. Optional emphasis is primary or secondary; when a section has multiple values, use exactly one primary and mark every other value secondary. format is { style: "decimal", maximumFractionDigits? }, { style: "currency", currency: "USD", maximumFractionDigits? }, or { style: "percent", valueScale: "ratio" | "percentage-points", maximumFractionDigits? }.
- Every text content, media alt, icon label, field invalid/placeholder, trigger label, and value unavailable key must exist exactly once in both content.en and content.ar. Media asset keys live in content.assets and are supplied by the server from media intents. Every action link key must exist exactly once in content.links and come from the sibling typed links map. Text, asset, and link keys are globally disjoint, so name them by role: an action's link key book-link with label text book-label, a media asset key studio-photo with alt studio-photo-alt. Do not add unreferenced keys.
- action, field, and trigger are interactive nodes and cannot contain another interactive node, or a carousel, tabs, disclosure, or embed, anywhere beneath them.
- Scroll entrance: box reveal is { animation: ${listOptions(sectionRevealFields.animation.options)}, delayMs?: ${numberRange(sectionRevealFields.delayMs)}, durationMs?: ${numberRange(sectionRevealFields.durationMs)} } and text scrollReveal is true; both play once when scrolled into view. Use them sparingly on a few content groups, never on the root or every node. Hover reveals are unavailable.
- carousel is a swipeable slide track. Its children are the slide nodes, each any node (usually a box or flex card) with nonblank text or media. Requires label (accessible name content key) and slideBasis (Responsive<Length>, the slide width such as { base: "85%", compact: "30%" }); optional gap (Responsive<Length>), loop, slideAlign (${listOptions(sectionCarouselFields.slideAlign.unwrap().options)}), autoplayMs (${numberRange(sectionCarouselFields.autoplayMs)}, pauses on hover and focus). arrows: true adds previous/next buttons and requires previousLabel and nextLabel content keys; dots: true adds position indicators and requires dotsLabel; set those labels only with their control. controlsPlacement is ${listOptions(sectionCarouselFields.controlsPlacement.unwrap().options)} the slides (default after) and controlsAlign is ${listOptions(sectionCarouselFields.controlsAlign.unwrap().options)}. It supports shared layout props; give it inlineSize "full".
- tabs and disclosure (accordion) children are item nodes only. An item has props {} and exactly two children: [trigger node, panel node]; wrap several elements in one flex. The trigger renders inside a button, so it needs a nonblank text descendant for its name and no interactive or composite descendant; the panel needs nonblank text or media. Item keys are stable for tabs; a disclosure's items are re-inspected as <disclosure-key>-item-N.
- tabs requires label and adds: ${Object.keys(sectionTabsFields).join(", ")}. orientation is ${listOptions(sectionTabsFields.orientation.unwrap().options)}, panels is ${listOptions(sectionTabsFields.panels.unwrap().options)}, crossfadeMs is ${numberRange(sectionTabsFields.crossfadeMs)}, autoplayMs is ${numberRange(sectionTabsFields.autoplayMs)} and cycles the active tab, progress: true draws a progress bar under each tab and requires autoplayMs, indicator toggles the sliding active-tab underline (default true), listPlacement is ${listOptions(sectionTabsFields.listPlacement.unwrap().options)} the panels, and listGap is a Length between tab triggers.
- disclosure adds: ${Object.keys(sectionDisclosureFields).join(", ")}. multiple allows several open items, defaultOpen is ${listOptions(sectionDisclosureFields.defaultOpen.unwrap().options)}, divider is true/false/"between", openIndicator is ${listOptions(sectionDisclosureFields.openIndicator.unwrap().options)} and animates an icon node inside the trigger (include a chevron-down or plus icon), and panelPadding/triggerPadding are Responsive<Length>.
- embed requires provider and label (an accessible-name content key), children must be [], and it supports the shared layout props plus box appearance props (give a map a blockSize or aspectRatio). provider "google-map" requires address (a content key) and adds zoom (integer ${numberRange(sectionMapFields.zoom)}), mapType (${listOptions(sectionMapFields.mapType.unwrap().options)}), tint, and coordinates { lat, lng }; address must be nonblank in en and ar unless coordinates is set. provider "contact-form" requires content keys for ${Object.keys(sectionContactFormLabelFields).join(", ")} (each nonblank in en and ar) and adds optional phoneLabel, columns (1 or 2), and submitWidth (${listOptions(sectionContactFormFields.submitWidth.unwrap().options)}).
- Named expression logic: { kind: "expression", fields: [{ key, initial }], outputs: { output_key: { expression, type: "decimal" | "boolean" } }, events? }. Each bounded CEL expression is independently typed. events optionally maps event keys to exact inspected section anchors for host-mediated scrolling.
- Legacy expression logic: { kind: "expression", fields: [{ key, initial }], expression }; it remains supported and produces the single decimal output result.
- Script logic: { kind: "script", fields: [{ key, initial }], outputs, script, events? }. calculate(inputs) returns every declared decimal output. Script outputs cannot bind visibleWhen or disabledWhen. For interactions, events declares event keys and interact(event) returns { type: "scroll-to", anchor: "exact-inspected-section-anchor" }.
- Interactive script exact shape: { kind: "script", fields: [{ key: "quantity", initial: "1" }], outputs: ["result"], events: ["image_click"], script: "function calculate(inputs) { return inputs.quantity; }\\nfunction interact(event) { return event === 'image_click' ? { type: 'scroll-to', anchor: 'exact-inspected-anchor' } : null; }" }. calculate and interact are function declarations inside the one script string; interact is never a sibling logic field. The trigger props.event must equal the declared event exactly.
- Box, flex, and grid own visual surfaces; media owns images; icon owns built-in glyphs; action owns typed navigation; flex/grid also own arrangement; text owns typography; field/value own behavior bindings; carousel, tabs, and disclosure own repeated or switchable content; embed owns the map and contact form.`;

type IssueContext = { addIssue: (issue: { code: "custom"; message: string; path: Array<number | string> }) => void };

const visibilityCanRemoveAccessibleContent = (visibility: JsonValue | undefined) => {
	if (visibility === "hidden" || visibility === "removed") {
		return true;
	}

	const responsive = jsonObjectSchema.safeParse(visibility);

	return (
		responsive.success && Object.values(responsive.data).some((value) => value === "hidden" || value === "removed")
	);
};

const nodeCanHideAccessibleContent = (node: SectionStructureNode) =>
	Boolean(node.props.visibleWhen) || visibilityCanRemoveAccessibleContent(node.props.visibility);

const actionAccessibleNameKeys = ({
	action,
	nodeByKey,
}: {
	action: Extract<SectionStructureNode, { type: "action" }>;
	nodeByKey: Map<string, SectionStructureNode>;
}) => {
	const pending = action.children.map((key) => ({ conditionallyHidden: false, key }));
	const visited = new Set<string>();
	const keys: Array<string> = [];

	while (pending.length > 0) {
		const current = pending.pop();
		const key = current?.key;

		if (!key || visited.has(key)) {
			continue;
		}

		visited.add(key);
		const node = nodeByKey.get(key);

		if (!node) {
			continue;
		}

		const conditionallyHidden = Boolean(current?.conditionallyHidden || nodeCanHideAccessibleContent(node));

		if (!conditionallyHidden) {
			if (node.type === "text") {
				keys.push(node.props.content);
			} else if (node.type === "media") {
				keys.push(node.props.alt);
			} else if (node.type === "icon" && node.props.label) {
				keys.push(node.props.label);
			}
		}

		pending.push(...node.children.map((child) => ({ conditionallyHidden, key: child })));
	}

	return keys;
};

const validateStructureGraph = (
	{ nodes, root }: { nodes: Array<SectionStructureNode>; root: string },
	context: IssueContext
) => {
	const nodeByKey = new Map<string, SectionStructureNode>();
	const incomingEdges = new Map<string, number>();

	nodes.forEach((node, index) => {
		if (nodeByKey.has(node.key)) {
			context.addIssue({
				code: "custom",
				message: `Duplicate node key "${node.key}"`,
				path: ["nodes", index, "key"],
			});
		}

		nodeByKey.set(node.key, node);
		incomingEdges.set(node.key, 0);
	});

	if (!nodeByKey.has(root)) {
		context.addIssue({ code: "custom", message: `Root node "${root}" is missing`, path: ["root"] });

		return;
	}

	const depthStack = [{ depth: 1, key: root }];
	const depthVisited = new Set<string>();

	while (depthStack.length > 0) {
		const current = depthStack.pop();
		const node = current ? nodeByKey.get(current.key) : undefined;

		if (!current || !node || depthVisited.has(current.key)) {
			continue;
		}

		depthVisited.add(current.key);

		if (current.depth > siteDocumentResourceLimits.nodeDepth) {
			context.addIssue({
				code: "custom",
				message: `Section node depth exceeds the limit of ${siteDocumentResourceLimits.nodeDepth}`,
				path: ["nodes"],
			});
			break;
		}

		node.children.forEach((key) => depthStack.push({ depth: current.depth + 1, key }));
	}

	nodes.forEach((node, index) => {
		node.children.forEach((child) => {
			if (incomingEdges.has(child)) {
				incomingEdges.set(child, (incomingEdges.get(child) ?? 0) + 1);
			}
		});

		if (
			(node.type === "field" || node.type === "value") &&
			(node.children.length !== 1 ||
				nodeByKey.get(node.children[0] ?? "")?.type !== "text" ||
				nodeCanHideAccessibleContent(nodeByKey.get(node.children[0] ?? "")!))
		) {
			context.addIssue({
				code: "custom",
				message: `${node.type} node "${node.key}" requires exactly one direct text-label child`,
				path: ["nodes", index, "children"],
			});
		}

		if (node.type === "action" && actionAccessibleNameKeys({ action: node, nodeByKey }).length === 0) {
			context.addIssue({
				code: "custom",
				message: `Action node "${node.key}" requires a text, labeled icon, or media descendant`,
				path: ["nodes", index, "children"],
			});
		}

		node.children.forEach((childKey) => {
			const childType = nodeByKey.get(childKey)?.type;
			const collection = node.type === "tabs" || node.type === "disclosure";

			if (collection !== (childType === "item") && childType !== undefined) {
				context.addIssue({
					code: "custom",
					message: collection
						? `${node.type} node "${node.key}" children must all be item nodes`
						: `item node "${childKey}" must be a direct child of a tabs or disclosure node`,
					path: ["nodes", index, "children"],
				});
			}
		});

		const nestedHosts: Array<{ label: string; roots: Array<string> }> = [];
		const itemTrigger = node.type === "item" ? node.children[0] : undefined;

		if (sectionInteractiveNodeTypes.has(node.type)) {
			nestedHosts.push({ label: `${node.type} node`, roots: node.children });
		}

		if (itemTrigger) {
			nestedHosts.push({ label: "item node trigger", roots: [itemTrigger] });
		}

		nestedHosts.forEach(({ label, roots }) => {
			const descendants = [...roots];
			const visitedDescendants = new Set<string>();

			while (descendants.length > 0) {
				const descendantKey = descendants.pop();

				if (!descendantKey || visitedDescendants.has(descendantKey)) {
					continue;
				}

				visitedDescendants.add(descendantKey);
				const descendant = nodeByKey.get(descendantKey);

				if (!descendant) {
					continue;
				}

				if (
					sectionInteractiveNodeTypes.has(descendant.type) ||
					sectionCompositeNodeTypes.has(descendant.type)
				) {
					context.addIssue({
						code: "custom",
						message: `${label} "${node.key}" cannot contain interactive or composite ${descendant.type} node "${descendant.key}"`,
						path: ["nodes", index, "children"],
					});
					break;
				}

				descendants.push(...descendant.children);
			}
		});
	});

	if (incomingEdges.get(root) !== 0) {
		context.addIssue({ code: "custom", message: `Root node "${root}" cannot be a child`, path: ["root"] });
	}

	nodes.forEach((node, index) => {
		if (node.key !== root && incomingEdges.get(node.key) !== 1) {
			context.addIssue({
				code: "custom",
				message: `Node "${node.key}" must have exactly one parent`,
				path: ["nodes", index, "key"],
			});
		}
	});

	const visited = new Set<string>();
	const visiting = new Set<string>();

	const visit = (key: string) => {
		if (visiting.has(key)) {
			context.addIssue({ code: "custom", message: `Node graph contains a cycle at "${key}"`, path: ["nodes"] });

			return;
		}

		if (visited.has(key)) {
			return;
		}

		const node = nodeByKey.get(key);

		if (!node) {
			context.addIssue({ code: "custom", message: `Child node "${key}" is missing`, path: ["nodes"] });

			return;
		}

		visiting.add(key);
		node.children.forEach(visit);
		visiting.delete(key);
		visited.add(key);
	};

	visit(root);

	if (visited.size !== nodeByKey.size) {
		context.addIssue({ code: "custom", message: "Node graph contains unreachable nodes", path: ["nodes"] });
	}
};

export const sectionStructureSchema = z.compile(
	z
		.strictObject({
			nodes: z.array(sectionStructureNodeSchema).min(1).max(sectionAuthoringResourceLimits.nodes),
			root: sectionNodeKeySchema,
		})
		.superRefine(validateStructureGraph)
		.describe(
			"Flat node graph: list every node once and connect it with child node keys — never nest nodes inside props."
		)
		.meta({ id: "SectionStructure" })
);

export type SectionStructure = z.infer<typeof sectionStructureSchema>;

export const sectionStructureNodePatchSchema = z
	.strictObject({
		children: z.array(sectionNodeKeySchema).max(100).optional().describe("Changed top-level child node keys."),
		key: sectionNodeKeySchema,
		props: z
			.record(z.string(), z.json())
			.optional()
			.describe("Only changed props. children is a top-level field, never a prop."),
		type: sectionStructureNodeTypeSchema.optional(),
	})
	.refine((node) => node.type || node.props || node.children, "Provide at least one node change")
	.refine((node) => !Object.hasOwn(node.props ?? {}, "children"), "children must be a top-level node field");

export type SectionStructureNodePatch = z.infer<typeof sectionStructureNodePatchSchema>;

export const patchSectionStructure = ({
	patches,
	remove,
	structure,
}: {
	patches?: Array<SectionStructureNodePatch>;
	remove?: Array<string>;
	structure: SectionStructure;
}) => {
	const current = sectionStructureSchema.parse(structure);
	const nodes = structuredClone(current.nodes);

	remove?.forEach((key) => {
		const index = nodes.findIndex((node) => node.key === key);

		if (index < 0) {
			throw new BehaviorSectionError(`Structure node "${key}" not found`);
		}

		nodes.splice(index, 1);
	});

	patches?.forEach((patch) => {
		const index = nodes.findIndex((node) => node.key === patch.key);
		const existing = nodes[index];

		const props: Record<string, JsonValue> =
			existing && (!patch.type || patch.type === existing.type) ? { ...existing.props } : {};

		Object.entries(patch.props ?? {}).forEach(([key, value]) => {
			if (value === null) {
				delete props[key];
			} else {
				props[key] = value;
			}
		});

		const node = sectionStructureNodeSchema.parse({ ...existing, ...patch, props });

		if (index < 0) {
			nodes.push(node);
		} else {
			nodes[index] = node;
		}
	});

	return sectionStructureSchema.parse({ nodes, root: current.root });
};

export type SectionStructureContract = {
	assetKeys: Set<string>;
	booleanOutputs: Array<string>;
	contentKeys: Set<string>;
	events: Array<string>;
	linkKeys: Set<string>;
	outputs: Array<string>;
	slots: Array<string>;
};

export const deriveStructureContract = (structure: SectionStructure): SectionStructureContract => {
	const assetKeys = new Set<string>();
	const booleanOutputs: Array<string> = [];
	const contentKeys = new Set<string>();
	const events: Array<string> = [];
	const linkKeys = new Set<string>();
	const slots: Array<string> = [];
	const outputs: Array<string> = [];

	structure.nodes.forEach((node) => {
		const props = jsonObjectSchema.parse(node.props);
		Object.entries(sectionContentReferenceProps[node.type]).forEach(([property, kind]) => {
			const key = contentKeySchema.safeParse(props[property]);

			if (!key.success) {
				return;
			}

			if (kind === "asset") {
				assetKeys.add(key.data);
			} else if (kind === "link") {
				linkKeys.add(key.data);
			} else {
				contentKeys.add(key.data);
			}
		});

		if (node.props.visibleWhen) {
			booleanOutputs.push(node.props.visibleWhen);
		}

		if (node.type === "trigger") {
			events.push(node.props.event);

			if (node.props.disabledWhen) {
				booleanOutputs.push(node.props.disabledWhen);
			}
		}

		if (node.type === "field") {
			slots.push(node.props.slot);

			if (node.props.disabledWhen) {
				booleanOutputs.push(node.props.disabledWhen);
			}
		}

		if (node.type === "value") {
			outputs.push(node.props.output);
		}
	});

	return { assetKeys, booleanOutputs, contentKeys, events, linkKeys, outputs, slots };
};

export const mergeSectionContentPatch = ({
	content,
	patch,
	structure,
}: {
	content: SectionContent;
	patch?: SectionContent;
	structure: SectionStructure;
}) => {
	const contract = deriveStructureContract(structure);

	const assets = Object.fromEntries(
		[...contract.assetKeys].map((key) => [key, patch?.assets?.[key] ?? content.assets?.[key]])
	);

	const links = Object.fromEntries(
		[...contract.linkKeys].map((key) => [key, patch?.links?.[key] ?? content.links?.[key]])
	);

	const merged = {
		ar: Object.fromEntries([...contract.contentKeys].map((key) => [key, patch?.ar[key] ?? content.ar[key]])),
		en: Object.fromEntries([...contract.contentKeys].map((key) => [key, patch?.en[key] ?? content.en[key]])),
	};

	if (Object.keys(assets).length > 0 || Object.keys(links).length > 0) {
		return sectionContentSchema.parse({
			...merged,
			assets: Object.keys(assets).length > 0 ? assets : undefined,
			links: Object.keys(links).length > 0 ? links : undefined,
		});
	}

	return sectionContentSchema.parse(merged);
};

const paddingEdgesSchema = z.object({
	blockEnd: z.json().optional(),
	blockStart: z.json().optional(),
	inlineEnd: z.json().optional(),
	inlineStart: z.json().optional(),
});

const zeroLengthSchema = z.union([z.literal(0), z.string().regex(/^-?0*\.?0+(?:px|em|rem|%|cqi|cqw|svh|vh|sp)?$/u)]);

const isZeroLength = (value: JsonValue) => zeroLengthSchema.safeParse(value).success;

const hasCompleteFramePadding = (node: SectionStructureNode | undefined) => {
	const padding = jsonObjectSchema.safeParse(node?.props.padding);

	if (!padding.success) {
		return false;
	}

	const base = padding.data.base === undefined ? padding.data : jsonObjectSchema.safeParse(padding.data.base).data;
	const edges = paddingEdgesSchema.safeParse(base);

	if (!edges.success) {
		return false;
	}

	return [edges.data.blockStart, edges.data.inlineEnd, edges.data.blockEnd, edges.data.inlineStart].every(
		(value) => value !== undefined && !isZeroLength(value)
	);
};

export const validateStructureFramePadding = (structure: SectionStructure, context: IssueContext) => {
	const nodeByKey = new Map(structure.nodes.map((node) => [node.key, node]));
	const root = nodeByKey.get(structure.root);
	const candidates = [root, ...(root?.children ?? []).map((key) => nodeByKey.get(key))];

	if (root?.type !== "box") {
		context.addIssue({ code: "custom", message: "The structure root must be a box node", path: ["root"] });

		return;
	}

	if (!candidates.some((candidate) => hasCompleteFramePadding(candidate))) {
		context.addIssue({
			code: "custom",
			message:
				"The root or a direct content-frame child must define nonzero blockStart, inlineEnd, blockEnd, and inlineStart padding — match the adjacent inspected sections' logical gutters and vertical rhythm",
			path: ["root"],
		});
	}
};

const localeContentMapSchema = z.record(contentMapKeySchema, z.string().min(1).max(20_000));

export const sectionContentSchema = z.compile(
	z
		.strictObject({
			ar: localeContentMapSchema,
			assets: z.record(contentMapKeySchema, entityIdSchema).optional(),
			en: localeContentMapSchema,
			links: z.record(contentMapKeySchema, linkValueSchema).optional(),
		})
		.refine(
			(content) =>
				new TextEncoder().encode(JSON.stringify(content)).byteLength <= sectionAuthoringResourceLimits.bytes,
			`Section content exceeds the limit of ${sectionAuthoringResourceLimits.bytes} bytes`
		)
		.describe("Flat bilingual copy plus optional server-resolved asset IDs and typed links.")
);

export type SectionContent = z.infer<typeof sectionContentSchema>;

const listOverlappingContentKeys = (contract: SectionStructureContract) =>
	[...new Set([...contract.contentKeys, ...contract.assetKeys, ...contract.linkKeys])].filter(
		(key) =>
			Number(contract.contentKeys.has(key)) +
				Number(contract.assetKeys.has(key)) +
				Number(contract.linkKeys.has(key)) >
			1
	);

export const validateContentAgainstContract = ({
	content,
	context,
	contract,
	path = ["content"],
}: {
	content: SectionContent;
	context: IssueContext;
	contract: SectionStructureContract;
	path?: Array<number | string>;
}) => {
	const overlappingKeys = listOverlappingContentKeys(contract);

	if (overlappingKeys.length > 0) {
		context.addIssue({
			code: "custom",
			message: `Text, asset, and link keys must be globally unique: ${overlappingKeys.join(", ")}`,
			path,
		});
	}

	(["en", "ar"] as const).forEach((locale) => {
		const keys = new Set(Object.keys(content[locale]));
		const missing = [...contract.contentKeys].filter((key) => !keys.has(key));
		const extra = [...keys].filter((key) => !contract.contentKeys.has(key));

		if (missing.length > 0) {
			context.addIssue({
				code: "custom",
				message: `content.${locale} is missing the referenced keys: ${missing.join(", ")}`,
				path: [...path, locale],
			});
		}

		if (extra.length > 0) {
			context.addIssue({
				code: "custom",
				message: `content.${locale} defines keys the structure never references: ${extra.join(", ")}`,
				path: [...path, locale],
			});
		}
	});

	const assetKeys = new Set(Object.keys(content.assets ?? {}));
	const missingAssets = [...contract.assetKeys].filter((key) => !assetKeys.has(key));
	const extraAssets = [...assetKeys].filter((key) => !contract.assetKeys.has(key));

	if (missingAssets.length > 0) {
		context.addIssue({
			code: "custom",
			message: `content.assets is missing the referenced keys: ${missingAssets.join(", ")}`,
			path: [...path, "assets"],
		});
	}

	if (extraAssets.length > 0) {
		context.addIssue({
			code: "custom",
			message: `content.assets defines keys the structure never references: ${extraAssets.join(", ")}`,
			path: [...path, "assets"],
		});
	}

	const linkKeys = new Set(Object.keys(content.links ?? {}));
	const missingLinks = [...contract.linkKeys].filter((key) => !linkKeys.has(key));
	const extraLinks = [...linkKeys].filter((key) => !contract.linkKeys.has(key));

	if (missingLinks.length > 0) {
		context.addIssue({
			code: "custom",
			message: `content.links is missing the referenced keys: ${missingLinks.join(", ")}`,
			path: [...path, "links"],
		});
	}

	if (extraLinks.length > 0) {
		context.addIssue({
			code: "custom",
			message: `content.links defines keys the structure never references: ${extraLinks.join(", ")}`,
			path: [...path, "links"],
		});
	}
};

const validateAccessibleContentAgainstStructure = ({
	content,
	context,
	structure,
}: {
	content: SectionContent;
	context: IssueContext;
	structure: SectionStructure;
}) => {
	const nodeByKey = new Map(structure.nodes.map((node) => [node.key, node]));

	const accessibleKeys = (node: SectionStructureNode) => {
		if (node.type === "action") {
			return actionAccessibleNameKeys({ action: node, nodeByKey });
		}

		if (node.type === "trigger") {
			return [node.props.label];
		}

		if (node.type !== "field" && node.type !== "value") {
			return [];
		}

		const directLabelKey = node.children.length === 1 ? node.children[0] : undefined;
		const directLabel = directLabelKey ? nodeByKey.get(directLabelKey) : undefined;

		return directLabel?.type === "text" ? [directLabel.props.content] : [];
	};

	structure.nodes.forEach((node) => {
		const keys = accessibleKeys(node);

		if (keys.length === 0) {
			return;
		}

		(["en", "ar"] as const).forEach((locale) => {
			if (!keys.some((key) => content[locale][key]?.trim())) {
				context.addIssue({
					code: "custom",
					message: `${node.type} node "${node.key}" requires a nonblank accessible label in ${locale}`,
					path: ["content", locale],
				});
			}
		});
	});
};

const logicFieldsSchema = behaviorSlotsSchema.describe(
	"Interactive decimal inputs. Each key must be bound by exactly one field node's props.slot; initial is its default decimal string value."
);

const requireUniqueKeys = ({
	context,
	keys,
	label,
	path,
}: {
	context: IssueContext;
	keys: Array<string>;
	label: string;
	path: string;
}) => {
	const seen = new Set<string>();

	keys.forEach((key, index) => {
		if (seen.has(key)) {
			context.addIssue({ code: "custom", message: `Duplicate ${label} "${key}"`, path: [path, index] });
		}

		seen.add(key);
	});
};

const sectionExpressionLogicSchema = z
	.strictObject({
		expression: behaviorExpressionSourceSchema.describe(
			"One bounded CEL expression over the field keys producing the single output key result. Supports arithmetic, comparisons, boolean logic, ternaries, abs, ceil, clamp, floor, max, min, and round."
		),
		fields: logicFieldsSchema,
		kind: z.literal("expression"),
	})
	.superRefine((logic, context) => {
		requireUniqueKeys({
			context,
			keys: logic.fields.map(({ key }) => key),
			label: "field",
			path: "fields",
		});

		try {
			const program = compileBehaviorProgram({ fields: logic.fields, source: logic.expression });
			const initial = Object.fromEntries(logic.fields.map((field) => [field.key, field.initial]));

			if (
				program.expressionProfile !== "site-expression-v1" ||
				evaluateSiteBehavior({ program, slots: initial }) === null
			) {
				throw new Error("CEL expression fails with the field initial values");
			}
		} catch (error) {
			context.addIssue({ code: "custom", message: describeBehaviorError(error), path: ["expression"] });
		}
	});

const sectionNamedExpressionOutputSchema = z.strictObject({
	expression: behaviorExpressionSourceSchema.describe(
		"One bounded CEL expression over the declared decimal field keys."
	),
	type: siteBehaviorOutputTypeSchema.describe(
		"The expression result type. Use boolean for visibleWhen or disabledWhen and decimal for value nodes."
	),
});

const sectionNamedExpressionLogicSchema = z
	.strictObject({
		events: z.record(behaviorKeySchema, anchorSchema).optional(),
		fields: logicFieldsSchema,
		kind: z.literal("expression"),
		outputs: z.record(behaviorKeySchema, sectionNamedExpressionOutputSchema),
	})
	.superRefine((logic, context) => {
		requireUniqueKeys({
			context,
			keys: logic.fields.map(({ key }) => key),
			label: "field",
			path: "fields",
		});

		const outputs = Object.entries(logic.outputs);

		if (outputs.length < 1 || outputs.length > sectionAuthoringResourceLimits.outputs) {
			context.addIssue({
				code: "custom",
				message: `Named expressions require between 1 and ${sectionAuthoringResourceLimits.outputs} outputs`,
				path: ["outputs"],
			});

			return;
		}

		try {
			const program = compileBehaviorOutputs({
				events: logic.events,
				fields: logic.fields,
				outputs: Object.fromEntries(
					outputs.map(([key, output]) => [key, { source: output.expression, type: output.type }])
				),
			});

			const initial = Object.fromEntries(logic.fields.map((field) => [field.key, field.initial]));

			const initialOutputs = evaluateSiteBehaviorOutputs({ program, slots: initial });

			if (!initialOutputs || outputs.some(([key]) => initialOutputs[key] === undefined)) {
				throw new Error("CEL expressions fail with the field initial values");
			}
		} catch (error) {
			context.addIssue({ code: "custom", message: describeBehaviorError(error), path: ["outputs"] });
		}
	});

const sectionScriptLogicFields = {
	events: z.array(behaviorKeySchema).min(1).max(sectionAuthoringResourceLimits.events).optional(),
	fields: logicFieldsSchema,
	kind: z.literal("script"),
	outputs: z.array(behaviorKeySchema).min(1).max(sectionAuthoringResourceLimits.outputs),
	script: behaviorScriptSourceSchema.describe(
		"Plain JavaScript defining calculate(inputs) and, for declared events, interact(event). Runs sandboxed without DOM, Date, timers, network, or randomness. calculate returns every output; interact returns one documented host command."
	),
};

const validateScriptLogicKeys = (
	logic: { events?: Array<string>; fields: Array<{ key: string }>; outputs: Array<string> },
	context: IssueContext
) => {
	requireUniqueKeys({
		context,
		keys: logic.fields.map(({ key }) => key),
		label: "field",
		path: "fields",
	});

	requireUniqueKeys({ context, keys: logic.outputs, label: "output", path: "outputs" });

	if (logic.events) {
		requireUniqueKeys({ context, keys: logic.events, label: "event", path: "events" });
	}
};

const sectionScriptLogicSchema = z
	.strictObject({
		...sectionScriptLogicFields,
		initialOutputs: z.record(behaviorKeySchema, decimalValueSchema).optional(),
		targets: z.record(behaviorKeySchema, anchorSchema).optional(),
	})
	.superRefine((logic, context) => {
		validateScriptLogicKeys(logic, context);

		if (!logic.targets) {
			return;
		}

		const events = new Set(logic.events ?? []);
		const targets = Object.keys(logic.targets);

		if (events.size !== targets.length || targets.some((event) => !events.has(event))) {
			context.addIssue({
				code: "custom",
				message: "Prepared script targets must match its declared events",
				path: ["targets"],
			});
		}
	});

const sectionScriptLogicAuthoringSchema = z.strictObject(sectionScriptLogicFields).superRefine(validateScriptLogicKeys);

const sectionLogicDescription =
	"The section's logic program. Named CEL expressions produce typed outputs; the legacy expression form computes decimal result; script outputs are decimal and may declare host-mediated events.";

export const sectionLogicSchema = z.compile(
	z
		.union([sectionExpressionLogicSchema, sectionNamedExpressionLogicSchema, sectionScriptLogicSchema])
		.describe(sectionLogicDescription)
);

export const sectionLogicAuthoringSchema = z.compile(
	z
		.union([sectionExpressionLogicSchema, sectionNamedExpressionLogicSchema, sectionScriptLogicAuthoringSchema])
		.describe(sectionLogicDescription)
);

export type SectionLogic = z.infer<typeof sectionLogicSchema>;

export type SectionLogicAuthoring = z.infer<typeof sectionLogicAuthoringSchema>;

type SectionNamedExpressionLogic = z.infer<typeof sectionNamedExpressionLogicSchema>;

export const isNamedSectionLogic = (logic: SectionLogic): logic is SectionNamedExpressionLogic =>
	logic.kind === "expression" && Object.hasOwn(logic, "outputs");

type SectionLogicOutput = { key: string; type: SiteBehaviorOutputType };

export const listLogicOutputs = (logic: SectionLogic): Array<SectionLogicOutput> => {
	if (logic.kind === "script") {
		return logic.outputs.map((key) => ({ key, type: "decimal" }));
	}

	if (isNamedSectionLogic(logic)) {
		return Object.entries(logic.outputs).map(([key, output]) => ({ key, type: output.type }));
	}

	return [{ key: "result", type: "decimal" }];
};

const logicEventKeys = (logic: SectionLogic) => {
	if (logic.kind === "script") {
		return logic.events ?? [];
	}

	return isNamedSectionLogic(logic) ? Object.keys(logic.events ?? {}) : [];
};

export const prepareSectionLogic = async (logic: SectionLogic): Promise<SectionLogic> => {
	const parsed = sectionLogicSchema.parse(logic);

	if (parsed.kind !== "script") {
		return parsed;
	}

	const session = await createSiteScriptSession({
		outputs: parsed.outputs,
		script: parsed.script,
	});

	if (!session) {
		throw new BehaviorSectionError(
			"The script failed to produce its declared outputs with the field initial values"
		);
	}

	try {
		const outputs = session.evaluate({
			inputs: Object.fromEntries(parsed.fields.map((field) => [field.key, field.initial])),
		});

		if (!outputs) {
			throw new BehaviorSectionError(
				"The script failed to produce its declared outputs with the field initial values"
			);
		}

		const targets: Record<string, string> = {};

		for (const event of parsed.events ?? []) {
			const command = session.interact({ event });

			if (!command) {
				throw new BehaviorSectionError(`The script failed to produce a valid command for event "${event}"`);
			}

			targets[event] = command.anchor;
		}

		return sectionLogicSchema.parse({
			...parsed,
			initialOutputs: outputs,
			targets: parsed.events ? targets : undefined,
		});
	} finally {
		session.dispose();
	}
};

export const validateLogicAgainstContract = ({
	context,
	contract,
	logic,
	path = ["logic"],
}: {
	context: IssueContext;
	contract: SectionStructureContract;
	logic: SectionLogic | undefined;
	path?: Array<number | string>;
}) => {
	requireUniqueKeys({ context, keys: contract.slots, label: "field binding", path: "structure" });
	requireUniqueKeys({
		context,
		keys: [...contract.outputs, ...contract.booleanOutputs],
		label: "output binding",
		path: "structure",
	});
	requireUniqueKeys({ context, keys: contract.events, label: "event binding", path: "structure" });

	if (!logic) {
		if (
			contract.slots.length > 0 ||
			contract.outputs.length > 0 ||
			contract.booleanOutputs.length > 0 ||
			contract.events.length > 0
		) {
			context.addIssue({
				code: "custom",
				message: "The structure binds behavior fields, outputs, or events but no logic layer is declared",
				path,
			});
		}

		return;
	}

	const describeSet = (values: Iterable<string>) => [...values].join(", ") || "(none)";
	const slotSet = new Set(contract.slots);
	const fieldKeys = logic.fields.map(({ key }) => key);
	const fieldSet = new Set(fieldKeys);

	if (slotSet.size !== fieldSet.size || fieldKeys.some((key) => !slotSet.has(key))) {
		context.addIssue({
			code: "custom",
			message: `The structure binds field slots [${describeSet(slotSet)}] but the logic declares fields [${describeSet(fieldSet)}] — every field key needs exactly one field node`,
			path,
		});
	}

	const boundOutputTypes = new Map<string, SiteBehaviorOutputType>([
		...contract.outputs.map((key) => [key, "decimal"] as const),
		...contract.booleanOutputs.map((key) => [key, "boolean"] as const),
	]);

	const expectedOutputs = listLogicOutputs(logic);
	const expectedSet = new Set(expectedOutputs.map(({ key }) => key));

	if (boundOutputTypes.size !== expectedSet.size || expectedOutputs.some(({ key }) => !boundOutputTypes.has(key))) {
		context.addIssue({
			code: "custom",
			message: `The structure binds outputs [${describeSet(boundOutputTypes.keys())}] but the logic produces [${describeSet(expectedSet)}] — every output needs exactly one compatible value, visibility, or disabled binding`,
			path,
		});
	}

	expectedOutputs.forEach(({ key, type: outputType }) => {
		const boundType = boundOutputTypes.get(key);

		if (boundType && boundType !== outputType) {
			context.addIssue({
				code: "custom",
				message: `Output "${key}" is ${outputType} but its structure binding requires ${boundType}`,
				path,
			});
		}
	});

	const eventSet = new Set(contract.events);
	const declaredEvents = logicEventKeys(logic);
	const declaredEventSet = new Set(declaredEvents);

	if (eventSet.size !== declaredEventSet.size || declaredEvents.some((event) => !eventSet.has(event))) {
		context.addIssue({
			code: "custom",
			message: `The structure binds trigger events [${describeSet(eventSet)}] but the logic declares [${describeSet(declaredEventSet)}] — every trigger needs one declared event`,
			path,
		});
	}
};

export const composedSectionSpecificationSchema = z.compile(
	z
		.strictObject({
			content: sectionContentSchema,
			logic: sectionLogicSchema.optional(),
			structure: sectionStructureSchema,
		})
		.superRefine((specification, context) => {
			const contract = deriveStructureContract(specification.structure);

			validateStructureFramePadding(specification.structure, context);
			validateContentAgainstContract({ content: specification.content, context, contract });
			validateAccessibleContentAgainstStructure({
				content: specification.content,
				context,
				structure: specification.structure,
			});
			validateStructureLiveness({
				content: specification.content,
				context,
				structure: specification.structure,
			});
			validateLogicAgainstContract({ context, contract, logic: specification.logic });
		})
);

export type ComposedSectionSpecification = z.infer<typeof composedSectionSpecificationSchema>;
