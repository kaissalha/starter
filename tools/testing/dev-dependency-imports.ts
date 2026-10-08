import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const packageManifestSchema = z.object({
	devDependencies: z.record(z.string(), z.string()).optional(),
});

export const findDevDependencyImports = ({
	excludeStories = false,
	packageDirectory,
}: {
	excludeStories?: boolean;
	packageDirectory: string;
}) => {
	const manifest = packageManifestSchema.parse(
		JSON.parse(readFileSync(path.join(packageDirectory, "package.json"), "utf8"))
	);

	const dependencies = Object.keys(manifest.devDependencies ?? {});

	return readdirSync(path.join(packageDirectory, "src"), { encoding: "utf8", recursive: true })
		.filter((file) => /\.(ts|tsx)$/u.test(file) && (!excludeStories || !file.includes(".stories.")))
		.flatMap((file) => {
			const content = readFileSync(path.join(packageDirectory, "src", file), "utf8");

			const deps = dependencies.filter((dependency) =>
				[
					`import .* from ['"]${RegExp.escape(dependency)}['"]`,
					`import ['"]${RegExp.escape(dependency)}['"]`,
					`require\\(['"]${RegExp.escape(dependency)}['"]\\)`,
				].some((pattern) => new RegExp(pattern, "u").test(content))
			);

			return deps.length === 0 ? [] : [{ deps, file: path.join("src", file) }];
		});
};
