import { describe, expect, it } from "vitest";

import { isUniqueViolation } from "../src";

describe("isUniqueViolation", () => {
	const wrap = (code: string) => new Error("wrapped", { cause: Object.assign(new Error("pg"), { code }) });

	it("detects a wrapped Postgres unique violation", () => {
		expect(isUniqueViolation({ error: wrap("23505") })).toBe(true);
	});

	it("ignores other codes and non-Error causes", () => {
		expect(isUniqueViolation({ error: wrap("23503") })).toBe(false);
		expect(isUniqueViolation({ error: new Error("plain") })).toBe(false);
		expect(isUniqueViolation({ error: new Error("wrapped", { cause: "23505" }) })).toBe(false);
	});
});
