import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";

import { findDevDependencyImports } from "../../../tools/testing/dev-dependency-imports";

const directories: Array<string> = [];

afterEach(() => {
	for (const directory of directories.splice(0)) {
		rmSync(directory, { force: true, recursive: true });
	}
});

it("finds nested TypeScript imports, side effects and require calls with optional story exclusions", () => {
	const directory = mkdtempSync(path.join(tmpdir(), "starter-dependencies-"));
	directories.push(directory);
	mkdirSync(path.join(directory, "src/nested"), { recursive: true });
	writeFileSync(path.join(directory, "package.json"), JSON.stringify({ devDependencies: { "dev.tool": "1" } }));
	writeFileSync(path.join(directory, "src/nested/view.tsx"), 'import { view } from "dev.tool";');
	writeFileSync(path.join(directory, "src/effect.ts"), 'import "dev.tool";');
	writeFileSync(path.join(directory, "src/card.stories.tsx"), 'const card = require("dev.tool");');
	writeFileSync(path.join(directory, "src/allowed.ts"), 'import { view } from "dev-tool";');
	const violations = findDevDependencyImports({ packageDirectory: directory });
	expect(violations.map(({ file }) => file).sort()).toEqual([
		"src/card.stories.tsx",
		"src/effect.ts",
		"src/nested/view.tsx",
	]);
	expect(violations.every(({ deps }) => deps.length === 1 && deps[0] === "dev.tool")).toBe(true);
	expect(findDevDependencyImports({ excludeStories: true, packageDirectory: directory })).toHaveLength(2);
	writeFileSync(path.join(directory, "package.json"), "{}");
	expect(findDevDependencyImports({ packageDirectory: directory })).toEqual([]);
});
