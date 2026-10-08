import { ORPCError } from "@orpc/client";

import { jsonValueSchema } from "../../schemas/json";
import { parseJsonValue } from "../../utils/json";

export const parseJsonPayload = (
	payload: string | null | undefined,
	options?: { invalidMessage?: string; missingMessage?: string }
) => {
	if (!payload) {
		throw new ORPCError("BAD_REQUEST", {
			message: options?.missingMessage ?? "Missing payload.",
		});
	}

	const parsed = jsonValueSchema.safeParse(parseJsonValue(payload));

	if (!parsed.success) {
		throw new ORPCError("BAD_REQUEST", {
			message: options?.invalidMessage ?? "Invalid payload.",
		});
	}

	return parsed.data;
};
