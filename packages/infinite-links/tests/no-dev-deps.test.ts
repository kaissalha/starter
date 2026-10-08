import path from "node:path";
import { describe, expect, it } from "vitest";

import { findDevDependencyImports } from "../../../tools/testing/dev-dependency-imports";

const packageDirectory = path.resolve(__dirname, "..");

describe("Infinite Links source dependency boundaries", () => {
	it("does not import runtime code from devDependencies", () => {
		expect(findDevDependencyImports({ excludeStories: true, packageDirectory })).toEqual([]);
	});
});
