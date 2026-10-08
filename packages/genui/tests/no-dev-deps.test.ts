import path from "node:path";
import { describe, expect, it } from "vitest";

import { findDevDependencyImports } from "../../../tools/testing/dev-dependency-imports";

const packageDir = path.resolve(__dirname, "..");

describe("Source code dependency checks", () => {
	it("should not use devDependencies in src directory", () => {
		expect(findDevDependencyImports({ packageDirectory: packageDir })).toEqual([]);
	});
});
