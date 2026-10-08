import { describe, expect, it } from "vitest";
import { z } from "zod";

import { isJsonObject, jsonObjectSchema, mergeContentValue, type JsonObject } from "../src/document/content-schema";
import {
	createSectionContentSchema,
	createSectionTextContentSchema,
	listSectionContentPointers,
} from "../src/document/section-content-contract";
import { sectionDefinitions } from "../src/section-registry";
import { entityIdFromSeed } from "../src/sections/entity-id";
import { instantiateSection } from "../src/sections/section-definition";

const fixtureModules = import.meta.glob<Record<string, JsonObject>>("../src/storybook/fixtures/sections/*/*.json", {
	eager: true,
	import: "default",
});

const sections = sectionDefinitions.map((definition) => ({
	definition,
	fixtures: fixtureModules[`../src/storybook/fixtures/sections/${definition.category}/${definition.pattern}.json`],
	path: `${definition.category}/${definition.pattern}`,
}));

describe("section content contracts", () => {
	it("derives a strict content schema for every canonical pattern", () => {
		expect(sections).toHaveLength(Object.keys(fixtureModules).length);

		sections.forEach(({ definition, fixtures, path }) => {
			if (!fixtures?.en) {
				throw new Error(`Missing English fixtures for ${path}`);
			}

			const schema = createSectionContentSchema({ definition });

			Object.entries(fixtures).forEach(([locale, content]) => {
				const result = schema.safeParse(mergeContentValue({ fallback: fixtures.en, localized: content }));
				expect(result, `${definition.pattern}:${locale}`).toMatchObject({ success: true });
			});
		});
	});

	it("accepts only the declared repeatable collection range", () => {
		const section = sections.find(({ definition }) => definition.pattern === "metrics-big-numbers");

		if (!section?.fixtures?.en) {
			throw new Error("Missing metrics-big-numbers fixtures");
		}

		const schema = createSectionContentSchema({ definition: section.definition });
		const source = section.fixtures.en.items;

		if (!Array.isArray(source)) {
			throw new Error("Expected repeatable metrics-big-numbers content");
		}

		const items = [...source, ...source].slice(0, 6);

		expect(schema.safeParse({ ...section.fixtures.en, items }).success).toBe(true);
		expect(schema.safeParse({ ...section.fixtures.en, items: items.slice(0, 2) }).success).toBe(true);
		expect(schema.safeParse({ ...section.fixtures.en, items: items.slice(0, 1) }).success).toBe(false);
		expect(schema.safeParse({ ...section.fixtures.en, items: [...items, items[0]] }).success).toBe(false);

		const instance = instantiateSection({
			anchor: "metrics",
			content: { en: { ...section.fixtures.en, items } },
			createId: ({ kind, path }) => entityIdFromSeed({ seed: `repeat:${kind}:${path}` }),
			defaultLocale: "en",
			definition: section.definition,
			path: "/metrics",
		});

		expect([
			...JSON.stringify(instance.section.root).matchAll(/\/items\/items\/[0-9a-f-]+\/metric/gu),
		]).toHaveLength(6);

		expect(() =>
			instantiateSection({
				anchor: "metrics",
				content: { ar: section.fixtures.en, en: { ...section.fixtures.en, items } },
				createId: ({ kind, path }) => entityIdFromSeed({ seed: `repeat-overlay:${kind}:${path}` }),
				defaultLocale: "en",
				definition: section.definition,
				path: "/metrics",
			})
		).toThrow(/must keep 6 items/u);
	});
});

describe("nested ordered collections", () => {
	const pricing = sections.find(({ definition }) => definition.pattern === "pricing-table");

	if (!pricing?.fixtures?.en || !pricing.fixtures.ar) {
		throw new Error("Missing pricing-table fixtures");
	}

	const { definition, fixtures } = pricing;
	const english = fixtures.en;

	const withFeatures = ({ content, counts }: { content: JsonObject; counts: Array<number> }): JsonObject => {
		const plans = Array.isArray(content.items) ? content.items : [];

		return {
			...content,
			items: plans.map((plan, index) =>
				isJsonObject(plan)
					? {
							...plan,
							features: Array.from({ length: counts[index] ?? 0 }, (_, feature) => ({
								title: `Feature ${index}.${feature}`,
							})),
						}
					: plan
			),
		};
	};

	const instantiate = (content: Parameters<typeof instantiateSection>[0]["content"]) =>
		instantiateSection({
			anchor: "pricing",
			content,
			createId: ({ kind, path }) => entityIdFromSeed({ seed: `nested:${kind}:${path}` }),
			defaultLocale: "en",
			definition,
			path: "/pricing",
		});

	it("accepts a different feature count in every plan within the nested bounds", () => {
		const schema = createSectionContentSchema({ definition });

		expect(schema.safeParse(withFeatures({ content: english, counts: [1, 5, 8, 2] })).success).toBe(true);
		expect(schema.safeParse(withFeatures({ content: english, counts: [3, 0, 3, 3] })).success).toBe(false);
		expect(schema.safeParse(withFeatures({ content: english, counts: [3, 9, 3, 3] })).success).toBe(false);
		expect(() => z.toJSONSchema(schema, { target: "draft-2020-12" })).not.toThrow();
	});

	it("instantiates ordered identity at every level and rewrites nested pointers", () => {
		const content = withFeatures({ content: english, counts: [2, 4, 1, 3] });
		const instance = instantiate({ en: content });
		const defaultContent = instance.content.en;
		const plans = jsonObjectSchema.parse(jsonObjectSchema.parse(defaultContent).items);
		const planOrder = z.array(z.uuid()).parse(plans.order);
		const planItems = jsonObjectSchema.parse(plans.items);

		expect(planOrder).toHaveLength(4);

		const featureOrders = planOrder.map((planId) => {
			const features = jsonObjectSchema.parse(jsonObjectSchema.parse(planItems[planId]).features);
			const order = z.array(z.uuid()).parse(features.order);

			expect(Object.keys(jsonObjectSchema.parse(features.items)).toSorted()).toEqual(order.toSorted());

			return order;
		});

		expect(featureOrders.map((order) => order.length)).toEqual([2, 4, 1, 3]);

		const markup = JSON.stringify(instance.section.root);
		const [planId, , , lastPlanId] = planOrder;
		const [firstFeatureId, secondFeatureId] = featureOrders[0] ?? [];
		const lastFeatureIds = featureOrders[3] ?? [];

		expect(markup).toContain(`/items/items/${planId}/features/items/${firstFeatureId}/title`);
		expect(markup).toContain(`/items/items/${planId}/features/items/${secondFeatureId}/title`);
		expect(markup).toContain(`/items/items/${lastPlanId}/features/items/${lastFeatureIds[2]}/title`);
		expect(markup).not.toMatch(/features\/items\/\d+\/title/u);
		expect(JSON.stringify(instantiate({ en: content }))).toBe(JSON.stringify(instance));
	});

	it("keeps nested item counts across localized overlays", () => {
		const counts = [2, 4, 1, 3];
		const content = withFeatures({ content: english, counts });
		const arabic = withFeatures({ content: fixtures.ar ?? english, counts });

		const instance = instantiate({ ar: arabic, en: content });
		const overlay = jsonObjectSchema.parse(jsonObjectSchema.parse(instance.content.ar).items);

		expect(overlay.order).toBeUndefined();

		expect(() => instantiate({ ar: withFeatures({ content: arabic, counts: [2, 3, 1, 3] }), en: content })).toThrow(
			/must keep 4 items at "\/items\/1\/features"/u
		);
	});

	it("sizes generated text and links per concrete nested collection", () => {
		const collectionItemCounts = new Map([
			["/items", 2],
			["/items/0/features", 1],
			["/items/1/features", 3],
		]);

		const pointers = listSectionContentPointers({ collectionItemCounts, definition, kind: "text" });

		expect(pointers.filter((pointer) => pointer.includes("/features/"))).toEqual([
			"/items/0/features/0/title",
			"/items/1/features/0/title",
			"/items/1/features/1/title",
			"/items/1/features/2/title",
		]);

		const schema = createSectionTextContentSchema({ collectionItemCounts, definition });

		const text = {
			copy: { description: "d", heading: "h", kicker: "k" },
			items: [
				{
					"badge-label": "b",
					description: "d",
					features: [{ title: "a" }],
					label: "l",
					price: "p",
					title: "t",
				},
				{
					"badge-label": "b",
					description: "d",
					features: [{ title: "a" }, { title: "b" }, { title: "c" }],
					label: "l",
					price: "p",
					title: "t",
				},
			],
		};

		expect(schema.safeParse(text).success).toBe(true);

		expect(
			schema.safeParse({ ...text, items: [text.items[0], { ...text.items[1], features: [{ title: "a" }] }] })
				.success
		).toBe(false);
	});
});
