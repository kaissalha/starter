import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { buildFontAssets } from "../../scripts/build-font-assets";
import { brandFontCatalog } from "../../src/fonts/catalog";

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "brand-fonts-"));

afterAll(() => {
	fs.rmSync(outDir, { force: true, recursive: true });
});

describe("Brand font assets", () => {
	it("publishes one explicit stylesheet importing every catalog font", () => {
		const stylesheetPath = path.resolve(__dirname, "../../src/fonts/fonts.css");
		const stylesheet = fs.readFileSync(stylesheetPath, "utf8");

		Object.entries(brandFontCatalog).forEach(([fontId, font]) => {
			const staticWeights = "staticWeights" in font ? font.staticWeights : null;
			const packageName = staticWeights ? `@fontsource/${fontId}` : `@fontsource-variable/${fontId}`;
			const styles = "italic" in font && font.italic ? ["", "-italic"] : [""];

			const cssFiles = (staticWeights ?? ["wght"]).flatMap((weight) =>
				styles.map((style) => `${weight}${style}.css`)
			);

			cssFiles.forEach((cssFile) => {
				expect(stylesheet).toContain(`@import "${packageName}/${cssFile}"`);
			});
		});
	});

	it("builds one self-contained stylesheet per catalog font with a Latin preload file", async () => {
		await buildFontAssets({ outDir });

		Object.entries(brandFontCatalog).forEach(([fontId, font]) => {
			const fontDirectory = path.join(outDir, fontId);
			const css = fs.readFileSync(path.join(fontDirectory, "font.css"), "utf8");
			expect(css).toContain(`font-family: '${font.family}'`);
			expect(css).not.toContain("@import");
			[...css.matchAll(/url\(\.\/(files\/.+?)\)/gu)].forEach((match) => {
				expect(fs.existsSync(path.join(fontDirectory, match[1] ?? ""))).toBe(true);
			});
			const weight = "staticWeights" in font ? 400 : "wght";
			expect(fs.existsSync(path.join(fontDirectory, "files", `${fontId}-latin-${weight}-normal.woff2`))).toBe(
				true
			);
		});
	}, 60_000);
});
