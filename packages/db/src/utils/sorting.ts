import { asc, desc, getColumns, type SQL } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

type OrderByQuery<T> = { orderBy: (...columns: Array<SQL | AnyPgColumn>) => T };

export const withOrderBy = <T extends OrderByQuery<T>, M extends PgTable>({
	joinedColumns = {},
	model,
	order,
	orderBy,
	query,
	tieBreakers = [],
}: {
	joinedColumns?: Record<string, SQL>;
	model: M;
	order: "asc" | "desc" | undefined;
	orderBy: string | undefined;
	query: T;
	tieBreakers?: Array<SQL | AnyPgColumn>;
}) => {
	if (!orderBy) {
		return query;
	}

	const direction = order === "desc" ? desc : asc;
	const column = getColumns(model)[orderBy] ?? joinedColumns[orderBy];

	if (column) {
		query.orderBy(direction(column), ...tieBreakers);
	}

	return query;
};
