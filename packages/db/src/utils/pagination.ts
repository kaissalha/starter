import { count, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import { db } from "../index.ts";

type PaginationQuery = {
	limit: (pageSize: number) => PaginationQuery;
	offset: (offset: number) => PaginationQuery;
};

export const withPagination = <T extends PaginationQuery>({
	offset,
	pageSize,
	query,
}: {
	offset: number;
	pageSize: number;
	query: T;
}) => {
	query.limit(pageSize);
	query.offset(offset);

	return query;
};

export const queryWithPagination = async <TData extends Array<unknown>>({
	cursor,
	model,
	pageSize,
	query,
	whereCondition,
}: {
	cursor: string | null;
	model: PgTable;
	pageSize: number;
	query: PaginationQuery & { execute: () => Promise<TData> };
	whereCondition: SQL | undefined;
}) => {
	const parsedOffset = cursor ? Number.parseInt(cursor, 10) : 0;
	const offset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0;
	const safePageSize = pageSize > 0 ? pageSize : 10;

	withPagination({ offset, pageSize: safePageSize, query });

	const countQuery = db.select({ count: count() }).from(model).where(whereCondition);

	const [[{ count: totalData }], data] = await Promise.all([countQuery.execute(), query.execute()]);

	const nextCursor = data.length === safePageSize ? (offset + safePageSize).toString() : undefined;

	return {
		data,
		meta: {
			cursor: nextCursor ?? null,
			totalData,
			totalPages: safePageSize > 0 ? Math.ceil(totalData / safePageSize) : 0,
		},
	};
};
