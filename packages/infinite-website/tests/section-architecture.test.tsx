import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { jsonObjectSchema, type JsonValue } from "../src/document/content-schema";
import type { SiteNodeDefinition } from "../src/document/structure-schema";
import { sectionDefinitions } from "../src/section-registry";
import { isSiteNodeDefinition, mapSiteNodeDefinition } from "../src/sections/section-definition";

const sectionsDirectory = new URL("../src/sections", import.meta.url);

const storyFixturesDirectory = new URL("../src/storybook/fixtures/sections", import.meta.url);

const collectBodyHeadingPaths = ({ path, value }: { path: string; value: JsonValue | undefined }): Array<string> => {
	if (Array.isArray(value)) {
		return value.flatMap((item, index) => collectBodyHeadingPaths({ path: `${path}/${index}`, value: item }));
	}

	const parsed = jsonObjectSchema.safeParse(value);

	if (!parsed.success) {
		return [];
	}

	const props = jsonObjectSchema.safeParse(parsed.data.props);
	const element = z.string().safeParse(props.success ? props.data.element : undefined);
	const font = z.string().safeParse(props.success ? props.data.font : undefined);

	const current =
		parsed.data.type === "text" &&
		element.success &&
		/^h[1-4]$/u.test(element.data) &&
		font.success &&
		font.data === "body";

	return [
		...(current ? [path] : []),
		...Object.entries(parsed.data).flatMap(([key, item]) =>
			collectBodyHeadingPaths({ path: `${path}/${key}`, value: item })
		),
	];
};

const generationSectionCategories = new Set(["call-to-action", "content", "faq", "features", "gallery", "hero"]);

const includesNodeType = ({ node, type }: { node: SiteNodeDefinition; type: SiteNodeDefinition["type"] }): boolean =>
	node.type === type ||
	(Array.isArray(node.props.children) &&
		node.props.children.some((child) => isSiteNodeDefinition(child) && includesNodeType({ node: child, type })));

const listUnstretchedFullWidthContainers = ({ category, pattern, root }: (typeof sectionDefinitions)[number]) => {
	const offenders: Array<string> = [];

	mapSiteNodeDefinition({
		map: ({ node }) => {
			if (
				node.type !== "flex" ||
				node.props.direction === "row" ||
				node.props.align !== "start" ||
				!Array.isArray(node.props.children)
			) {
				return;
			}

			const hasFullWidthChild = node.props.children.some((child) => {
				if (!isSiteNodeDefinition(child) || child.layout?.inlineSize !== undefined) {
					return false;
				}

				if (child.type === "grid") {
					return true;
				}

				if (child.type === "box") {
					return (
						child.props.border !== undefined ||
						(child.props.fill !== undefined && child.props.fill !== "transparent")
					);
				}

				return (
					generationSectionCategories.has(category) &&
					child.type === "flex" &&
					includesNodeType({ node: child, type: "text" }) &&
					!includesNodeType({ node: child, type: "action" }) &&
					!includesNodeType({ node: child, type: "media" })
				);
			});

			if (hasFullWidthChild) {
				offenders.push(pattern);
			}
		},
		node: root,
	});

	return offenders;
};

describe("section architecture", () => {
	it("keeps section implementations outside templates with one-way dependencies", () => {
		const templateFiles = readdirSync(new URL("../src/templates", import.meta.url), { recursive: true });
		expect(templateFiles.filter((file) => /(^|\/)sections[^/]*\.tsx?$/u.test(file))).toEqual([]);

		const sectionFiles = readdirSync(sectionsDirectory, { recursive: true }).filter(
			(file) => file.endsWith(".ts") || file.endsWith(".tsx")
		);

		expect(sectionFiles.length).toBeGreaterThan(0);

		expect(
			sectionFiles.filter((file) =>
				readFileSync(new URL(`../src/sections/${file}`, import.meta.url), "utf8").includes("/templates/")
			)
		).toEqual([]);
	});

	it("keeps template indexes as metadata and section composition only", () => {
		const templateIndexes = readdirSync(new URL("../src/templates", import.meta.url), { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => ({
				name: entry.name,
				source: readFileSync(new URL(`../src/templates/${entry.name}/index.ts`, import.meta.url), "utf8"),
			}));

		const forbidden = [
			/from "\.\.\/\.\.\/recipes/u,
			/from "\.\.\/\.\.\/sections\/.*\/_shared/u,
			/content\.json/u,
			/\brecipe\./u,
			/\bSiteNode\b/u,
			/\bcreate[A-Z][A-Za-z0-9]*Section\b/u,
			/\binstantiateSection\b/u,
			/\bsection\d+Definition\b/u,
			/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/u,
		];

		expect(
			templateIndexes.flatMap(({ name, source }) =>
				forbidden.flatMap((pattern) => (pattern.test(source) ? [{ name, pattern: pattern.source }] : []))
			)
		).toEqual([]);

		templateIndexes.forEach(({ source }) => expect(source).toContain("defineTemplate({"));
	});

	it("keeps example content beside Storybook instead of section definitions", () => {
		const sectionJson = readdirSync(sectionsDirectory, { recursive: true }).filter((file) =>
			file.endsWith(".json")
		);

		const fixtureJson = readdirSync(storyFixturesDirectory, { recursive: true })
			.filter((file) => file.endsWith(".json"))
			.toSorted();

		const expectedFixtures = sectionDefinitions
			.map(({ category, pattern }) => `${category}/${pattern}.json`)
			.toSorted();

		expect(sectionJson).toEqual([]);
		expect(fixtureJson).toEqual(expectedFixtures);
	});

	it("keeps section definitions structural and free of catalogs, content, and editor metadata", () => {
		const offenders = readdirSync(sectionsDirectory, { recursive: true })
			.filter((file) => file.endsWith(".ts") && file !== "section-definition.ts")
			.filter((file) =>
				/catalogData|defineSectionPreset|SectionPreset|createSectionContentSchema|SectionContentField|contentSchema\s*:|messageKey\s*:|control\s*:/u.test(
					readFileSync(new URL(`../src/sections/${file}`, import.meta.url), "utf8")
				)
			);

		expect(offenders).toEqual([]);
	});

	it("routes semantic section headings through Brand heading typography", () => {
		const offenders = sectionDefinitions.flatMap((definition) => [
			...collectBodyHeadingPaths({ path: `${definition.pattern}/root`, value: definition.root }),
			...(definition.repeaters ?? []).flatMap((repeater, repeaterIndex) =>
				repeater.createValues({ index: 0 }).flatMap((node, nodeIndex) =>
					collectBodyHeadingPaths({
						path: `${definition.pattern}/repeaters/${repeaterIndex}/${nodeIndex}`,
						value: node,
					})
				)
			),
		]);

		expect(offenders).toEqual([]);
	});

	it("stretches full-width section containers while their copy is pending", () => {
		expect(sectionDefinitions.flatMap(listUnstretchedFullWidthContainers)).toEqual([]);
	});

	it("keeps reusable section definitions free of persisted identity", () => {
		const sectionSources = readdirSync(sectionsDirectory, { recursive: true })
			.filter((file) => file.endsWith(".ts") && file !== "entity-id.ts" && file !== "section-definition.ts")
			.map((file) => ({
				file,
				source: readFileSync(new URL(`../src/sections/${file}`, import.meta.url), "utf8"),
			}));

		expect(sectionSources.filter(({ source }) => /\bid\s*:/u.test(source)).map(({ file }) => file)).toEqual([]);

		expect(
			sectionSources
				.filter(({ source }) =>
					/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|entityIdFromSeed/u.test(
						source
					)
				)
				.map(({ file }) => file)
		).toEqual([]);
	});

	it("keeps Storybook content fixtures identity-free until instantiation", () => {
		const fixtureFiles = readdirSync(storyFixturesDirectory, { recursive: true }).filter((file) =>
			file.endsWith(".json")
		);

		const templateContentFiles = readdirSync(new URL("../src/templates", import.meta.url), { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => ({
				file: `${entry.name}/content.json`,
				url: new URL(`../src/templates/${entry.name}/content.json`, import.meta.url),
			}));

		const offenders = [
			...fixtureFiles.map((file) => ({
				file,
				url: new URL(`../src/storybook/fixtures/sections/${file}`, import.meta.url),
			})),
			...templateContentFiles,
		].filter(({ url }) =>
			/"order"\s*:\s*\[\s*"[0-9a-f]{8}-|"items"\s*:\s*\{\s*"[0-9a-f]{8}-/u.test(readFileSync(url, "utf8"))
		);

		expect(offenders).toEqual([]);
	});

	it("keeps accessible navigation labels out of visible header brand copy", () => {
		const headerFiles = readdirSync(new URL("../src/sections/header", import.meta.url)).filter((file) =>
			file.endsWith(".ts")
		);

		const offenders = headerFiles.filter((file) =>
			readFileSync(new URL(`../src/sections/header/${file}`, import.meta.url), "utf8").includes(
				'content: { $text: "/accessibility/navigationLabel" }'
			)
		);

		expect(offenders).toEqual([]);
	});

	it("uses the dedicated mobile navigation label for menu triggers", () => {
		const headerFiles = readdirSync(new URL("../src/sections/header", import.meta.url)).filter((file) =>
			file.endsWith(".ts")
		);

		const offenders = headerFiles.filter((file) =>
			/mobileLabel:\s*\{[\s\S]{0,80}\$text:\s*"\/accessibility\/navigationLabel"/u.test(
				readFileSync(new URL(`../src/sections/header/${file}`, import.meta.url), "utf8")
			)
		);

		expect(offenders).toEqual([]);
	});

	it("lets canvas mobile-menu popups own their content foreground", () => {
		const offenders = readdirSync(new URL("../src/sections/header", import.meta.url))
			.filter((file) => file.endsWith(".ts"))
			.map((file) => ({
				file,
				source: readFileSync(new URL(`../src/sections/header/${file}`, import.meta.url), "utf8"),
			}))
			.filter(({ source }) => /popupAppearance:\s*\{[\s\S]*?fill:\s*"canvas"/u.test(source))
			.filter(
				({ source }) =>
					/tone:\s*"(?:media|featured)"/u.test(source) ||
					/type:\s*"action"[\s\S]{0,400}?foreground:\s*"(?:media|featured)"/u.test(source)
			)
			.map(({ file }) => file);

		expect(offenders).toEqual([]);
	});
});
