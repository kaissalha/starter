import { z } from "zod";

import {
	isJsonObject,
	jsonObjectSchema,
	type AuthoringJsonObject,
	type AuthoringJsonValue,
	type JsonObject,
	type JsonValue,
} from "../document/content-schema";
import { siteNodeLayoutFields, type PersistedSiteNode } from "../document/structure-schema";
import { entityIdFromSeed } from "../sections/entity-id";
import { contentKeySchema, sectionContactFormLabelFields, type SectionStructureNode } from "./specification";

export type NodeOf<Type extends SectionStructureNode["type"]> = Extract<SectionStructureNode, { type: Type }>;

type ContentRef = (key: string) => JsonValue;

export type RuntimeItem = { id: string; key: string; panel: Array<JsonValue>; trigger: Array<JsonValue> };

export type CollectionNode = NodeOf<"carousel" | "disclosure" | "embed" | "tabs">;

export const isCollectionNode = (node: SectionStructureNode): node is CollectionNode =>
	node.type === "carousel" || node.type === "disclosure" || node.type === "embed" || node.type === "tabs";

const isAuthoringObject = (value: AuthoringJsonValue): value is AuthoringJsonObject =>
	value !== null && value !== undefined && Object(value) === value && !Array.isArray(value);

const withoutUndefined = (value: AuthoringJsonValue): JsonValue | undefined => {
	if (Array.isArray(value)) {
		return value.map((item) => withoutUndefined(item) ?? null);
	}

	if (!isAuthoringObject(value)) {
		return value;
	}

	return Object.fromEntries(
		Object.entries(value).flatMap(([name, child]) => {
			const cleaned = withoutUndefined(child);

			return cleaned === undefined ? [] : [[name, cleaned]];
		})
	);
};

export const plainJsonObject = (value: AuthoringJsonObject): JsonObject =>
	jsonObjectSchema.parse(withoutUndefined(value));

const numberSchema = z.number();

const booleanSchema = z.boolean();

const coordinatesSchema = z.strictObject({ lat: z.number(), lng: z.number() });

const mapTypeSchema = z.enum(["roadmap", "satellite"]);

const defined = (object: JsonObject): JsonObject =>
	Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));

const withoutIds = (value: JsonValue | undefined): JsonValue | undefined => {
	if (Array.isArray(value)) {
		return value.map((item) => withoutIds(item) ?? null);
	}

	if (!isJsonObject(value)) {
		return value;
	}

	return Object.fromEntries(
		Object.entries(value)
			.filter(([name, child]) => name !== "id" && child !== undefined)
			.toSorted(([first], [second]) => first.localeCompare(second))
			.map(([name, child]) => [name, withoutIds(child)])
	);
};

export const sameWithoutIds = ({ actual, expected }: { actual: JsonObject; expected: JsonObject }) =>
	JSON.stringify(withoutIds(actual)) === JSON.stringify(withoutIds(expected));

const progressDecorations = [
	{
		appearance: { fill: "border" },
		kind: "fill",
		layout: { blockSize: "1px", inlineSize: "full", inset: { blockEnd: 0, inlineStart: 0 } },
		source: "static",
	},
	{
		appearance: { fill: "accent" },
		axis: "inline",
		kind: "fill",
		layout: { blockSize: "2px", inlineSize: "full", inset: { blockEnd: 0, inlineStart: 0 } },
		source: "timer",
	},
];

const hasProgressDecorations = (value: JsonValue | undefined) =>
	JSON.stringify(withoutIds(value)) === JSON.stringify(withoutIds(progressDecorations));

export const carouselRuntimeProps = ({
	groupId,
	node,
	ref,
	slides,
}: {
	groupId: (name: string) => string;
	node: NodeOf<"carousel">;
	ref: ContentRef;
	slides: Array<JsonValue>;
}): JsonObject => {
	const { arrows, autoplayMs, controlsAlign, controlsPlacement, dots, gap, loop, slideAlign, slideBasis } =
		node.props;

	const group = { align: controlsAlign ?? "start", placement: controlsPlacement ?? "after" };
	const arrowAppearance = { fill: "subtle", foreground: "primary", radius: "full" };

	return defined({
		autoplay: autoplayMs ? { delay: autoplayMs, pauseOnFocus: true, pauseOnHover: true } : undefined,
		controlGroups: [
			...(arrows && node.props.previousLabel && node.props.nextLabel
				? [
						{
							...group,
							controls: [
								{ appearance: arrowAppearance, kind: "previous", label: ref(node.props.previousLabel) },
								{ appearance: arrowAppearance, kind: "next", label: ref(node.props.nextLabel) },
							],
							gap: "1rem",
							id: groupId("arrows"),
						},
					]
				: []),
			...(dots && node.props.dotsLabel
				? [
						{
							...group,
							controls: [
								{
									active: { blockSize: "0.5rem", inlineSize: "2rem", opacity: 1 },
									appearance: { foreground: "accent" },
									inactive: { blockSize: "0.5rem", inlineSize: "0.5rem", opacity: 0.3 },
									kind: "indicators",
									label: ref(node.props.dotsLabel),
								},
							],
							id: groupId("dots"),
						},
					]
				: []),
		],
		gap,
		label: ref(node.props.label),
		options: defined({ align: slideAlign ?? "start", loop }),
		slideBasis,
		slides,
	});
};

export const disclosureRuntimeProps = ({ items, node }: { items: Array<RuntimeItem>; node: NodeOf<"disclosure"> }) => {
	const { defaultOpen, divider, multiple, openIndicator, panelPadding, triggerPadding } = node.props;

	return defined({
		defaultOpen,
		divider,
		items: items.map(({ id, panel, trigger }) => ({ id, panel, trigger })),
		multiple,
		openIndicator,
		panelPadding,
		triggerPadding,
	});
};

export const tabsRuntimeProps = ({
	items,
	node,
	ref,
}: {
	items: Array<RuntimeItem>;
	node: NodeOf<"tabs">;
	ref: ContentRef;
}) => {
	const { autoplayMs, crossfadeMs, indicator, listGap, listPlacement, orientation, panels, progress } = node.props;

	return defined({
		autoplay: autoplayMs ? { intervalMs: autoplayMs, pauseOnHover: true } : undefined,
		crossfadeMs,
		decorations: progress ? progressDecorations : undefined,
		indicator,
		items: items.map(({ id, key, panel, trigger }) => ({ id, panel, trigger, value: key })),
		label: ref(node.props.label),
		listAppearance: listGap === undefined ? undefined : { gap: listGap },
		listPlacement,
		orientation,
		panels,
	});
};

const nonAppearanceEmbedFields = new Set([
	...Object.keys(siteNodeLayoutFields),
	...Object.keys(sectionContactFormLabelFields),
	"address",
	"columns",
	"coordinates",
	"label",
	"mapType",
	"phoneLabel",
	"provider",
	"submitWidth",
	"tint",
	"visibleWhen",
	"zoom",
]);

export const embedRuntimeProps = ({ node, ref }: { node: NodeOf<"embed">; ref: ContentRef }): JsonObject => {
	const appearance = Object.fromEntries(
		Object.entries(node.props).filter(([name]) => !nonAppearanceEmbedFields.has(name))
	);

	const { props } = node;

	if (props.provider === "google-map") {
		return jsonObjectSchema.parse(
			defined({
				...appearance,
				config: defined({
					address: ref(props.address),
					coordinates: props.coordinates,
					mapType: props.mapType,
					zoom: props.zoom,
				}),
				effect: props.tint ? { intensity: 0.2, kind: "tint" } : undefined,
				label: ref(props.label),
				provider: props.provider,
			})
		);
	}

	return jsonObjectSchema.parse(
		defined({
			...appearance,
			config: defined({
				columns: props.columns,
				labels: defined({
					anotherLabel: ref(props.anotherLabel),
					emailLabel: ref(props.emailLabel),
					error: ref(props.error),
					messageLabel: ref(props.messageLabel),
					nameLabel: ref(props.nameLabel),
					pendingLabel: ref(props.pendingLabel),
					phoneLabel: props.phoneLabel ? ref(props.phoneLabel) : undefined,
					submitLabel: ref(props.submitLabel),
					success: ref(props.success),
				}),
				submitWidth: props.submitWidth,
			}),
			label: ref(props.label),
			provider: props.provider,
		})
	);
};

export const collectionMatchesRuntime = ({
	items,
	node,
	original,
	ref,
	slides,
}: {
	items: Array<RuntimeItem>;
	node: CollectionNode;
	original: JsonObject;
	ref: ContentRef;
	slides: Array<JsonValue>;
}) => {
	const rebuilt = (() => {
		switch (node.type) {
			case "carousel":
				return carouselRuntimeProps({ groupId: () => "", node, ref, slides });
			case "disclosure":
				return disclosureRuntimeProps({ items, node });
			case "tabs":
				return tabsRuntimeProps({ items, node, ref });
			case "embed":
				return embedRuntimeProps({ node, ref });
		}
	})();

	return sameWithoutIds({ actual: rebuilt, expected: original });
};

const objectOf = (value: JsonValue | undefined): JsonObject => (isJsonObject(value) ? value : {});

const arrayOf = (value: JsonValue | undefined): Array<JsonValue> => (Array.isArray(value) ? value : []);

export const groupIdFor = ({ key, name, sectionId }: { key: string; name: string; sectionId: string }) =>
	entityIdFromSeed({ seed: `${sectionId}:node:${key}:${name}` });

export const authoringCarouselProps = ({
	key,
	props,
}: {
	key: (reference: JsonValue | undefined) => string | null;
	props: JsonObject;
}) => {
	const groups = arrayOf(props.controlGroups).map(objectOf);
	const controls = groups.flatMap((group) => arrayOf(group.controls).map(objectOf));
	const control = (kind: string) => controls.find((candidate) => candidate.kind === kind);

	const arrowGroup = groups.find((group) =>
		arrayOf(group.controls).some((entry) => objectOf(entry).kind === "previous")
	);

	const dotsGroup = groups.find((group) =>
		arrayOf(group.controls).some((entry) => objectOf(entry).kind === "indicators")
	);

	const options = objectOf(props.options);
	const autoplay = objectOf(props.autoplay);
	const placed = arrowGroup ?? dotsGroup;
	const placement = placed?.placement === "before" ? "before" : undefined;
	const align = placed?.align === "center" || placed?.align === "end" ? placed.align : undefined;
	const previousLabel = key(control("previous")?.label);
	const nextLabel = key(control("next")?.label);
	const dotsLabel = key(control("indicators")?.label);
	const arrows = Boolean(arrowGroup && previousLabel && nextLabel);
	const dots = Boolean(dotsGroup && dotsLabel);

	return defined({
		arrows: arrows ? true : undefined,
		autoplayMs: numberSchema.safeParse(autoplay.delay).data,
		controlsAlign: align,
		controlsPlacement: placement,
		dots: dots ? true : undefined,
		dotsLabel: dots ? (dotsLabel ?? undefined) : undefined,
		gap: props.gap,
		label: key(props.label) ?? undefined,
		loop: booleanSchema.safeParse(options.loop).data,
		nextLabel: arrows ? (nextLabel ?? undefined) : undefined,
		previousLabel: arrows ? (previousLabel ?? undefined) : undefined,
		slideAlign: options.align === "center" ? "center" : undefined,
		slideBasis: props.slideBasis,
	});
};

export const authoringDisclosureProps = ({ props }: { props: JsonObject }) =>
	defined({
		defaultOpen: props.defaultOpen,
		divider: props.divider,
		multiple: props.multiple,
		openIndicator: props.openIndicator,
		panelPadding: props.panelPadding,
		triggerPadding: props.triggerPadding,
	});

export const authoringTabsProps = ({
	key,
	props,
}: {
	key: (reference: JsonValue | undefined) => string | null;
	props: JsonObject;
}) => {
	const autoplay = objectOf(props.autoplay);
	const listAppearance = objectOf(props.listAppearance);

	return defined({
		autoplayMs: numberSchema.safeParse(autoplay.intervalMs).data,
		crossfadeMs: props.crossfadeMs,
		indicator: props.indicator,
		label: key(props.label) ?? undefined,
		listGap: listAppearance.gap,
		listPlacement: props.listPlacement,
		orientation: props.orientation,
		panels: props.panels === "swap" || props.panels === "crossfade" ? props.panels : undefined,
		progress: hasProgressDecorations(props.decorations) ? true : undefined,
	});
};

export const authoringEmbedProps = ({
	key,
	props,
}: {
	key: (reference: JsonValue | undefined) => string | null;
	props: JsonObject;
}) => {
	const config = objectOf(props.config);
	const labels = objectOf(config.labels);

	const appearance = Object.fromEntries(
		Object.entries(props).filter(([name]) => !["config", "effect", "label", "provider"].includes(name))
	);

	const base = { ...appearance, label: key(props.label) ?? undefined, provider: props.provider };

	if (props.provider === "google-map") {
		return defined({
			...base,
			address: key(config.address) ?? undefined,
			coordinates: coordinatesSchema.safeParse(config.coordinates).data,
			mapType: mapTypeSchema.safeParse(config.mapType).data,
			tint: Object.keys(objectOf(props.effect)).length > 0 ? true : undefined,
			zoom: numberSchema.safeParse(config.zoom).data,
		});
	}

	return defined({
		...base,
		...Object.fromEntries(
			Object.keys(sectionContactFormLabelFields).map((name) => [name, key(labels[name]) ?? undefined])
		),
		columns: config.columns,
		phoneLabel: key(labels.phoneLabel) ?? undefined,
		submitWidth: config.submitWidth,
	});
};

export const collectionItemKey = ({
	index,
	parent,
	value,
}: {
	index: number;
	parent: string;
	value: JsonValue | undefined;
}) => {
	const candidate = contentKeySchema.safeParse(value);

	return candidate.success ? candidate.data : `${parent}-item-${index + 1}`;
};

export const persistedCollectionChildren = (node: PersistedSiteNode): Array<PersistedSiteNode> => {
	if (node.type === "carousel") {
		return node.props.slides;
	}

	return node.type === "tabs" || node.type === "disclosure"
		? node.props.items.flatMap((item) => [...item.trigger, ...item.panel])
		: [];
};
