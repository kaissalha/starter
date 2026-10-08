import { mkdir, readFile, watch, writeFile } from "node:fs/promises";
import path from "node:path";

import { compileWebsiteStyles } from "./compile-styles";

const packageRoot = path.resolve(import.meta.dirname, "..");

const inputPath = path.join(packageRoot, "styles", "input.css");

const outputPath = path.join(packageRoot, "dist", "styles.css");

const buildStyles = async () => {
	const input = await readFile(inputPath, "utf8");

	const css = await compileWebsiteStyles({
		from: inputPath,
		input,
		optimize: process.env.NODE_ENV === "production",
		to: outputPath,
	});

	await mkdir(path.dirname(outputPath), { recursive: true });
	await writeFile(outputPath, css);

	console.log(`built ${path.relative(packageRoot, outputPath)} (${(css.length / 1024).toFixed(1)} kB)`);
};

await buildStyles();

if (process.argv.includes("--watch")) {
	const watched = [path.join(packageRoot, "src"), path.join(packageRoot, "styles")];

	console.log("watching for style changes...");

	await Promise.all(
		watched.map(async (dir) => {
			for await (const event of watch(dir, { recursive: true })) {
				console.log(`rebuilding (${event.filename ?? "change"})`);
				await buildStyles();
			}
		})
	);
}
