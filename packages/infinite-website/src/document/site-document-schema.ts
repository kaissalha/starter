import { z } from "zod";

import { siteBehaviorProgramSchema } from "../behavior/contracts";
import { siteDocumentResourceLimits } from "../resource-limits";
import { entityIdSchema, iso6391LanguageCodeSchema, localizedContentSchema } from "./content-schema";
import { siteStructureSchema } from "./structure-schema";
import { websiteSettingsSchema } from "./website-settings";

export const siteDocumentLogicSchema = z.record(entityIdSchema, siteBehaviorProgramSchema);

export const siteDocumentSchema = z
	.strictObject({
		blogNavigationHidden: z.boolean().optional(),
		content: localizedContentSchema,
		defaultLocale: iso6391LanguageCodeSchema,
		direction: z.enum(["ltr", "rtl"]).optional(),
		documentVersion: z.literal(1),
		locales: z.array(iso6391LanguageCodeSchema).min(1).max(siteDocumentResourceLimits.locales),
		logic: siteDocumentLogicSchema.optional(),
		settings: websiteSettingsSchema.optional(),
		structure: siteStructureSchema,
	})
	.meta({ id: "InfiniteWebsiteDocumentV1", title: "Infinite Website document v1" });

export const siteDocumentJsonSchema = {
	$id: "https://starter.dev/schemas/infinite-website/document-v1.json",
	...z.toJSONSchema(siteDocumentSchema, {
		metadata: z.globalRegistry,
		reused: "ref",
		target: "draft-2020-12",
	}),
};

export type SiteDocument = z.infer<typeof siteDocumentSchema>;
