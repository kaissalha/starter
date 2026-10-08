import { z } from "zod";

import { sectionNodeKeySchema, sectionStructureNodeSchema } from "../behavior/specification";
import { sectionCategories } from "../document/structure-schema";

const unsupportedReferenceNodeSchema = z.strictObject({
	children: z.tuple([]),
	key: sectionNodeKeySchema,
	props: z.strictObject({ summary: z.string() }),
	type: z.literal("unsupported"),
});

export const sectionReferenceEntrySchema = z.compile(
	z.strictObject({
		category: z.enum(sectionCategories),
		description: z.string().min(1),
		descriptor: z.string().min(1),
		pattern: z.string().min(1),
		reference: z.strictObject({
			nodes: z.array(z.union([sectionStructureNodeSchema, unsupportedReferenceNodeSchema])).min(1),
			notes: z.array(z.string()),
			root: sectionNodeKeySchema,
		}),
		tags: z.array(z.string()),
	})
);

export type SectionReferenceEntry = z.infer<typeof sectionReferenceEntrySchema>;

export const describeSectionReference = ({
	category,
	description,
	pattern,
	tags,
}: Pick<SectionReferenceEntry, "category" | "description" | "pattern" | "tags">) =>
	`${pattern.replaceAll("-", " ")} (${category}). ${description}${tags.length > 0 ? ` Traits: ${tags.join(", ")}.` : ""}`;
