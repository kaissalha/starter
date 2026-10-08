import { z } from "zod";

import { authoringJsonObjectSchema, type AuthoringJsonValue } from "./content-schema";
import {
	alignmentSchema,
	coreNodeTypes,
	fillSchema,
	foregroundSchema,
	typographyAppearanceSchema,
	type SiteSection,
} from "./structure-schema";

const loose = z.json().optional();

const nodeViewSchema = z.compile(
	z.looseObject({
		layout: z.looseObject({ maxInlineSize: loose, padding: loose, position: loose }).optional(),
		props: z.looseObject({
			align: loose,
			appearance: typographyAppearanceSchema.optional(),
			background: loose,
			columns: loose,
			fill: fillSchema.optional(),
			foreground: foregroundSchema.optional(),
			overlay: loose,
			radius: loose,
			tone: foregroundSchema.optional(),
		}),
		type: z.enum(coreNodeTypes),
	})
);

type NodeView = z.infer<typeof nodeViewSchema>;

const collectNodes = (value: AuthoringJsonValue, depth: number): Array<{ depth: number; node: NodeView }> => {
	if (Array.isArray(value)) {
		return value.flatMap((item) => collectNodes(item, depth));
	}

	const object = authoringJsonObjectSchema.safeParse(value);

	if (!object.success) {
		return [];
	}

	const node = nodeViewSchema.safeParse(object.data);

	return [
		...(node.success ? [{ depth, node: node.data }] : []),
		...Object.values(object.data).flatMap((child) => collectNodes(child, node.success ? depth + 1 : depth)),
	];
};

const base = (value: AuthoringJsonValue | undefined) => {
	const responsive = authoringJsonObjectSchema.safeParse(value);

	return responsive.success && "base" in responsive.data ? responsive.data.base : value;
};

const tally = (values: Array<string>) => {
	const counts = new Map<string, number>();

	for (const value of values) {
		counts.set(value, (counts.get(value) ?? 0) + 1);
	}

	return [...counts.entries()].sort((left, right) => right[1] - left[1]).map(([value, count]) => ({ count, value }));
};

const typeRole = (appearance: string) => {
	if (appearance.startsWith("body")) {
		return "body";
	}

	return appearance.startsWith("label") ? "label" : "heading";
};

const alignmentOf = (value: AuthoringJsonValue | undefined) => alignmentSchema.safeParse(base(value)).data;

const radiusLabel = (value: AuthoringJsonValue | undefined) =>
	String(z.union([z.string(), z.number()]).safeParse(value).data ?? "mixed");

const structuralTypes = new Set(["carousel", "disclosure", "embed", "field", "grid", "masonry", "menu", "tabs"]);

export const summarizeSectionDesign = (section: SiteSection) => {
	const entries = collectNodes(section.root, 0);
	const nodes = entries.map(({ node }) => node);
	const root = nodes[0];
	const frame = entries.find(({ depth, node }) => depth === 1 && node.layout?.padding !== undefined)?.node;
	const widths = nodes.flatMap(({ layout }) => (layout?.maxInlineSize === undefined ? [] : [layout.maxInlineSize]));

	const columns = nodes.flatMap(({ props, type }) => {
		const value = z.number().safeParse(base(props.columns)).data;

		return type === "grid" && value !== undefined ? [value] : [];
	});

	const overMedia = nodes.some(
		({ layout, props, type }) =>
			props.foreground === "media" ||
			props.tone === "media" ||
			(type === "media" && (props.overlay !== undefined || base(layout?.position) === "absolute"))
	);

	return {
		alignment: tally(nodes.flatMap(({ props }) => alignmentOf(props.align) ?? []))[0]?.value ?? null,
		category: section.category,
		columns: columns.length > 0 ? Math.max(...columns) : null,
		fill: root?.props.fill ?? (root?.props.background === undefined ? null : "gradient"),
		maxWidth: widths[0] ?? null,
		overMedia,
		padding: { frame: frame?.layout?.padding ?? null, root: root?.layout?.padding ?? null },
		pattern: section.source?.pattern ?? null,
		primitives: tally(nodes.filter(({ type }) => structuralTypes.has(type)).map(({ type }) => type)).map(
			({ count, value }) => `${value}${count > 1 ? `x${count}` : ""}`
		),
		radius: tally(nodes.flatMap(({ props }) => (props.radius === undefined ? [] : [radiusLabel(props.radius)])))
			.slice(0, 3)
			.map(({ value }) => value),
		type: tally(
			nodes.flatMap(({ props, type }) =>
				type === "text" && props.appearance ? [`${typeRole(props.appearance)}:${props.appearance}`] : []
			)
		)
			.slice(0, 3)
			.map(({ value }) => value),
	};
};
