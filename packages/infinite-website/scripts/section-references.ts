import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

import { inspectSectionReference } from "../src/behavior/inspect";
import { jsonObjectSchema } from "../src/document/content-schema";
import { coreNodeTypes, type SiteSection } from "../src/document/structure-schema";
import descriptions from "../src/reference/section-descriptions.json";
import { describeSectionReference, type SectionReferenceEntry } from "../src/reference/section-reference-contract";
import { sectionDefinitions } from "../src/section-registry";
import { instantiateSection } from "../src/sections/section-definition";
import { createStoryEntityId } from "../src/storybook/story-entity-id";

const fixtureRoot = path.resolve(import.meta.dirname, "../src/storybook/fixtures/sections");

const fixtureSchema = z.object({ ar: jsonObjectSchema, en: jsonObjectSchema });

const nodeTypeSchema = z.enum(coreNodeTypes);

const columnsSchema = z.union([
	z.number(),
	z.object({ base: z.number(), wide: z.number().optional() }).transform(({ base, wide }) => wide ?? base),
]);

const boldFills = new Set(["accent", "action", "black"]);

export const referenceExcludedCategories = new Set(["footer", "header"]);

type TraitWalk = { boldFill: boolean; columns: number; embeds: Set<string>; types: Set<string> };

const walkNodes = ({ value, walk }: { value: unknown; walk: TraitWalk }) => {
	if (Array.isArray(value)) {
		value.forEach((item) => walkNodes({ value: item, walk }));

		return;
	}

	const object = z.record(z.string(), z.unknown()).safeParse(value);

	if (!object.success) {
		return;
	}

	const type = nodeTypeSchema.safeParse(object.data.type);
	const props = z.record(z.string(), z.unknown()).safeParse(object.data.props);

	if (type.success && props.success) {
		walk.types.add(type.data);
		const columns = columnsSchema.safeParse(props.data.columns);

		if (type.data === "grid" && columns.success) {
			walk.columns = Math.max(walk.columns, columns.data);
		}

		const provider = z.string().safeParse(props.data.provider);

		if (type.data === "embed" && provider.success) {
			walk.embeds.add(provider.data);
		}

		walk.boldFill ||= boldFills.has(z.string().safeParse(props.data.fill).data ?? "");
	}

	Object.values(object.data).forEach((child) => walkNodes({ value: child, walk }));
};

const deriveTraits = ({ section }: { section: SiteSection }) => {
	const walk: TraitWalk = { boldFill: false, columns: 0, embeds: new Set(), types: new Set() };
	walkNodes({ value: section.root, walk });

	return Object.entries({
		[`grid-${walk.columns}`]: walk.columns > 1,
		accordion: walk.types.has("disclosure"),
		carousel: walk.types.has("carousel"),
		dark: walk.boldFill,
		form: walk.types.has("field") || walk.embeds.has("contact-form"),
		"has-image": walk.types.has("media"),
		map: walk.embeds.has("google-map"),
		masonry: walk.types.has("masonry"),
		tabs: walk.types.has("tabs"),
	}).flatMap(([tag, enabled]) => (enabled ? [tag] : []));
};

export const buildSectionReferences = (): Array<SectionReferenceEntry> =>
	sectionDefinitions
		.filter(({ category }) => !referenceExcludedCategories.has(category))
		.map((definition) => {
			const fixtures = fixtureSchema.parse(
				JSON.parse(
					readFileSync(path.join(fixtureRoot, definition.category, `${definition.pattern}.json`), "utf8")
				)
			);

			const { section } = instantiateSection({
				anchor: definition.pattern,
				content: fixtures,
				createId: createStoryEntityId({ scope: definition.pattern }),
				defaultLocale: "en",
				definition,
				path: "/section",
			});

			const entry = {
				category: definition.category,
				description: z.record(z.string(), z.string()).parse(descriptions)[definition.pattern] ?? "",
				pattern: definition.pattern,
				reference: inspectSectionReference({ section }),
				tags: deriveTraits({ section }),
			};

			return { ...entry, descriptor: describeSectionReference(entry) };
		});
