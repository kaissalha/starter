import { renderToStaticMarkup } from "react-dom/server";

import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";

import type { JsonObject } from "../src/document/content-schema";
import type { AssetMap } from "../src/rendering/render-node";
import { createSiteResolutionContext } from "../src/rendering/resolve-persisted-node";
import { SiteRenderer } from "../src/rendering/site-renderer";
import { sectionDefinitions } from "../src/section-registry";
import { entityIdFromSeed } from "../src/sections/entity-id";
import { getTemplateBrand } from "../src/storybook/fixtures/template-brands";
import { SectionStoryPreview } from "../src/storybook/section-story-preview";
import {
	instantiateTemplate,
	type TemplateContent,
	type TemplateDefinition,
} from "../src/templates/template-definition";

const fixtureModules = import.meta.glob<Record<string, JsonObject>>("../src/storybook/fixtures/sections/*/*.json", {
	eager: true,
	import: "default",
});

const contentModules = import.meta.glob<TemplateContent>("../src/templates/*/content.json", {
	eager: true,
	import: "default",
});

const assetModules = import.meta.glob<Record<string, AssetMap>>("../src/templates/*/assets.ts", { eager: true });

const firstExport = <Value,>({ module, path }: { module: Record<string, Value> | undefined; path: string }) => {
	const value = module ? Object.values(module)[0] : undefined;

	if (!value) {
		throw new Error(`Missing module export for ${path}`);
	}

	return value;
};

const templates = Object.entries(
	import.meta.glob<Record<string, TemplateDefinition>>("../src/templates/*/index.ts", { eager: true })
).map(([path, module]) => {
	const content = contentModules[path.replace("/index.ts", "/content.json")];

	if (!content) {
		throw new Error(`Missing content for ${path}`);
	}

	return {
		assets: firstExport({ module: assetModules[path.replace("/index.ts", "/assets.ts")], path }),
		content,
		definition: firstExport({ module, path }),
		path,
	};
});

const markupWindow = new Window();

const locales = ["en", "ar"] as const;

const inspectMarkup = ({ html, locale }: { html: string; locale: (typeof locales)[number] }) => {
	markupWindow.document.body.innerHTML = html;
	markupWindow.document.body.querySelectorAll("script").forEach((script) => script.remove());
	const text = markupWindow.document.body.textContent;

	return {
		dir: html.includes(`dir="${locale === "ar" ? "rtl" : "ltr"}"`),
		hasContent: text.trim().length > 0 || html.includes("<iframe"),
		lang: html.includes(`lang="${locale}"`),
		leaked: /\bundefined\b|\bNaN\b|\[object Object\]/u.test(text) || html.includes("[object Object]"),
	};
};

const healthy = { dir: true, hasContent: true, lang: true, leaked: false };

describe("section render smoke", () => {
	it.each(
		sectionDefinitions.map((definition) => ({
			definition,
			fixtures:
				fixtureModules[`../src/storybook/fixtures/sections/${definition.category}/${definition.pattern}.json`],
		}))
	)("renders $definition.pattern in en and ar", ({ definition, fixtures }) => {
		if (!fixtures?.en || !fixtures.ar) {
			throw new Error(`Missing fixtures for ${definition.pattern}`);
		}

		locales.forEach((locale) => {
			const html = renderToStaticMarkup(
				<SectionStoryPreview
					definition={definition}
					fixtures={{ ar: fixtures.ar, en: fixtures.en }}
					locale={locale}
				/>
			);

			expect(inspectMarkup({ html, locale })).toEqual(healthy);
		});
	});
});

describe("template render smoke", () => {
	it.each(templates.slice(0, 1))(
		"renders $definition.id pages in en and ar",
		({ assets, content, definition, path }) => {
			const document = instantiateTemplate({
				content,
				createId: ({ kind, path: entityPath }) =>
					entityIdFromSeed({ seed: `render-smoke:${kind}:${entityPath}` }),
				definition,
				path,
			});

			const brand = getTemplateBrand({ templateId: definition.id });

			locales.forEach((locale) => {
				const context = createSiteResolutionContext({ document, locale });

				document.structure.pages.forEach((page) => {
					const slug = context.pageSlugs.get(page.id);

					if (!page.home && !slug) {
						throw new Error(`Missing ${locale} slug for ${definition.id} page ${page.id}`);
					}

					const html = renderToStaticMarkup(
						<SiteRenderer
							assets={assets}
							brand={brand}
							document={document}
							locale={locale}
							pageSlug={page.home ? undefined : slug}
						/>
					);

					expect(inspectMarkup({ html, locale })).toEqual(healthy);
				});
			});
		}
	);
});
