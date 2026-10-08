import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import { brandFontCatalog } from "../src/fonts/catalog";

const require = createRequire(import.meta.url);

export const buildFontAssets = async ({ outDir }: { outDir: string }) => {
	await rm(outDir, { force: true, recursive: true });
	await Promise.all(
		Object.entries(brandFontCatalog).map(async ([fontId, font]) => {
			const staticWeights = "staticWeights" in font ? font.staticWeights : null;
			const packageName = staticWeights ? `@fontsource/${fontId}` : `@fontsource-variable/${fontId}`;
			const styles = "italic" in font && font.italic ? ["", "-italic"] : [""];
			const packageDirectory = path.dirname(require.resolve(`${packageName}/package.json`));

			const css = (
				await Promise.all(
					(staticWeights ?? ["wght"])
						.flatMap((weight) => styles.map((style) => `${weight}${style}.css`))
						.map((file) => readFile(path.join(packageDirectory, file), "utf8"))
				)
			).join("\n");

			const fontDirectory = path.join(outDir, fontId);
			await mkdir(path.join(fontDirectory, "files"), { recursive: true });
			await writeFile(path.join(fontDirectory, "font.css"), css);
			await Promise.all(
				[...new Set([...css.matchAll(/url\(\.\/files\/(.+?)\)/gu)].map((match) => match[1] ?? ""))].map(
					(file) =>
						copyFile(path.join(packageDirectory, "files", file), path.join(fontDirectory, "files", file))
				)
			);
		})
	);
};

if (import.meta.main) {
	const [, , outDir] = process.argv;

	if (!outDir) {
		throw new Error("Usage: build-font-assets.ts <outDir>");
	}

	await buildFontAssets({ outDir: path.resolve(process.cwd(), outDir) });
}
