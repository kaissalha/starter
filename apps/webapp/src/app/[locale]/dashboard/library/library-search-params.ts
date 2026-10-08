import { parseAsString, parseAsStringLiteral } from "nuqs/server";

export const libraryKinds = ["all", "image", "video", "document"] as const;

export const librarySorts = ["newest", "oldest", "name", "largest"] as const;

export const librarySources = ["all", "uploaded", "generated"] as const;

export const libraryVersionModes = ["latest", "all"] as const;

export const librarySearchParams = {
	kind: parseAsStringLiteral(libraryKinds).withDefault("all"),
	q: parseAsString.withDefault(""),
	sort: parseAsStringLiteral(librarySorts).withDefault("newest"),
	source: parseAsStringLiteral(librarySources).withDefault("all"),
	versions: parseAsStringLiteral(libraryVersionModes).withDefault("latest"),
};
