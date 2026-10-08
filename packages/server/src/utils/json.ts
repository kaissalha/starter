import { jsonRecordSchema, jsonValueSchema, type JsonRecord, type JsonValue } from "../schemas/json";

export const parseJsonValue = (payload: string): JsonValue | undefined => {
	try {
		const parsed = jsonValueSchema.safeParse(JSON.parse(payload));

		return parsed.success ? parsed.data : undefined;
	} catch {
		return undefined;
	}
};

export const parseJsonRecord = (payload: string | null | undefined): JsonRecord => {
	if (!payload) {
		return {};
	}

	const parsed = jsonRecordSchema.safeParse(parseJsonValue(payload));

	return parsed.success ? parsed.data : {};
};
