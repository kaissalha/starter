/// <reference types="vite/client" />

import { useMemo } from "react";

import { z } from "zod";

import type { BrandFoundationV1 } from "@starter/infinite-brand";

import type { SiteBehaviorProgramV1 } from "../behavior/contracts";
import type { BlogPostSummary } from "../blog/blog-contracts";
import {
	jsonObjectSchema,
	linkValueSchema,
	localizedContentSchema,
	type JsonObject,
	type JsonValue,
} from "../document/content-schema";
import type { SiteDocument } from "../document/site-document-schema";
import type { Iso6391LanguageCode } from "../language-codes";
import type { AssetMap } from "../rendering/render-node";
import { SiteRenderer } from "../rendering/site-renderer";
import { instantiateSection, type SectionDefinition } from "../sections/section-definition";
import type { TemplateContent } from "../templates/template-definition";
import { fixtureAssetMaps } from "./fixtures/fixture-assets";
import { getTemplateBrand } from "./fixtures/template-brands";
import { createStoryEntityId } from "./story-entity-id";

const assetModules = import.meta.glob<Record<string, AssetMap>>("../templates/*/assets.ts", { eager: true });

const fallbackStoryBrand = getTemplateBrand({ templateId: "strategic-insight" });

const absolutePositionSchema = z.compile(z.object({ base: z.literal("absolute") }));

const stringSchema = z.compile(z.string());

const storyAnchorSectionDefinition: SectionDefinition = {
	category: "content",
	pattern: "story-anchor",
	root: {
		layout: { visibility: "removed" },
		props: { children: [] },
		type: "box",
	},
};

const templateContentModules = import.meta.glob<TemplateContent>("../templates/*/content.json", {
	eager: true,
	import: "default",
});

const fixtureAssets = new Map<string, AssetMap>();

const fixtureBrands = new Map<string, BrandFoundationV1>();

const templateAssets: Array<AssetMap> = [];

Object.entries(templateContentModules).forEach(([path, content]) => {
	const templateId = path.match(/templates\/(.+?)\/content\.json$/u)?.[1];
	const assets = Object.values(assetModules[path.replace("/content.json", "/assets.ts")] ?? {})[0];

	if (!assets || !templateId) {
		return;
	}

	const brand = getTemplateBrand({ templateId });
	templateAssets.push(assets);

	Object.values(content).forEach((localeContent) => {
		if (!localeContent) {
			return;
		}

		[
			...Object.values(localeContent.layout.header),
			...Object.values(localeContent.pages).flatMap((page) => Object.values(page.sections)),
			...Object.values(localeContent.layout.footer),
		].forEach((sectionContent) => {
			const fixtureKey = JSON.stringify(sectionContent);
			fixtureAssets.set(fixtureKey, assets);
			fixtureBrands.set(fixtureKey, brand);
		});
	});
});

const collectAssetIds = ({ value }: { value: JsonValue | undefined }): Array<string> => {
	if (Array.isArray(value)) {
		return value.flatMap((item) => collectAssetIds({ value: item }));
	}

	const parsed = jsonObjectSchema.safeParse(value);

	if (!parsed.success) {
		return [];
	}

	return Object.entries(parsed.data).flatMap(([key, item]) => {
		const assetId = stringSchema.safeParse(item);

		if (key === "assetId" && assetId.success) {
			return [assetId.data];
		}

		return collectAssetIds({ value: item });
	});
};

const collectLinkedAnchors = ({ value }: { value: JsonValue | undefined }): Array<string> => {
	if (Array.isArray(value)) {
		return value.flatMap((item) => collectLinkedAnchors({ value: item }));
	}

	const parsed = jsonObjectSchema.safeParse(value);

	if (!parsed.success) {
		return [];
	}

	const link = linkValueSchema.safeParse(parsed.data);

	if (link.success && link.data.kind === "anchor") {
		return [link.data.anchor];
	}

	return Object.values(parsed.data).flatMap((item) => collectLinkedAnchors({ value: item }));
};

const resolveFixtureAssets = ({ fixture }: { fixture: JsonObject }) => {
	const exactAssets = fixtureAssets.get(JSON.stringify(fixture));

	if (exactAssets) {
		return exactAssets;
	}

	const assetIds = collectAssetIds({ value: fixture });

	if (assetIds.length === 0) {
		return undefined;
	}

	return [...fixtureAssetMaps, ...templateAssets].find((assets) => assetIds.every((assetId) => assets[assetId]));
};

const resolveFixtureBrand = ({ fixture }: { fixture: JsonObject }) => {
	return fixtureBrands.get(JSON.stringify(fixture)) ?? fallbackStoryBrand;
};

export const SectionStoryPreview = ({
	behavior,
	blogPosts,
	definition,
	fixtures,
	locale = "en",
	settings,
}: {
	behavior?: SiteBehaviorProgramV1;
	blogPosts?: Array<BlogPostSummary>;
	definition: SectionDefinition;
	fixtures: { ar: JsonObject; en: JsonObject };
	locale?: Iso6391LanguageCode;
	settings?: JsonValue;
}) => {
	const instance = useMemo(() => {
		const created = instantiateSection({
			anchor: definition.pattern,
			content: fixtures,
			createId: createStoryEntityId({ scope: definition.pattern }),
			defaultLocale: "en",
			definition,
			path: "/section",
			settings,
		});

		return created;
	}, [definition, fixtures, settings]);

	const anchorInstances = useMemo(
		() =>
			Array.from(new Set(collectLinkedAnchors({ value: fixtures }))).flatMap((anchor) =>
				anchor === definition.pattern
					? []
					: [
							instantiateSection({
								anchor,
								content: { ar: {}, en: {} },
								createId: createStoryEntityId({ scope: `${definition.pattern}-${anchor}` }),
								defaultLocale: "en",
								definition: storyAnchorSectionDefinition,
								path: `/anchors/${anchor}`,
							}),
						]
			),
		[definition.pattern, fixtures]
	);

	const pageId = createStoryEntityId({ scope: definition.pattern })({ kind: "page", path: "/page" });

	const document: SiteDocument = {
		content: localizedContentSchema.parse({
			ar: {
				pages: { [pageId]: { route: { slug: "preview" }, seo: { title: "معاينة" } } },
				sections: {
					...Object.fromEntries(
						anchorInstances.map((anchorInstance) => [
							anchorInstance.section.contentId,
							anchorInstance.content.ar,
						])
					),
					[instance.section.contentId]: instance.content.ar,
				},
				site: {},
			},
			en: {
				pages: { [pageId]: { route: { slug: "preview" }, seo: { title: "Preview" } } },
				sections: {
					...Object.fromEntries(
						anchorInstances.map((anchorInstance) => [
							anchorInstance.section.contentId,
							anchorInstance.content.en,
						])
					),
					[instance.section.contentId]: instance.content.en,
				},
				site: {},
			},
		}),
		defaultLocale: "en",
		documentVersion: 1,
		locales: ["en", "ar"],
		structure: {
			layout: { footer: [], header: [] },
			pages: [
				{
					home: true,
					id: pageId,
					sections: [...anchorInstances.map((anchorInstance) => anchorInstance.section), instance.section],
				},
			],
		},
	};

	if (behavior) {
		document.logic = { [instance.section.id]: behavior };
	}

	const preview = (
		<SiteRenderer
			assets={resolveFixtureAssets({ fixture: fixtures.en })}
			blogPosts={blogPosts}
			brand={resolveFixtureBrand({ fixture: fixtures.en })}
			document={document}
			locale={locale}
			preview
		/>
	);

	const position = definition.root.layout?.position;
	const responsivePosition = absolutePositionSchema.safeParse(position);
	const isAbsolute = position === "absolute" || responsivePosition.success;

	if (definition.category !== "header" || !isAbsolute) {
		return preview;
	}

	return <div style={{ background: "#18332d", minHeight: "18rem" }}>{preview}</div>;
};
