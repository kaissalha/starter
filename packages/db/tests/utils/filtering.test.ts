import type { SQL } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

const { orMock } = vi.hoisted(() => ({ orMock: vi.fn() }));

vi.mock("drizzle-orm", async () => {
	const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");

	return { ...actual, or: orMock };
});

import { sql } from "drizzle-orm";

import { addDataTableFilters } from "../../src/utils/filtering";

describe("addDataTableFilters", () => {
	it("combines selected values within a filter and appends filters independently", () => {
		const email = sql`email is not null`;
		const phone = sql`phone is not null`;
		const missingName = sql`name is null`;
		const whereConditions: Array<SQL> = [];
		orMock.mockImplementation((...conditions: Array<SQL>) => conditions[0]);

		addDataTableFilters({
			conditions: {
				contactMethod: { email, phone },
				missing: { name: missingName },
			},
			filters: {
				contactMethod: ["phone", "email", "phone"],
				missing: ["name"],
			},
			whereConditions,
		});

		expect(orMock).toHaveBeenNthCalledWith(1, phone, email);
		expect(orMock).toHaveBeenNthCalledWith(2, missingName);
		expect(whereConditions).toEqual([phone, missingName]);
	});

	it("ignores empty, unknown filters and unknown values", () => {
		const whereConditions: Array<SQL> = [];

		addDataTableFilters({
			conditions: { contactMethod: { email: sql`email is not null` } },
			filters: { contactMethod: ["unknown"], missing: ["name"] },
			whereConditions,
		});

		expect(whereConditions).toEqual([]);
	});
});
