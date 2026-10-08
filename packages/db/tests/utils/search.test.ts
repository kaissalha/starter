import { pgTable, text } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { addFullTextSearch, buildSearchQuery } from "../../src/utils/search";

const searchableModel = pgTable("searchable_test", { fts: text("fts") });

describe("buildSearchQuery", () => {
	it("normalizes and joins search terms", () => {
		expect(buildSearchQuery("Hello   World")).toBe("hello:* & world:*");
	});

	it("returns empty string for blank input", () => {
		expect(buildSearchQuery("   ")).toBe("");
	});

	it("splits terms at punctuation and tsquery syntax characters", () => {
		expect(buildSearchQuery("Hello, World!")).toBe("hello:* & world:*");
		expect(buildSearchQuery("O'Brien & co: (1.5%)")).toBe("o:* & brien:* & co:* & 1:* & 5:*");
	});

	it("returns empty string when input is only punctuation", () => {
		expect(buildSearchQuery("?! & |")).toBe("");
	});
});

describe("addFullTextSearch", () => {
	it("appends a full text search condition when term is provided", () => {
		const whereConditions: Parameters<typeof addFullTextSearch>[0]["whereConditions"] = [];
		addFullTextSearch({ model: searchableModel, searchTerm: "Test", whereConditions });

		expect(whereConditions).toHaveLength(1);
	});
});
