import { z } from "zod";

import { deriveStructureContract, sectionContentReferenceProps } from "@starter/infinite-website/editing";

import type { ComposeWebsiteSectionToolInput } from "./website-contracts";

export const isWebsiteCopySplitEnabled = () => process.env.WEBSITE_AUTHORING_COPY_SPLIT === "1";

export const websiteCopySplitInstruction =
	"Copy override: a separate copywriter writes the final copy after your structure validates. For every copy key and image alt give a one-to-five-word note of its role and intent in each language, such as Heading: why choose us, not final prose. Keep every supplied fact (name, price, number, schedule) exact inside the notes. Spend your effort on structure, content keys, images, and links.";

const propsSchema = z.looseObject({
	alt: z.string().optional(),
	appearance: z.string().optional(),
	asset: z.string().optional(),
	element: z.string().optional(),
});

const propsRecordSchema = z.record(z.string(), z.json());

const stringSchema = z.string();

const objectSchema = z.instanceof(Object);

const textSchema = z.string().min(1).max(1000);

const localizedSchema = z.strictObject({ ar: textSchema, en: textSchema });

type LocalizedCopy = z.infer<typeof localizedSchema>;

export type ComposedCopySlot = {
	appearance?: string;
	draft?: { ar: string; en: string };
	element?: string;
	key: string;
	query?: string;
	role: string;
	within?: string;
};

const listImageAlts = ({ images, structure }: Pick<ComposeWebsiteSectionToolInput, "images" | "structure">) =>
	new Map(
		structure.nodes.flatMap((node) => {
			const { alt, asset } = propsSchema.parse(node.props);

			return node.type === "media" && alt && asset && images?.[asset] ? [[alt, asset]] : [];
		})
	);

export const deriveComposedCopySlots = ({ copy, images, structure }: ComposeWebsiteSectionToolInput) => {
	const keys = deriveStructureContract(structure).contentKeys;
	const parents = new Map(structure.nodes.flatMap((node) => node.children.map((child) => [child, node.type])));
	const alts = listImageAlts({ images, structure });
	const seen = new Set<string>();

	return structure.nodes.flatMap((node) => {
		const props = propsSchema.parse(node.props);
		const values = propsRecordSchema.parse(node.props);

		return Object.entries(sectionContentReferenceProps[node.type]).flatMap(([property, kind]) => {
			const key = stringSchema.safeParse(values[property]).data;

			if (kind !== "text" || !key || !keys.has(key) || seen.has(key)) {
				return [];
			}

			seen.add(key);
			const asset = alts.get(key);
			const image = asset ? images?.[asset] : undefined;

			return [
				{
					appearance: props.appearance,
					draft: image?.alt ?? copy[key],
					element: props.element,
					key,
					query: image?.query,
					role: `${node.type}.${property}`,
					within: parents.get(node.key),
				} satisfies ComposedCopySlot,
			];
		});
	});
};

export const createComposedCopySchema = (slots: Array<ComposedCopySlot>) =>
	z.strictObject(Object.fromEntries(slots.map(({ key }) => [key, localizedSchema])));

export const mergeComposedCopy = ({
	input,
	output,
}: {
	input: ComposeWebsiteSectionToolInput;
	output: Record<string, LocalizedCopy>;
}) => {
	const alts = listImageAlts(input);
	const copy = Object.fromEntries(Object.entries(output).filter(([key]) => !alts.has(key)));

	const images = input.images
		? Object.fromEntries(
				Object.entries(input.images).map(([asset, image]) => {
					const alt = [...alts].find(([, assetKey]) => assetKey === asset)?.[0];

					return [asset, { ...image, alt: (alt ? output[alt] : undefined) ?? image.alt }];
				})
			)
		: undefined;

	return { copy, images };
};

export const applyComposedCopy = ({
	args,
	copy,
	images,
}: {
	args: unknown;
	copy: Record<string, LocalizedCopy>;
	images: ComposeWebsiteSectionToolInput["images"];
}) => {
	const target = objectSchema.safeParse(args);

	if (!target.success) {
		return false;
	}

	Object.assign(target.data, { copy });

	if (images) {
		Object.assign(target.data, { images });
	}

	return true;
};
