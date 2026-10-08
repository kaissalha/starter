import { writeFile } from "node:fs/promises";
import path from "node:path";

import { buildSectionReferences } from "./section-references";

const outputPath = path.resolve(import.meta.dirname, "../src/reference/section-references.generated.json");

await writeFile(outputPath, `${JSON.stringify(buildSectionReferences())}\n`);

console.log(`wrote ${path.relative(process.cwd(), outputPath)}`);
