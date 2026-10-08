import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

const sourceDirectory = new URL("../src", import.meta.url).pathname;

const stylesPath = new URL("../styles/input.css", import.meta.url).pathname;

const collectSourceFiles = (directory: string): Array<string> =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);

		if (entry.isDirectory()) {
			return collectSourceFiles(path);
		}

		return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
	});

const sourceFiles = [...collectSourceFiles(sourceDirectory), stylesPath];

const forbiddenPhysicalPatterns = [
	{ name: "physical inline CSS property", pattern: /\b(?:margin|padding|border|inset)-(?:left|right)\s*:/u },
	{ name: "physical inline style property", pattern: /\b(?:margin|padding|border|inset)(?:Left|Right)\b/u },
	{ name: "physical inline inset", pattern: /(?:^|[;{]\s*)(?:left|right)\s*:/mu },
	{
		name: "physical inline utility",
		pattern: /\b(?:ml|mr|pl|pr|border-l|border-r|rounded-l|rounded-r|text-left|text-right)-/u,
	},
	{ name: "physical inline inset utility", pattern: /["'`]\s*(?:left|right)-/u },
	{ name: "physical transform origin", pattern: /transform-origin:\s*(?:left|right)\b/u },
	{ name: "physical flex alignment", pattern: /["']flex-(?:start|end)["']/u },
	{ name: "physical directional icon name", pattern: /chevron-(?:left|right)/u },
] as const;

describe("RTL logical layout contract", () => {
	it.each(forbiddenPhysicalPatterns)("does not use $name", ({ pattern }) => {
		const findings = sourceFiles.flatMap((path) => {
			const source = readFileSync(path, "utf8");

			return pattern.test(source) ? [path] : [];
		});

		expect(findings).toEqual([]);
	});
});
