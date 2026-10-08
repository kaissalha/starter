import { z } from "zod";

import type { CaseTraits } from "./corpus";

const nodeSchema = z.looseObject({
	children: z.array(z.string()).default([]),
	key: z.string(),
	props: z.record(z.string(), z.json()).default({}),
	type: z.string(),
});

export const jsonRecordSchema = z.record(z.string(), z.json());

const composeArgumentsSchema = z.looseObject({
	copy: z.record(z.string(), z.looseObject({ ar: z.string(), en: z.string() })).default({}),
	structure: z.looseObject({ nodes: z.array(nodeSchema) }),
});

type JsonValue = z.infer<typeof nodeSchema>["props"][string];

const lengthPattern = /^-?\d*\.?\d+(?:sp|px|rem|em|%|cqi|cqw|svh|vh)$|^0$/u;

const lengthKeyPattern = /gap|padding|margin|inset|size|radius|width|height|block|inline/iu;

const lengthStringSchema = z.string().regex(lengthPattern);

const collectLengths = (value: JsonValue, key = ""): Array<string> => {
	const text = lengthStringSchema.safeParse(value);

	if (text.success) {
		return [text.data];
	}

	const number = z.number().safeParse(value);

	if (number.success) {
		return lengthKeyPattern.test(key) ? [`${number.data}px`] : [];
	}

	const list = z.array(z.json()).safeParse(value);

	if (list.success) {
		return list.data.flatMap((item) => collectLengths(item, key));
	}

	const record = z.record(z.string(), z.json()).safeParse(value);

	return record.success
		? Object.entries(record.data).flatMap(([name, item]) =>
				collectLengths(item, lengthKeyPattern.test(name) ? name : key)
			)
		: [];
};

const share = (part: number, total: number) => (total === 0 ? null : part / total);

const signature = (node: z.infer<typeof nodeSchema>, byKey: Map<string, z.infer<typeof nodeSchema>>) =>
	`${node.type}[${node.children.map((child) => byKey.get(child)?.type ?? "?").join(",")}]`;

const maxRepeated = (nodes: Array<z.infer<typeof nodeSchema>>) => {
	const byKey = new Map(nodes.map((node) => [node.key, node]));

	return Math.max(
		0,
		...nodes.map((parent) => {
			const counts = new Map<string, number>();

			for (const child of parent.children) {
				const node = byKey.get(child);

				if (node && node.children.length > 0) {
					const sig = signature(node, byKey);
					counts.set(sig, (counts.get(sig) ?? 0) + 1);
				}
			}

			return Math.max(0, ...counts.values());
		})
	);
};

export const computeStaticMetrics = ({
	args,
	traits,
}: {
	args: z.infer<typeof jsonRecordSchema>;
	traits: CaseTraits;
}) => {
	const parsed = composeArgumentsSchema.safeParse(args).data;

	if (!parsed) {
		return null;
	}

	const { copy, structure } = parsed;
	const nodes = structure.nodes;
	const lengths = nodes.flatMap(({ props }) => collectLengths(props));
	const spLengths = lengths.filter((length) => length.endsWith("sp"));
	const texts = nodes.filter(({ type }) => type === "text");
	const withAppearance = texts.filter(({ props }) => props.appearance !== undefined);
	const withFontSize = texts.filter(({ props }) => props.fontSize !== undefined);
	const count = (type: string) => nodes.filter((node) => node.type === type).length;

	const copyText = Object.values(copy)
		.map(({ en }) => en)
		.join("\n");

	const repeated = maxRepeated(nodes);

	const checks = {
		actions: traits.minActions === undefined ? null : count("action") >= traits.minActions,
		facts: traits.facts === undefined ? null : traits.facts.every((fact) => copyText.includes(fact)),
		fields: traits.minFields === undefined ? null : count("field") >= traits.minFields,
		media: traits.minMedia === undefined ? null : count("media") >= traits.minMedia,
		repeat: traits.minRepeat === undefined ? null : repeated >= traits.minRepeat,
	};

	const applicable = Object.values(checks).filter((value) => value !== null);

	return {
		appearanceShare: share(withAppearance.length, texts.length),
		fontSizeShare: share(withFontSize.length, texts.length),
		lengthCount: lengths.length,
		maxRepeatedSiblings: repeated,
		nodeCount: nodes.length,
		primitives: Object.fromEntries([...new Set(nodes.map(({ type }) => type))].map((type) => [type, count(type)])),
		spShare: share(spLengths.length, lengths.length),
		traitChecks: checks,
		traitsMet: applicable.length === 0 ? null : applicable.every(Boolean),
	};
};

export type StaticMetrics = NonNullable<ReturnType<typeof computeStaticMetrics>>;
