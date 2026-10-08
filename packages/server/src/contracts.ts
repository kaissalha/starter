import { z } from "zod";

export const contactFieldFiltersSchema = z.strictObject({
	contactMethod: z
		.array(z.enum(["email", "phone"]))
		.max(2)
		.optional(),
	missing: z
		.array(z.enum(["name", "email", "phone"]))
		.max(3)
		.optional(),
});

export const legalVersion = "2026-09-28";
