import { describe, expect, it } from "vitest";

import type { WebsiteVersionRecord } from "@starter/db";
import {
	createWebsiteGenerationShell,
	generationPageKeys,
	selectWebsiteGenerationProfile,
	upsertGeneratedSection,
	type WebsiteGenerationPlan,
} from "@starter/infinite-website/generation";

import { createWebsiteGenerationSlots, materializeWebsiteSection } from "../../src/services/websites/generation";
import { createPersistedWebsiteSite, splitPersistedWebsiteSite } from "../../src/services/websites/persistence";
import { projectWebsiteSnapshot, readPersistedWebsiteSite } from "../../src/services/websites/persistence-read";

const websiteId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d";

const versionId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32f";

const unreferencedAssetId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32e";

const seoAssetId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d330";

const profile = selectWebsiteGenerationProfile({ businessType: "Design studio" });

const plan: WebsiteGenerationPlan = {
	kind: "plan",
	pages: generationPageKeys.map((pageKey) => ({
		description: `The ${pageKey} page.`,
		pageKey,
		title: pageKey,
	})),
	siteDescription: "A Toronto design studio.",
};

const generatedSnapshot = createWebsiteGenerationShell({
	brief: { location: "Toronto", name: "Northstar", schemaVersion: 1, type: "Design studio" },
	localizations: {
		byLocale: { en: plan },
		defaultLocale: "en",
	},
	profile,
	websiteId,
});

const generationSlot = createWebsiteGenerationSlots({
	businessName: "Northstar",
	profileKeyword: profile.keywords[0] ?? "business",
	slots: profile.pages.home.slots,
	templateId: profile.templateId,
	websiteId,
}).find(({ assetIntents }) => assetIntents.length > 0);

if (!generationSlot) {
	throw new Error("Expected the persistence fixture to have a media section");
}

const materialized = materializeWebsiteSection({
	generatedSection: generationSlot,
	localizations: {
		byLocale: {
			en: {
				fields: generationSlot.promptSlot.fields.map(({ path }) => ({
					path,
					value: "Grounded local design copy",
				})),
				plan,
			},
		},
		defaultLocale: "en",
	},
	pages: generatedSnapshot.document.structure.pages,
	templateId: profile.templateId,
	websiteId,
});

const assetId = generationSlot.assetIntents[0]?.assetId;

if (!assetId) {
	throw new Error("Expected the persistence fixture to reference an asset");
}

const snapshot = {
	...generatedSnapshot,
	document: upsertGeneratedSection({
		document: generatedSnapshot.document,
		section: {
			content: materialized.content,
			section: materialized.section,
			target: materialized.target,
		},
	}),
};

const assetBindings = {
	[assetId]: { src: "https://images.unsplash.com/photo-42", type: "image" as const },
	[unreferencedAssetId]: { src: "https://images.unsplash.com/photo-unused", type: "image" as const },
};

describe("website persistence", () => {
	it("round-trips referenced assets and prunes unreferenced bindings", () => {
		const site = createPersistedWebsiteSite({ assetBindings, snapshot });
		const columns = splitPersistedWebsiteSite({ site });
		expect(splitPersistedWebsiteSite({ documentAlreadyValidated: true, site })).toEqual(columns);

		const record: WebsiteVersionRecord = {
			id: versionId,
			version: 1,
			websiteId,
			...columns,
			createdAt: "2026-08-15T00:00:00.000Z",
			publishedAt: null,
			updatedAt: "2026-08-15T00:00:00.000Z",
		};

		const restored = readPersistedWebsiteSite({ record });
		const projected = projectWebsiteSnapshot({ site: restored });

		expect(restored).toEqual({
			...site,
			assetBindings: { [assetId]: assetBindings[assetId] },
			document: { ...site.document, logic: {} },
		});

		expect(columns.content).toEqual(snapshot.document.content);
		expect(columns.logic).toEqual({});
		expect(columns.structure).not.toHaveProperty("content");
		expect(columns.structure).not.toHaveProperty("logic");
		expect(columns.assetBindings).toEqual({ [assetId]: assetBindings[assetId] });

		expect(projected).toEqual({
			...snapshot,
			assets: { [assetId]: assetBindings[assetId] },
			document: { ...snapshot.document, logic: {} },
		});

		expect(restored.document.structure).toBe(columns.structure.structure);
		expect(restored.document.content).toBe(columns.content);
		expect(projected.document).toBe(restored.document);
	});

	it("only skips canonical validation for an explicitly prevalidated document", () => {
		const site = createPersistedWebsiteSite({ assetBindings, snapshot });
		const malformed = structuredClone(site);
		const root = malformed.document.structure.pages[0]?.sections[0]?.root;
		const child = root?.type === "box" ? root.props.children[0] : undefined;

		if (!root || !child) {
			throw new Error("Expected a nested section fixture");
		}

		child.id = root.id;

		expect(() => splitPersistedWebsiteSite({ site: malformed })).toThrow("Invalid Infinite Website document");
		expect(() => splitPersistedWebsiteSite({ documentAlreadyValidated: true, site: malformed })).not.toThrow();
	});

	it("keeps assets referenced only by localized page metadata", () => {
		const seoSnapshot = structuredClone(snapshot);
		const homePage = seoSnapshot.document.structure.pages.find(({ home }) => home);
		const pageContent = homePage ? seoSnapshot.document.content.en?.pages[homePage.id] : undefined;

		if (!pageContent) {
			throw new Error("Expected English home-page content");
		}

		pageContent.seo = { ...pageContent.seo, imageAssetId: seoAssetId };

		const referencedBinding = { src: "https://images.pexels.com/photos/84/photo.jpeg", type: "image" as const };

		const columns = splitPersistedWebsiteSite({
			site: createPersistedWebsiteSite({
				assetBindings: {
					[seoAssetId]: referencedBinding,
					[unreferencedAssetId]: assetBindings[unreferencedAssetId],
				},
				snapshot: seoSnapshot,
			}),
		});

		expect(columns.assetBindings).toEqual({ [seoAssetId]: referencedBinding });
	});
});
