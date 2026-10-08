import { sql } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

const { selectMock } = vi.hoisted(() => ({ selectMock: vi.fn() }));

vi.mock("../../src/index.ts", () => {
	return {
		db: {
			select: selectMock,
		},
	};
});

import { queryWithPagination } from "../../src/utils/pagination";

const model = pgTable("pagination_test", { id: text("id") });

const whereCondition = sql`true`;

describe("queryWithPagination", () => {
	it("returns data and pagination metadata", async () => {
		const execute = vi.fn().mockResolvedValue([{ id: "1" }, { id: "2" }]);
		const limit = vi.fn().mockReturnThis();
		const offset = vi.fn().mockReturnThis();
		const query = { execute, limit, offset };

		const countExecute = vi.fn().mockResolvedValue([{ count: 5 }]);
		const from = vi.fn().mockReturnThis();
		const where = vi.fn().mockReturnValue({ execute: countExecute });
		selectMock.mockReturnValue({ from, where });

		const result = await queryWithPagination({
			cursor: "2",
			model,
			pageSize: 2,
			query,
			whereCondition,
		});

		expect(result.data).toHaveLength(2);
		expect(result.meta).toEqual({ cursor: "4", totalData: 5, totalPages: 3 });
		expect(countExecute).toHaveBeenCalled();
	});

	it("defaults to offset 0 for invalid cursor", async () => {
		const execute = vi.fn().mockResolvedValue([{ id: "1" }]);
		const limit = vi.fn().mockReturnThis();
		const offset = vi.fn().mockReturnThis();
		const query = { execute, limit, offset };

		const countExecute = vi.fn().mockResolvedValue([{ count: 1 }]);
		const from = vi.fn().mockReturnThis();
		const where = vi.fn().mockReturnValue({ execute: countExecute });
		selectMock.mockReturnValue({ from, where });

		await queryWithPagination({
			cursor: "not-a-number",
			model,
			pageSize: 1,
			query,
			whereCondition,
		});

		expect(offset).toHaveBeenCalledWith(0);
	});

	it("uses safe page size when pageSize is 0", async () => {
		const execute = vi.fn().mockResolvedValue([{ id: "1" }]);
		const limit = vi.fn().mockReturnThis();
		const offset = vi.fn().mockReturnThis();
		const query = { execute, limit, offset };

		const countExecute = vi.fn().mockResolvedValue([{ count: 1 }]);
		const from = vi.fn().mockReturnThis();
		const where = vi.fn().mockReturnValue({ execute: countExecute });
		selectMock.mockReturnValue({ from, where });

		const result = await queryWithPagination({
			cursor: null,
			model,
			pageSize: 0,
			query,
			whereCondition,
		});

		expect(limit).toHaveBeenCalledWith(10);
		expect(result.meta.totalPages).toBe(1);
	});
});
