import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { brandFontCatalog } from "../../src/fonts/catalog";

const metadataSchema = z.object({
	family: z.string(),
	id: z.string(),
	license: z.object({ type: z.string() }),
	styles: z.array(z.string()),
	subsets: z.array(z.string()),
	variable: z.union([
		z.literal(false),
		z.record(z.string(), z.object({ default: z.string(), max: z.string(), min: z.string() })),
	]),
	weights: z.array(z.number()),
});

describe("Brand font catalog", () => {
	it("keeps a versioned unique-family allowlist", () => {
		expect(new Set(Object.values(brandFontCatalog).map(({ family }) => family)).size).toBe(
			Object.keys(brandFontCatalog).length
		);
	});

	const fonts = Object.entries(brandFontCatalog).map(([fontId, font]) => {
		const staticWeights = "staticWeights" in font ? font.staticWeights : null;
		const packageName = staticWeights ? `@fontsource/${fontId}` : `@fontsource-variable/${fontId}`;
		const packageDirectory = path.dirname(require.resolve(`${packageName}/package.json`));

		const metadata = metadataSchema.parse(
			JSON.parse(fs.readFileSync(path.join(packageDirectory, "metadata.json"), "utf8"))
		);

		return { font, fontId, metadata, staticWeights };
	});

	it("matches each installed Fontsource package", () => {
		fonts.forEach(({ font, fontId, metadata, staticWeights }) => {
			expect(metadata.id).toBe(fontId);
			expect(staticWeights ? metadata.family : `${metadata.family} Variable`).toBe(font.family);
			expect(["Apache-2.0", "OFL-1.1"]).toContain(metadata.license.type);
			expect(metadata.styles).toContain("normal");
			expect(metadata.styles.includes("italic") || !("italic" in font && font.italic)).toBe(true);

			font.scripts.forEach((script) => {
				expect(metadata.subsets).toContain(script === "Arab" ? "arabic" : "latin");
			});
		});
	});

	it("declares every static weight published by static packages", () => {
		fonts
			.flatMap(({ font, metadata, staticWeights }) => (staticWeights ? [{ font, metadata, staticWeights }] : []))
			.forEach(({ font, metadata, staticWeights }) => {
				expect(metadata.variable).toBe(false);
				expect(metadata.weights).toEqual(staticWeights);
				expect([font.weight.min, font.weight.max]).toEqual([
					Math.min(...staticWeights),
					Math.max(...staticWeights),
				]);
			});
	});

	it("matches the variable axes of variable packages", () => {
		fonts
			.filter(({ staticWeights }) => staticWeights === null)
			.forEach(({ font, fontId, metadata }) => {
				const variableMetadata = metadata.variable;

				if (variableMetadata === false) {
					throw new Error(`Expected ${fontId} to provide variable font metadata`);
				}

				expect(variableMetadata.wght).toMatchObject({
					default: String(font.weight.default),
					max: String(font.weight.max),
					min: String(font.weight.min),
				});

				Object.entries(font.axes).forEach(([axis, range]) => {
					expect(variableMetadata[axis]).toMatchObject({
						default: String(range.default),
						max: String(range.max),
						min: String(range.min),
					});
				});
			});
	});
});
