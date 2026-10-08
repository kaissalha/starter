import { describe, expect, it } from "vitest";
import { z } from "zod";

import { jsonObjectSchema, type JsonValue } from "../src/document/content-schema";
import { validateSiteDocument } from "../src/document/document-validation";
import type { SiteDocument } from "../src/document/site-document-schema";
import { entityIdFromSeed } from "../src/sections/entity-id";
import type { CreateEntityId } from "../src/sections/section-definition";
import {
	instantiateTemplate,
	type TemplateContent,
	type TemplateDefinition,
} from "../src/templates/template-definition";

const templateModules = import.meta.glob<Record<string, TemplateDefinition>>("../src/templates/*/index.ts", {
	eager: true,
});

const contentModules = import.meta.glob<TemplateContent>("../src/templates/*/content.json", {
	eager: true,
	import: "default",
});

const createId: CreateEntityId = ({ kind, path }) => entityIdFromSeed({ seed: `template-parity:${kind}:${path}` });

const templates = Object.entries(templateModules).map(([path, module]) => ({
	content: contentModules[path.replace("/index.ts", "/content.json")]!,
	definition: Object.values(module)[0]!,
	path,
}));

const instantiate = ({
	content,
	definition,
	path,
}: {
	content: TemplateContent;
	definition: TemplateDefinition;
	path: string;
}) => {
	try {
		return instantiateTemplate({ content, createId, definition, path });
	} catch (error) {
		throw new Error(`Failed to instantiate ${path}`, { cause: error });
	}
};

const collectPersistedIds = ({ document }: { document: SiteDocument }) => {
	const nodeIds: Array<string> = [];

	const visit = (value: JsonValue | undefined) => {
		if (Array.isArray(value)) {
			value.forEach(visit);

			return;
		}

		const parsed = jsonObjectSchema.safeParse(value);

		if (!parsed.success) {
			return;
		}

		Object.entries(parsed.data).forEach(([key, child]) => {
			const id = z.string().safeParse(child);

			if (key === "id" && id.success) {
				nodeIds.push(id.data);
			}

			visit(child);
		});
	};

	visit(document.structure);

	return [
		...nodeIds,
		...document.structure.pages.flatMap((page) => page.sections.map((section) => section.contentId)),
	];
};

describe("v1 template composition", () => {
	it("pairs every shipped template with its content", () => {
		expect(templates).toHaveLength(Object.keys(contentModules).length);
	});

	it.each(templates)("keeps $path on the complete v1 contract", ({ content, definition, path }) => {
		const document = instantiate({ content, definition, path });
		expect(validateSiteDocument(document)).toMatchObject({ success: true });

		collectPersistedIds({ document }).forEach((id) =>
			expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u)
		);

		expect(document.content.en).toBeDefined();
		expect(document.content.ar).toBeDefined();

		document.structure.pages.forEach((page) => {
			page.sections.forEach((section) => {
				expect(document.content.en?.sections[section.contentId]).toBeDefined();
				expect(JSON.stringify(section.root)).not.toMatch(/"content"\s*:\s*"/u);
			});
		});
	});

	it("generates independent identities when the same template is reused", () => {
		const template = templates[0];

		if (!template) {
			throw new Error("Expected at least one template");
		}

		const firstIds = new Set(
			collectPersistedIds({
				document: instantiate({
					content: template.content,
					definition: template.definition,
					path: "/sites/first",
				}),
			})
		);

		const secondIds = collectPersistedIds({
			document: instantiate({
				content: template.content,
				definition: template.definition,
				path: "/sites/second",
			}),
		});

		expect(secondIds.filter((id) => firstIds.has(id))).toEqual([]);
	});
});
