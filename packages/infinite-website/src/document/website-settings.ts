import { z } from "zod";

export const websiteSettingsSchema = z.object({
	googleAnalyticsId: z
		.string()
		.regex(/^(?:G-[A-Z0-9]+)?$/)
		.max(30)
		.default(""),
	integrations: z
		.array(
			z.strictObject({
				code: z.string().max(50_000),
				enabled: z.boolean(),
				id: z.string().min(1).max(100),
				name: z.string().trim().min(1).max(100),
				placement: z.enum(["head", "body-start", "body-end"]),
			})
		)
		.max(20)
		.default([]),
});

export type WebsiteSettings = z.infer<typeof websiteSettingsSchema>;

export const defaultWebsiteSettings: WebsiteSettings = websiteSettingsSchema.parse({});
