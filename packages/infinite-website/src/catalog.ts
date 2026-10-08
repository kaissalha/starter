import { z } from "zod";

import { createSectionContentSchema } from "./document/section-content-contract";
import { sectionDefinitions } from "./section-registry";
import { templateDefinitions } from "./template-registry";

type SectionCatalogCache = { value?: ReturnType<typeof createSectionCatalog> };

const sectionCatalog: SectionCatalogCache = {};

const createSectionCatalog = () =>
	sectionDefinitions.map((definition) => {
		const name = definition.pattern
			.split("-")
			.map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
			.join(" ");

		return {
			category: definition.category,
			contentSchema: z.toJSONSchema(createSectionContentSchema({ definition }), { target: "draft-2020-12" }),
			description: `${name} ${definition.category} section pattern.`,
			id: definition.pattern,
			name,
			settingsSchema: definition.settings
				? z.toJSONSchema(definition.settings, { target: "draft-2020-12" })
				: undefined,
		};
	});

export const getSectionCatalog = () => {
	sectionCatalog.value ??= createSectionCatalog();

	return sectionCatalog.value;
};

export { templateDefinitions };

export const templateCatalog = templateDefinitions.map((template) => ({
	defaultLocale: template.defaultLocale,
	description: template.description,
	id: template.id,
	locales: template.locales,
	name: template.name,
	pages: Object.keys(template.pages),
	sections: [
		...Object.values(template.layout.header),
		...Object.values(template.pages).flatMap((page) => Object.values(page.sections)),
		...Object.values(template.layout.footer),
	].map((section) => section.pattern),
	tags: template.tags,
}));
