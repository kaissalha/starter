/**
 * @vitest-environment node
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("getDirection", () => {
	it("never pairs the rtl mirror with a 180 degree rotation", () => {
		const root = path.resolve(import.meta.dirname, "../../src");

		const offenders = readdirSync(root, { encoding: "utf8", recursive: true })
			.filter((file) => file.endsWith(".tsx"))
			.filter((file) =>
				(readFileSync(path.join(root, file), "utf8").match(/['"`][^'"`]*['"`]/g) ?? []).some(
					(value) => value.includes("scale-110") && value.includes("rtl:rotate-180")
				)
			);

		expect(offenders).toEqual([]);
	});
});
