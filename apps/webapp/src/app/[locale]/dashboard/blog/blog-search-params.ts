import { parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

export const blogStatuses = ["all", "draft", "published", "writing", "failed"] as const;

export const blogSearchParams = {
	page: parseAsInteger.withDefault(1),
	q: parseAsString.withDefault(""),
	status: parseAsStringLiteral(blogStatuses).withDefault("all"),
	topic: parseAsString.withDefault(""),
};
