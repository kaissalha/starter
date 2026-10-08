import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { findDevDependencyImports } from "../../../tools/testing/dev-dependency-imports";

const packageDir = path.resolve(__dirname, "..");

describe("Source code dependency checks", () => {
	it("uses no competing carousel engine", () => {
		const packageJson = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8"));

		const dependencies = packageJson.dependencies ?? {};

		expect(Object.keys(dependencies).every((dependency) => !dependency.includes("blossom"))).toBe(true);
	});

	it("should not use devDependencies in src directory", () => {
		expect(findDevDependencyImports({ excludeStories: true, packageDirectory: packageDir })).toEqual([]);
	});
});
