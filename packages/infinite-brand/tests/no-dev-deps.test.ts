import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { findDevDependencyImports } from "../../../tools/testing/dev-dependency-imports";
import { brandFontCatalog } from "../src/fonts/catalog";

const packageDirectory = path.resolve(__dirname, "..");

const packageJsonSchema = z.object({
	dependencies: z.record(z.string(), z.string()).optional(),
	devDependencies: z.record(z.string(), z.string()).optional(),
});

const readPackageJson = () => {
	return packageJsonSchema.parse(JSON.parse(fs.readFileSync(path.join(packageDirectory, "package.json"), "utf8")));
};

describe("Brand source dependency boundaries", () => {
	it("does not use devDependencies from source", () => {
		expect(findDevDependencyImports({ packageDirectory })).toEqual([]);
	});

	it("does not depend on consumer, framework, database, or provider packages", () => {
		const packageJson = readPackageJson();
		const dependencies = Object.keys(packageJson.dependencies ?? {});

		expect(dependencies).toContain("zod");

		expect(
			dependencies.filter((dependency) =>
				["react", "next", "@starter/infinite-website", "@starter/db", "@starter/server"].includes(dependency)
			)
		).toEqual([]);
	});

	it("depends only on the Fontsource packages declared by the font catalog", () => {
		const dependencies = Object.keys(readPackageJson().dependencies ?? {});

		const catalogPackages = Object.entries(brandFontCatalog).map(([fontId, font]) =>
			"staticWeights" in font ? `@fontsource/${fontId}` : `@fontsource-variable/${fontId}`
		);

		expect(dependencies.filter((dependency) => dependency.startsWith("@fontsource")).toSorted()).toEqual(
			catalogPackages.toSorted()
		);
	});
});
