import type { SQL } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

const orderByCalls: Array<{ column: SQL; direction: "asc" | "desc" }> = [];

const { getColumnsMock } = vi.hoisted(() => ({ getColumnsMock: vi.fn() }));

vi.mock("drizzle-orm", async () => {
	const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");

	return {
		...actual,
		asc: (column: SQL) => {
			orderByCalls.push({ column, direction: "asc" });

			return `asc(${String(column)})`;
		},
		desc: (column: SQL) => {
			orderByCalls.push({ column, direction: "desc" });

			return `desc(${String(column)})`;
		},
		getColumns: getColumnsMock,
	};
});

import { sql } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";

import { withOrderBy } from "../../src/utils/sorting";

const table = pgTable("sorting_test", { name: text("name") });

describe("withOrderBy", () => {
	it("applies order to base columns", () => {
		orderByCalls.length = 0;
		const orderByMock = vi.fn();
		const query = { orderBy: orderByMock };
		const baseColumn = sql.raw("name");

		getColumnsMock.mockReturnValue({ name: baseColumn });

		const result = withOrderBy({ joinedColumns: {}, model: table, order: "desc", orderBy: "name", query });

		expect(result).toBe(query);
		expect(orderByCalls).toEqual([{ column: baseColumn, direction: "desc" }]);
		expect(orderByMock).toHaveBeenCalled();
	});

	it("applies order to joined columns", () => {
		orderByCalls.length = 0;
		const orderByMock = vi.fn();
		const query = { orderBy: orderByMock };
		const joinedColumns = { displayName: sql.raw("display_name") };

		getColumnsMock.mockReturnValue({});

		const result = withOrderBy({ joinedColumns, model: table, order: "asc", orderBy: "displayName", query });

		expect(result).toBe(query);
		expect(orderByCalls).toEqual([{ column: joinedColumns.displayName, direction: "asc" }]);
		expect(orderByMock).toHaveBeenCalled();
	});

	it("does not apply order for unknown columns", () => {
		orderByCalls.length = 0;
		const orderByMock = vi.fn();
		const query = { orderBy: orderByMock };

		getColumnsMock.mockReturnValue({});

		const result = withOrderBy({
			joinedColumns: {},
			model: table,
			order: "asc",
			orderBy: "unknown",
			query,
		});

		expect(result).toBe(query);
		expect(orderByCalls).toEqual([]);
		expect(orderByMock).not.toHaveBeenCalled();
	});
});
