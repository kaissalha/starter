import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const packageDir = path.resolve(__dirname, "..");

const workspaceDir = path.resolve(packageDir, "../..");

describe("smooth shadow integration", () => {
	it("keeps elevation on smooth shadow utilities", () => {
		const legacyShadow = /(?<!smooth-)(?<!drop-)(?<!inset-)shadow-(?:xs|sm|md|lg|xl|2xl|none|\[)/;

		const sourceFiles = ["apps/webapp/src", "packages/ui/src"].flatMap((sourceRoot) => {
			const absoluteRoot = path.join(workspaceDir, sourceRoot);

			return fs
				.readdirSync(absoluteRoot, { encoding: "utf8", recursive: true })
				.filter((file) => /\.(css|ts|tsx)$/.test(file))
				.map((file) => path.join(absoluteRoot, file));
		});

		const violations = sourceFiles.flatMap((file) => {
			return fs
				.readFileSync(file, "utf8")
				.split("\n")
				.flatMap((line, index) => {
					if (!legacyShadow.test(line) || line.includes("--shadow-")) {
						return [];
					}

					return [`${path.relative(workspaceDir, file)}:${index + 1}`];
				});
		});

		expect(violations).toEqual([]);
	});
});
