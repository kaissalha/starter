import { type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

export const buildSearchQuery = (input: string) => {
	const terms = input.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

	if (terms.length === 0) {
		return "";
	}

	return terms.map((term) => `${term.toLowerCase()}:*`).join(" & ");
};

export const addFullTextSearch = <T extends PgTable & { fts: AnyPgColumn }>({
	model,
	searchTerm,
	shortTermDocument,
	whereConditions,
}: {
	model: T;
	searchTerm: string | undefined;
	shortTermDocument?: SQL;
	whereConditions: Array<SQL>;
}) => {
	const searchQuery = searchTerm ? buildSearchQuery(searchTerm) : "";

	if (!searchQuery) {
		return;
	}

	if (shortTermDocument && searchTerm?.split(/[^\p{L}\p{N}]+/u).some((term) => term.length > 0 && term.length < 3)) {
		whereConditions.push(sql`to_tsvector('simple', ${shortTermDocument}) @@ to_tsquery('simple', ${searchQuery})`);

		return;
	}

	whereConditions.push(sql`${model.fts} @@ to_tsquery('english', ${searchQuery})`);
};
