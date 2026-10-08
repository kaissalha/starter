import { describe, expect, it } from "vitest";

import { sectionDefinitions } from "../src/section-registry";
import type { SectionDefinition } from "../src/sections/section-definition";

type SectionStory = { args?: { definition?: SectionDefinition } };

const sectionStoryModules = import.meta.glob<Record<string, SectionStory>>("../src/storybook/sections/*.stories.tsx", {
	eager: true,
});

describe("Storybook architecture coverage", () => {
	it("publishes one matching story contract for every registered section", () => {
		const published = Object.entries(sectionStoryModules)
			.flatMap(([path, module]) =>
				Object.values(module).flatMap((story) => {
					const definition = story.args?.definition;

					return definition
						? [{ category: path.split("/").at(-1)?.replace(".stories.tsx", ""), definition }]
						: [];
				})
			)
			.toSorted((left, right) => left.definition.pattern.localeCompare(right.definition.pattern));

		const expected = sectionDefinitions.toSorted((left, right) => left.pattern.localeCompare(right.pattern));

		expect(published.map(({ definition }) => definition.pattern)).toEqual(expected.map(({ pattern }) => pattern));

		expect(
			published
				.filter(({ category, definition }) => category !== definition.category)
				.map(({ definition }) => definition.pattern)
		).toEqual([]);
	});
});
