import { describe, expect, it } from "vitest";

import {
	createWebsiteSectionLayoutPreview,
	listSectionLinkElementReferences,
	listWebsiteSectionLayouts,
} from "../src/editing";
import {
	applyWebsiteGenerationEvent,
	applyWebsiteGenerationEvents,
	createWebsiteGenerationShell,
	entityIdFromSeed,
	generationPageKeys,
	instantiateSection,
	selectWebsiteGenerationProfile,
	websiteGenerationEnvelopeSchema,
	websiteGenerationEventSchema,
	type WebsiteGenerationEventV1,
} from "../src/generation";
import { textBasicSection } from "../src/sections/content/text-basic";
import { footerLogoNavSection } from "../src/sections/footer/footer-logo-nav";
import { headerBasicSection } from "../src/sections/header/header-basic";
import textBasicFixtures from "../src/storybook/fixtures/sections/content/text-basic.json";
import footerLogoNavFixtures from "../src/storybook/fixtures/sections/footer/footer-logo-nav.json";
import headerBasicFixtures from "../src/storybook/fixtures/sections/header/header-basic.json";

const websiteId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d";

const assetId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32e";

const snapshot = createWebsiteGenerationShell({
	brief: { location: "Toronto", name: "Northstar", schemaVersion: 1, type: "Design studio" },
	localizations: {
		byLocale: {
			en: {
				kind: "plan",
				pages: generationPageKeys.map((pageKey) => ({
					description: `The ${pageKey} page.`,
					pageKey,
					title: pageKey,
				})),
				siteDescription: "A Toronto design studio.",
			},
		},
		defaultLocale: "en",
	},
	profile: selectWebsiteGenerationProfile({ businessType: "Design studio" }),
	websiteId,
});

const createInstance = ({ anchor, content, definition }: Parameters<typeof instantiateSection>[0]) => {
	return instantiateSection({
		anchor,
		content,
		createId: ({ kind, path }) => entityIdFromSeed({ seed: `${anchor}:${kind}:${path}` }),
		defaultLocale: "en",
		definition,
		path: `/${anchor}`,
	});
};

const header = createInstance({ anchor: "header", content: headerBasicFixtures, definition: headerBasicSection });

const pageSection = createInstance({
	anchor: "content",
	content: textBasicFixtures,
	definition: textBasicSection,
});

const footer = createInstance({
	anchor: "footer",
	content: footerLogoNavFixtures,
	definition: footerLogoNavSection,
});

const sectionEvent = ({
	section,
	target,
}: {
	section: typeof header;
	target: Extract<WebsiteGenerationEventV1, { type: "section" }>["target"];
}): WebsiteGenerationEventV1 => ({
	content: section.content,
	eventKey: `section:${section.section.id}`,
	section: section.section,
	slotKey: section.section.anchor,
	target,
	type: "section",
	version: 1,
});

describe("website generation events", () => {
	it("accepts every event type and rejects malformed envelopes", () => {
		const events = [
			{ eventKey: "status:planning", stage: "planning", type: "status", version: 1 },
			{ eventKey: "prepared", slots: [], snapshot, type: "prepared", version: 1 },
			sectionEvent({ section: header, target: { area: "header", index: 0 } }),
			{
				asset: { src: "/photo.jpg", type: "image" },
				assetId,
				eventKey: `asset:${assetId}`,
				outcome: "provider",
				slotKey: "pages.home.hero",
				type: "asset-settled",
				version: 1,
			},
			{
				eventKey: `section-skipped:${header.section.id}`,
				sectionId: header.section.id,
				slotKey: "layout.header",
				type: "section-skipped",
				version: 1,
			},
			{ eventKey: "completed", snapshot, type: "completed", version: 1 },
			{ code: "GENERATION_FAILED", eventKey: "failed", type: "failed", version: 1 },
			{ eventKey: "cancelled", type: "cancelled", version: 1 },
		] satisfies Array<WebsiteGenerationEventV1>;

		for (const event of events) {
			expect(websiteGenerationEventSchema.parse(event)).toEqual(event);
		}

		expect(websiteGenerationEnvelopeSchema.safeParse({ cursor: "next", event: events[0] }).success).toBe(false);

		expect(websiteGenerationEventSchema.safeParse({ ...events[2], eventKey: "not-a-section-key" }).success).toBe(
			false
		);
	});

	it("applies prepared, content, asset, and completed events in stream order", () => {
		const pageId = snapshot.document.structure.pages[0]?.id;

		if (!pageId) {
			throw new Error("Expected a generated home page");
		}

		const completedSnapshot = { ...snapshot, assets: { [assetId]: { src: "/final.jpg", type: "image" as const } } };

		const events: Array<WebsiteGenerationEventV1> = [
			{ eventKey: "prepared", slots: [], snapshot, type: "prepared", version: 1 },
			{ eventKey: "status:writing", stage: "writing", type: "status", version: 1 },
			sectionEvent({ section: header, target: { area: "header", index: 0 } }),
			sectionEvent({ section: pageSection, target: { area: "page", index: 0, pageId } }),
			sectionEvent({ section: footer, target: { area: "footer", index: 0 } }),
			{
				asset: { src: "/streamed.jpg", type: "image" },
				assetId,
				eventKey: `asset:${assetId}`,
				outcome: "provider",
				slotKey: "content",
				type: "asset-settled",
				version: 1,
			},
			{ code: "GENERATION_FAILED", eventKey: "failed", type: "failed", version: 1 },
		];

		const streamed = applyWebsiteGenerationEvents({ events, snapshot: null });

		const streamedHeader = streamed?.document.structure.layout.header[0];
		expect(streamedHeader).toBeDefined();

		if (!streamedHeader) {
			throw new Error("Expected a generated header");
		}

		expect(
			listSectionLinkElementReferences({ node: streamedHeader.root }).some(
				({ menuRole }) => menuRole === "dropdown-trigger"
			)
		).toBe(false);
		expect(
			listSectionLinkElementReferences({ node: streamedHeader.root }).filter(
				({ menuRole }) => menuRole === "navigation-item"
			)
		).toHaveLength(3);

		if (!streamed) {
			throw new Error("Expected a streamed website snapshot");
		}

		const headerTarget = { area: "header" as const, index: 0, sectionId: streamedHeader.id };
		const headerLayouts = listWebsiteSectionLayouts({ document: streamed.document, target: headerTarget });

		expect(headerLayouts).toHaveLength(5);

		for (const { pattern } of headerLayouts) {
			expect(
				createWebsiteSectionLayoutPreview({ document: streamed.document, pattern, target: headerTarget })
			).toBeDefined();
		}

		expect(streamed?.document.structure.pages[0]?.sections).toEqual([pageSection.section]);
		expect(streamed?.document.structure.layout.footer).toEqual([footer.section]);
		expect(streamed?.assets[assetId]).toEqual({ src: "/streamed.jpg", type: "image" });

		expect(
			applyWebsiteGenerationEvent({
				event: { eventKey: "completed", snapshot: completedSnapshot, type: "completed", version: 1 },
				snapshot: streamed,
			})
		).toEqual(completedSnapshot);
	});

	it("moves a replayed section instead of duplicating it", () => {
		const pageId = snapshot.document.structure.pages[0]?.id;

		if (!pageId) {
			throw new Error("Expected a generated home page");
		}

		const withHeader = applyWebsiteGenerationEvent({
			event: sectionEvent({ section: header, target: { area: "header", index: 0 } }),
			snapshot,
		});

		const moved = applyWebsiteGenerationEvent({
			event: sectionEvent({ section: header, target: { area: "page", index: 0, pageId } }),
			snapshot: withHeader,
		});

		expect(moved?.document.structure.layout.header).toEqual([]);
		expect(moved?.document.structure.pages[0]?.sections).toEqual([header.section]);
	});

	it("removes a skipped placeholder and its localized content", () => {
		const pageId = snapshot.document.structure.pages[0]?.id;

		if (!pageId) {
			throw new Error("Expected a generated home page");
		}

		const prepared = applyWebsiteGenerationEvent({
			event: { eventKey: "prepared", slots: [], snapshot, type: "prepared", version: 1 },
			snapshot: null,
		});

		const withSection = applyWebsiteGenerationEvent({
			event: sectionEvent({ section: pageSection, target: { area: "page", index: 0, pageId } }),
			snapshot: prepared,
		});

		const skipped = applyWebsiteGenerationEvent({
			event: {
				eventKey: `section-skipped:${pageSection.section.id}`,
				sectionId: pageSection.section.id,
				slotKey: "pages.home.optional",
				type: "section-skipped",
				version: 1,
			},
			snapshot: withSection,
		});

		expect(skipped?.document.structure.pages[0]?.sections).toEqual([]);
		expect(skipped?.document.content.en?.sections[pageSection.section.contentId]).toBeUndefined();
	});

	it("rejects content or assets before preparation and missing page targets", () => {
		expect(() =>
			applyWebsiteGenerationEvent({
				event: {
					asset: { src: "/photo.jpg", type: "image" },
					assetId,
					eventKey: `asset:${assetId}`,
					outcome: "provider",
					slotKey: "content",
					type: "asset-settled",
					version: 1,
				},
				snapshot: null,
			})
		).toThrow("arrived before the website shell");

		expect(() =>
			applyWebsiteGenerationEvent({
				event: sectionEvent({
					section: pageSection,
					target: { area: "page", index: 0, pageId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d339" },
				}),
				snapshot,
			})
		).toThrow("targets a missing page");
	});
});
