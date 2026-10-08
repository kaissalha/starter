import { z } from "zod";

import { brandFoundationSchema } from "@starter/infinite-brand";

import { iso6391LanguageCodeSchema, localizedContentSchema } from "../document/content-schema";
import { siteDocumentLogicSchema, siteDocumentSchema } from "../document/site-document-schema";
import { siteSectionSchema } from "../document/structure-schema";
import { resolvedAssetSchema } from "../primitives/shared";

export const websiteBriefSchema = z.compile(
	z
		.strictObject({
			details: z
				.string()
				.trim()
				.min(1)
				.max(6000)
				.optional()
				.describe(
					"User-confirmed business facts approved for public website copy, such as services, hours, and service areas."
				),
			location: z.string().trim().min(1).max(200),
			menu: z
				.array(z.string().trim().min(1).max(300))
				.min(1)
				.max(30)
				.optional()
				.describe("Actual menu items supplied by the business; never inferred from its type."),
			name: z.string().trim().min(1).max(120),
			portfolio: z
				.array(z.string().trim().min(1).max(500))
				.min(1)
				.max(20)
				.optional()
				.describe("Actual projects or work descriptions approved by the business for publication."),
			schemaVersion: z.literal(1),
			type: z.string().trim().min(1).max(120),
			voice: z
				.string()
				.trim()
				.min(1)
				.max(500)
				.optional()
				.describe("The business's preferred writing tone, shared across languages and edits."),
		})
		.meta({ id: "WebsiteBriefV1" })
);

export const assetMapSchema = z.compile(z.record(z.uuid(), resolvedAssetSchema));

export const websiteAssetBindingsSchema = assetMapSchema;

export const websiteSnapshotSchema = z.strictObject({
	assets: assetMapSchema,
	brand: brandFoundationSchema,
	document: siteDocumentSchema,
	schemaVersion: z.literal(1),
	templateId: z.string().min(1),
});

export const persistedWebsiteStructureSchema = siteDocumentSchema.omit({ content: true, logic: true });

export const persistedWebsiteContentSchema = localizedContentSchema;

export const persistedWebsiteLogicSchema = siteDocumentLogicSchema;

export const persistedWebsiteSiteSchema = z.strictObject({
	assetBindings: websiteAssetBindingsSchema,
	brand: brandFoundationSchema,
	document: siteDocumentSchema,
	schemaVersion: z.literal(1),
	templateId: z.string().min(1),
});

const localizedSectionContentSchema = z.partialRecord(iso6391LanguageCodeSchema, z.record(z.string().min(1), z.json()));

export const sectionTargetSchema = z.compile(
	z.discriminatedUnion("area", [
		z.strictObject({ area: z.literal("header"), index: z.number().int().nonnegative() }),
		z.strictObject({ area: z.literal("footer"), index: z.number().int().nonnegative() }),
		z.strictObject({
			area: z.literal("page"),
			index: z.number().int().nonnegative(),
			pageId: z.uuid(),
		}),
	])
);

export const websiteGenerationSlotSchema = z.compile(
	z.strictObject({
		assetIds: z.array(z.uuid()),
		sectionId: z.uuid(),
		slotKey: z.string().min(1),
		target: sectionTargetSchema,
	})
);

export const websiteSectionAdditionInputSchema = z.compile(
	z.strictObject({
		index: z.number().int().nonnegative(),
		pageId: z.uuid(),
		pattern: z.string().min(1),
		schemaVersion: z.literal(1),
	})
);

export const websiteLayoutGenerationTargetSchema = z.compile(
	z.discriminatedUnion("area", [
		z.strictObject({
			area: z.literal("header"),
			index: z.number().int().nonnegative(),
			sectionId: z.uuid(),
		}),
		z.strictObject({
			area: z.literal("footer"),
			index: z.number().int().nonnegative(),
			sectionId: z.uuid(),
		}),
		z.strictObject({
			area: z.literal("page"),
			index: z.number().int().nonnegative(),
			pageId: z.uuid(),
			sectionId: z.uuid(),
		}),
	])
);

export const websiteLayoutGenerationInputSchema = z.compile(
	z.strictObject({
		pattern: z.string().min(1),
		schemaVersion: z.literal(1),
		target: websiteLayoutGenerationTargetSchema,
	})
);

export const websiteTemplateChangeInputSchema = z.compile(
	z.strictObject({
		schemaVersion: z.literal(1),
		templateId: z.string().min(1),
	})
);

export const websiteGenerationEventSchema = z.discriminatedUnion("type", [
	z.strictObject({
		eventKey: z.string().min(1),
		stage: z.enum(["planning", "writing", "saving"]),
		type: z.literal("status"),
		version: z.literal(1),
	}),
	z.strictObject({
		eventKey: z.literal("prepared"),
		slots: z.array(websiteGenerationSlotSchema),
		snapshot: websiteSnapshotSchema,
		type: z.literal("prepared"),
		version: z.literal(1),
	}),
	z.strictObject({
		content: localizedSectionContentSchema,
		eventKey: z.string().startsWith("section:"),
		section: siteSectionSchema,
		slotKey: z.string().min(1),
		target: sectionTargetSchema,
		type: z.literal("section"),
		version: z.literal(1),
	}),
	z.strictObject({
		asset: resolvedAssetSchema,
		assetId: z.uuid(),
		eventKey: z.string().startsWith("asset:"),
		outcome: z.enum(["placeholder", "provider"]),
		slotKey: z.string().min(1),
		type: z.literal("asset-settled"),
		version: z.literal(1),
	}),
	z.strictObject({
		eventKey: z.string().startsWith("section-skipped:"),
		sectionId: z.uuid(),
		slotKey: z.string().min(1),
		type: z.literal("section-skipped"),
		version: z.literal(1),
	}),
	z.strictObject({
		eventKey: z.literal("completed"),
		snapshot: websiteSnapshotSchema,
		type: z.literal("completed"),
		version: z.literal(1),
	}),
	z.strictObject({
		code: z.enum([
			"WORKFLOW_FAILED",
			"GENERATION_FAILED",
			"SECTION_ADDITION_FAILED",
			"LAYOUT_GENERATION_FAILED",
			"TRANSLATION_FAILED",
		]),
		eventKey: z.literal("failed"),
		type: z.literal("failed"),
		version: z.literal(1),
	}),
	z.strictObject({
		eventKey: z.literal("cancelled"),
		type: z.literal("cancelled"),
		version: z.literal(1),
	}),
]);

export const websiteGenerationEnvelopeSchema = z.strictObject({
	cursor: z.string().regex(/^\d+$/u),
	event: websiteGenerationEventSchema,
});

const websiteWorkflowStateSchema = z.union([
	z.strictObject({
		kind: z.literal("translation"),
		locale: iso6391LanguageCodeSchema,
		runId: z.string().min(1),
		state: z.enum(["active", "failed"]),
	}),
	z.strictObject({
		kind: z.enum(["generation", "section-addition", "layout-generation"]),
		runId: z.string().min(1),
		state: z.enum(["active", "failed"]),
	}),
	z.strictObject({
		kind: z.literal("unknown"),
		runId: z.string().min(1),
		state: z.literal("blocked"),
	}),
]);

const websitePublicationStateSchema = z.strictObject({
	hasUnpublishedChanges: z.boolean(),
	publishedAt: z.string().nullable(),
});

export const websiteStateSchema = z.strictObject({
	brief: websiteBriefSchema,
	createdAt: z.string(),
	id: z.uuid(),
	locale: iso6391LanguageCodeSchema,
	publication: websitePublicationStateSchema,
	snapshot: websiteSnapshotSchema.nullable(),
	updatedAt: z.string(),
	workflow: websiteWorkflowStateSchema.nullable(),
});

export type WebsiteBriefV1 = z.infer<typeof websiteBriefSchema>;

export type WebsiteAssetBindings = z.infer<typeof websiteAssetBindingsSchema>;

export type WebsiteSnapshotV1 = z.infer<typeof websiteSnapshotSchema>;

export type WebsiteGenerationSlotV1 = z.infer<typeof websiteGenerationSlotSchema>;

export type WebsiteSectionAdditionInputV1 = z.infer<typeof websiteSectionAdditionInputSchema>;

export type WebsiteLayoutGenerationTargetV1 = z.infer<typeof websiteLayoutGenerationTargetSchema>;

export type WebsiteLayoutGenerationInputV1 = z.infer<typeof websiteLayoutGenerationInputSchema>;

export type WebsiteTemplateChangeInputV1 = z.infer<typeof websiteTemplateChangeInputSchema>;

export type PersistedWebsiteStructureV1 = z.infer<typeof persistedWebsiteStructureSchema>;

export type PersistedWebsiteContentV1 = z.infer<typeof persistedWebsiteContentSchema>;

export type PersistedWebsiteSiteV1 = z.infer<typeof persistedWebsiteSiteSchema>;

export type WebsiteGenerationEventV1 = z.infer<typeof websiteGenerationEventSchema>;

export type WebsiteGenerationEnvelopeV1 = z.infer<typeof websiteGenerationEnvelopeSchema>;

export type WebsiteStateV1 = z.infer<typeof websiteStateSchema>;
