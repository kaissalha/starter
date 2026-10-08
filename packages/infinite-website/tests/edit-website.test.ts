import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
	entityIdFromSeed,
	instantiateTemplate,
	type JsonValue,
	resolveSectionContentReference,
} from "@starter/infinite-website";
import {
	createWebsiteSectionNeighborhoodDocument,
	editWebsiteSnapshot,
	websiteDocumentEditInputSchema,
	websiteEditInputSchema,
	websiteSectionRootEditInputSchema,
	WebsiteEditError,
} from "@starter/infinite-website/editing";
import { growthEngineTemplate } from "@starter/infinite-website/templates/growth-engine";
import growthEngineContent from "@starter/infinite-website/templates/growth-engine/content";
import { nordicEdgeTemplate } from "@starter/infinite-website/templates/nordic-edge";
import nordicEdgeContent from "@starter/infinite-website/templates/nordic-edge/content";

import { jsonObjectSchema, readContentPointer } from "../src/document/content-schema";
import { parseSiteDocument } from "../src/document/document-validation";
import {
	createWebsiteSectionLayoutPreview,
	listWebsitePageSectionLayouts,
	swapWebsitePageSectionLayout,
} from "../src/document/page-section-layout";
import {
	listSectionLinkElementReferences,
	listSectionMediaNodeReferences,
	listSectionMenus,
} from "../src/document/section-content-references";
import { websiteSettingsSchema } from "../src/document/website-settings";
import { sectionRegistry } from "../src/section-registry";
import { instantiateSection } from "../src/sections/section-definition";
import bannerCompactBackgroundFixtures from "../src/storybook/fixtures/sections/hero/banner-compact-background.json";
import bannerDiagonalGridFixtures from "../src/storybook/fixtures/sections/hero/banner-diagonal-grid.json";
import pricingTableFixtures from "../src/storybook/fixtures/sections/pricing/pricing-table.json";
import { testBrand } from "./fixtures/brand";
import { singlePageStructure } from "./fixtures/structure";

const createSnapshot = () => ({
	assets: {},
	brand: testBrand,
	document: instantiateTemplate({
		content: nordicEdgeContent,
		createId: ({ kind, path }) => entityIdFromSeed({ seed: `edit-website:${kind}:${path}` }),
		definition: nordicEdgeTemplate,
		path: "/edit-website",
	}),
	schemaVersion: 1 as const,
	templateId: "nordic-edge",
});

const createFaqSnapshot = () => ({
	...createSnapshot(),
	document: instantiateTemplate({
		content: growthEngineContent,
		createId: ({ kind, path }) => entityIdFromSeed({ seed: `edit-faq:${kind}:${path}` }),
		definition: growthEngineTemplate,
		path: "/edit-faq",
	}),
	templateId: "growth-engine",
});

const createMenuSnapshot = () => {
	const snapshot = createSnapshot();
	const section = snapshot.document.structure.layout.header[0];

	if (!section) {
		throw new Error("Expected header");
	}

	const menu = listSectionMenus({ node: section.root })[0];

	if (!menu) {
		throw new Error("Expected menu");
	}

	return { menu, section, snapshot };
};

describe("website editing", () => {
	it("replaces only the selected media slot across locales without mutating the input", () => {
		const snapshot = createSnapshot();
		const section = snapshot.document.structure.pages[0]?.sections[0];
		const pointer = JSON.stringify(section?.root).match(/"\$asset":"([^"]+)"/u)?.[1];

		if (!section || !pointer) {
			throw new Error("Expected media");
		}

		const original = structuredClone(snapshot);
		const fileId = crypto.randomUUID();

		const updated = editWebsiteSnapshot({
			input: { fileId, operation: "update-media", pointer, sectionId: section.id },
			snapshot,
		});

		for (const locale of updated.document.locales) {
			expect(
				resolveSectionContentReference({
					content: updated.document.content,
					contentId: section.contentId,
					defaultLocale: updated.document.defaultLocale,
					locale,
					reference: { $asset: pointer },
				})
			).toBe(fileId);
		}

		expect(updated.document.structure).toEqual(original.document.structure);
		expect(snapshot).toEqual(original);
		expect(() =>
			editWebsiteSnapshot({
				input: { fileId, operation: "update-media", pointer: "/not-media", sectionId: section.id },
				snapshot,
			})
		).toThrow(WebsiteEditError);
	});

	it("replaces a swapped photo's alt text in every locale instead of keeping the old description", () => {
		const snapshot = createSnapshot();
		const section = snapshot.document.structure.pages[0]?.sections[0];

		const target = section
			? listSectionMediaNodeReferences({ node: section.root }).find(({ altPointer }) => altPointer)
			: undefined;

		if (!section || !target?.altPointer) {
			throw new Error("Expected media with alt text");
		}

		const { altPointer, pointer } = target;

		const resolveAlt = (document: typeof snapshot.document, locale: "ar" | "en") =>
			resolveSectionContentReference({
				content: document.content,
				contentId: section.contentId,
				defaultLocale: document.defaultLocale,
				locale,
				reference: { $text: altPointer },
			});

		const original = structuredClone(snapshot);

		const edit = (document: typeof snapshot.document, alt?: Record<string, string>) =>
			editWebsiteSnapshot({
				input: { alt, fileId: crypto.randomUUID(), operation: "update-media", pointer, sectionId: section.id },
				snapshot: { ...snapshot, document },
			}).document;

		const described = edit(snapshot.document, { ar: "باب أحمر", en: "A red door" });
		expect(resolveAlt(described, "en")).toBe("A red door");
		expect(resolveAlt(described, "ar")).toBe("باب أحمر");
		const cleared = edit(described);
		expect(resolveAlt(cleared, "en")).toBe("");
		expect(resolveAlt(cleared, "ar")).toBe("");
		expect(resolveAlt(edit(described, { en: "A blue door" }), "ar")).toBe("");
		expect(cleared.structure).toEqual(original.document.structure);
		expect(snapshot).toEqual(original);
		expect(() => edit(snapshot.document, { xx: "Unknown" })).toThrow(WebsiteEditError);
	});

	it("updates one localized text reference without changing other locales", () => {
		const snapshot = createSnapshot();
		const section = snapshot.document.structure.pages[0]?.sections[0];
		const pointer = JSON.stringify(section?.root).match(/"\$text":"([^"]+)"/u)?.[1];

		if (!section || !pointer) {
			throw new Error("Expected an editable text reference");
		}

		const arabicBefore = resolveSectionContentReference({
			content: snapshot.document.content,
			contentId: section.contentId,
			defaultLocale: snapshot.document.defaultLocale,
			locale: "ar",
			reference: { $text: pointer },
		});

		const updated = editWebsiteSnapshot({
			input: {
				locale: "en",
				operation: "update-text",
				pageId: snapshot.document.structure.pages[0]?.id,
				pointer,
				sectionId: section.id,
				value: "A sharper opening statement",
			},
			snapshot,
		});

		expect(
			resolveSectionContentReference({
				content: updated.document.content,
				contentId: section.contentId,
				defaultLocale: updated.document.defaultLocale,
				locale: "en",
				reference: { $text: pointer },
			})
		).toBe("A sharper opening statement");

		expect(
			resolveSectionContentReference({
				content: updated.document.content,
				contentId: section.contentId,
				defaultLocale: updated.document.defaultLocale,
				locale: "ar",
				reference: { $text: pointer },
			})
		).toEqual(arabicBefore);
	});

	it("rejects a page-scoped text edit for a section outside that page", () => {
		const snapshot = createSnapshot();
		const page = snapshot.document.structure.pages[0];
		const section = snapshot.document.structure.layout.header[0];
		const pointer = JSON.stringify(section?.root).match(/"\$text":"([^"]+)"/u)?.[1];

		if (!page || !section || !pointer) {
			throw new Error("Expected editable page and header sections");
		}

		expect(() =>
			editWebsiteSnapshot({
				input: {
					locale: "en",
					operation: "update-text",
					pageId: page.id,
					pointer,
					sectionId: section.id,
					value: "Not allowed",
				},
				snapshot,
			})
		).toThrow(WebsiteEditError);
	});

	it("updates an action label and typed destination atomically in one locale", () => {
		const snapshot = createSnapshot();

		const editable = [
			...snapshot.document.structure.layout.header,
			...snapshot.document.structure.pages.flatMap((page) => page.sections),
			...snapshot.document.structure.layout.footer,
		]
			.flatMap((section) =>
				listSectionLinkElementReferences({ node: section.root }).flatMap((target) =>
					target.labels[0] ? [{ label: target.labels[0], section, target }] : []
				)
			)
			.at(0);

		if (!editable) {
			throw new Error("Expected an editable action link");
		}

		const { label, section, target } = editable;

		const englishLabel = readContentPointer({
			pointer: label.pointer,
			value: snapshot.document.content.en.sections[section.contentId],
		});

		const updated = editWebsiteSnapshot({
			input: {
				label: { pointers: [label.pointer], value: "احجز الآن" },
				locale: "ar",
				operation: "update-link",
				pointer: target.pointer,
				sectionId: section.id,
				value: { kind: "external", url: "https://example.com/book" },
			},
			snapshot,
		});

		expect(
			readContentPointer({
				pointer: target.pointer,
				value: updated.document.content.ar.sections[section.contentId],
			})
		).toEqual({ kind: "external", url: "https://example.com/book" });

		expect(
			readContentPointer({
				pointer: label.pointer,
				value: updated.document.content.ar.sections[section.contentId],
			})
		).toBe("احجز الآن");

		expect(
			readContentPointer({
				pointer: label.pointer,
				value: updated.document.content.en.sections[section.contentId],
			})
		).toEqual(englishLabel);
	});

	it("updates every desktop and mobile label for one menu destination", () => {
		const snapshot = createFaqSnapshot();
		const section = snapshot.document.structure.layout.header[0];

		const target = section
			? listSectionLinkElementReferences({ node: section.root }).find(({ labels }) => labels.length > 1)
			: undefined;

		if (!section || !target) {
			throw new Error("Expected a menu item with desktop and mobile labels");
		}

		const updated = editWebsiteSnapshot({
			input: {
				label: { pointers: target.labels.map(({ pointer }) => pointer), value: "Updated" },
				locale: "en",
				operation: "update-link",
				pointer: target.pointer,
				sectionId: section.id,
				value: { kind: "relative", path: "/updated" },
			},
			snapshot,
		});

		target.labels.forEach(({ pointer }) => {
			expect(
				readContentPointer({
					pointer,
					value: updated.document.content.en.sections[section.contentId],
				})
			).toBe("Updated");
		});
	});

	it("inserts and reorders header links while preserving localized content and stable IDs", () => {
		const { menu, section, snapshot } = createMenuSnapshot();
		const original = structuredClone(snapshot);
		const elementId = crypto.randomUUID();

		const input = {
			elementId,
			index: 0,
			label: "Our team",
			locale: "en" as const,
			menuId: menu.id,
			operation: "add-menu-item" as const,
			sectionId: section.id,
			value: { kind: "relative" as const, path: "/team" },
		};

		const inserted = editWebsiteSnapshot({ input, snapshot });
		const updatedSection = inserted.document.structure.layout.header[0];

		if (!updatedSection) {
			throw new Error("Expected header");
		}

		const ids = listSectionMenus({ node: updatedSection.root })[0]?.props.items.map(({ id }) => id);
		expect(ids).toEqual([elementId, ...menu.props.items.map(({ id }) => id)]);

		for (const locale of inserted.document.locales) {
			expect(
				resolveSectionContentReference({
					content: inserted.document.content,
					contentId: section.contentId,
					defaultLocale: inserted.document.defaultLocale,
					locale,
					reference: { $text: `/authoring/menu/${menu.id}/items/${elementId}/label` },
				})
			).toBe("Our team");
		}

		const moved = editWebsiteSnapshot({
			input: { elementId, index: menu.props.items.length, operation: "move-menu-item", sectionId: section.id },
			snapshot: inserted,
		});

		const movedSection = moved.document.structure.layout.header[0];

		if (!movedSection) {
			throw new Error("Expected header");
		}

		expect(listSectionMenus({ node: movedSection.root })[0]?.props.items.map(({ id }) => id)).toEqual([
			...menu.props.items.map(({ id }) => id),
			elementId,
		]);
		expect(moved.document.content).toEqual(inserted.document.content);
		expect(snapshot).toEqual(original);
		expect(() => editWebsiteSnapshot({ input, snapshot: inserted })).toThrow(WebsiteEditError);
		expect(() =>
			editWebsiteSnapshot({ input: { ...input, menuId: crypto.randomUUID() }, snapshot: inserted })
		).toThrow(WebsiteEditError);
		expect(() => editWebsiteSnapshot({ input: { ...input, index: 100 }, snapshot })).toThrow(WebsiteEditError);
		expect(() =>
			editWebsiteSnapshot({
				input: { elementId, index: 100, operation: "move-menu-item", sectionId: section.id },
				snapshot: inserted,
			})
		).toThrow(WebsiteEditError);
	});

	it("adds a link to an emptied header menu in a non-default locale", () => {
		const { menu, section, snapshot } = createMenuSnapshot();

		const emptySnapshot = menu.props.items.reduce(
			(current, item) =>
				editWebsiteSnapshot({
					input: { elementId: item.id, operation: "delete-menu-item", sectionId: section.id },
					snapshot: current,
				}),
			snapshot
		);

		const elementId = crypto.randomUUID();

		const added = editWebsiteSnapshot({
			input: {
				elementId,
				index: 0,
				label: "الفريق",
				locale: "ar",
				menuId: menu.id,
				operation: "add-menu-item",
				sectionId: section.id,
				value: { kind: "relative", path: "/team" },
			},
			snapshot: emptySnapshot,
		});

		for (const locale of ["en", "ar"] as const) {
			expect(
				resolveSectionContentReference({
					content: added.document.content,
					contentId: section.contentId,
					defaultLocale: added.document.defaultLocale,
					locale,
					reference: { $text: `/authoring/menu/${menu.id}/items/${elementId}/label` },
				})
			).toBe("الفريق");
		}
	});

	it("converts, edits, and removes a complete menu item atomically", () => {
		const snapshot = createFaqSnapshot();
		const section = snapshot.document.structure.layout.header[0];

		const target = section
			? listSectionLinkElementReferences({ node: section.root }).find(
					(reference) => reference.menuRole === "navigation-item"
				)
			: undefined;

		const dropdownItemId = entityIdFromSeed({ seed: "edited-menu-item" });
		const removedDropdownItemId = entityIdFromSeed({ seed: "removed-menu-item" });

		if (!section || !target) {
			throw new Error("Expected an editable navigation item");
		}

		const dropdown = editWebsiteSnapshot({
			input: {
				elementId: target.elementId,
				items: [
					{
						id: dropdownItemId,
						label: "First dropdown item",
						value: { kind: "relative", path: "/first" },
					},
					{
						id: removedDropdownItemId,
						label: "Second dropdown item",
						value: { kind: "relative", path: "/second" },
					},
				],
				kind: "dropdown",
				label: "Services",
				locale: "en",
				operation: "update-menu-item",
				sectionId: section.id,
				value: { kind: "relative", path: "/services" },
			},
			snapshot,
		});

		const dropdownSection = dropdown.document.structure.layout.header[0];

		const dropdownReferences = dropdownSection
			? listSectionLinkElementReferences({ node: dropdownSection.root })
			: [];

		const dropdownTrigger = dropdownReferences.find(({ elementId }) => elementId === target.elementId);
		const dropdownItem = dropdownReferences.find(({ elementId }) => elementId === dropdownItemId);

		expect(dropdownTrigger?.menuRole).toBe("dropdown-trigger");
		expect(dropdownItem).toMatchObject({ menuItemId: target.elementId, menuRole: "dropdown-item" });
		expect(
			readContentPointer({
				pointer: dropdownItem?.labels[0]?.pointer ?? "",
				value: dropdown.document.content.en.sections[section.contentId],
			})
		).toBe("First dropdown item");

		const editedDropdown = editWebsiteSnapshot({
			input: {
				elementId: target.elementId,
				items: [
					{
						id: dropdownItemId,
						label: "Updated dropdown item",
						value: { kind: "relative", path: "/updated" },
					},
				],
				kind: "dropdown",
				label: "Services",
				locale: "en",
				operation: "update-menu-item",
				sectionId: section.id,
				value: { kind: "relative", path: "/services" },
			},
			snapshot: dropdown,
		});

		const editedSection = editedDropdown.document.structure.layout.header[0];
		const editedReferences = editedSection ? listSectionLinkElementReferences({ node: editedSection.root }) : [];
		const editedItem = editedReferences.find(({ elementId }) => elementId === dropdownItemId);

		expect(editedReferences.some(({ elementId }) => elementId === removedDropdownItemId)).toBe(false);
		expect(
			readContentPointer({
				pointer: editedItem?.labels[0]?.pointer ?? "",
				value: editedDropdown.document.content.en.sections[section.contentId],
			})
		).toBe("Updated dropdown item");

		const link = editWebsiteSnapshot({
			input: {
				elementId: target.elementId,
				items: [],
				kind: "link",
				label: "Services",
				locale: "en",
				operation: "update-menu-item",
				sectionId: section.id,
				value: { kind: "relative", path: "/services" },
			},
			snapshot: editedDropdown,
		});

		const linkSection = link.document.structure.layout.header[0];
		const linkReferences = linkSection ? listSectionLinkElementReferences({ node: linkSection.root }) : [];

		expect(linkReferences.find(({ elementId }) => elementId === target.elementId)?.menuRole).toBe(
			"navigation-item"
		);
		expect(
			linkReferences.some(
				({ elementId, menuItemId }) => menuItemId === target.elementId && elementId !== target.elementId
			)
		).toBe(false);

		const removed = editWebsiteSnapshot({
			input: {
				elementId: target.elementId,
				operation: "delete-menu-item",
				sectionId: section.id,
			},
			snapshot: link,
		});

		const removedSection = removed.document.structure.layout.header[0];

		expect(
			removedSection &&
				listSectionLinkElementReferences({ node: removedSection.root }).some(
					({ elementId }) => elementId === target.elementId
				)
		).toBe(false);
	});

	it("adds and deletes persisted accordion items with stable localized identity", () => {
		const snapshot = createFaqSnapshot();

		const page = snapshot.document.structure.pages.find((candidate) =>
			candidate.sections.some((section) => section.category === "faq")
		);

		const section = page?.sections.find((candidate) => candidate.category === "faq");

		const collection = section
			? jsonObjectSchema.safeParse(
					readContentPointer({
						pointer: "/items",
						value: snapshot.document.content.en.sections[section.contentId],
					})
				)
			: undefined;

		if (!section || !collection?.success || !Array.isArray(collection.data.order)) {
			throw new Error("Expected an editable FAQ accordion");
		}

		const itemId = entityIdFromSeed({ seed: "new-faq-item" });

		const added = editWebsiteSnapshot({
			input: {
				collection: "/items",
				itemId,
				operation: "add-collection-item",
				sectionId: section.id,
			},
			snapshot,
		});

		const addedCollection = jsonObjectSchema.parse(
			readContentPointer({ pointer: "/items", value: added.document.content.en.sections[section.contentId] })
		);

		expect(addedCollection.order).toEqual([...collection.data.order, itemId]);
		expect(jsonObjectSchema.parse(addedCollection.items)[itemId]).toBeDefined();
		expect(JSON.stringify(added.document.structure.pages)).toContain(`/items/items/${itemId}/question`);
		expect(JSON.stringify(added.document.content.ar.sections[section.contentId])).toContain(itemId);

		const alternative = listWebsitePageSectionLayouts({
			document: added.document,
			pageId: page.id,
			sectionId: section.id,
		}).find(({ generationRequired, pattern }) => pattern !== section.source.pattern && !generationRequired);

		if (!alternative) {
			throw new Error("Expected an alternative FAQ layout");
		}

		const swapped = swapWebsitePageSectionLayout({
			document: added.document,
			pageId: page.id,
			pattern: alternative.pattern,
			sectionId: section.id,
		});

		expect(swapped).toBeDefined();

		const swappedCollection = swapped
			? jsonObjectSchema.parse(
					readContentPointer({ pointer: "/items", value: swapped.content.en.sections[section.contentId] })
				)
			: undefined;

		expect(swappedCollection?.order).toEqual([...collection.data.order, itemId]);

		const removed = editWebsiteSnapshot({
			input: {
				collection: "/items",
				itemId,
				operation: "delete-collection-item",
				sectionId: section.id,
			},
			snapshot: added,
		});

		expect(JSON.stringify(removed.document)).not.toContain(itemId);
	});

	it("keeps expanded repeater counts and item ids in generative layout previews", () => {
		const snapshotReference = { value: createFaqSnapshot() };

		const page = snapshotReference.value.document.structure.pages.find((candidate) =>
			candidate.sections.some((section) => section.category === "faq")
		);

		const section = page?.sections.find((candidate) => candidate.category === "faq");

		if (!page || !section) {
			throw new Error("Expected an editable FAQ accordion");
		}

		for (const indexReference = { value: 4 }; indexReference.value < 8; indexReference.value += 1) {
			snapshotReference.value = editWebsiteSnapshot({
				input: {
					collection: "/items",
					itemId: entityIdFromSeed({ seed: `preview-faq-item-${indexReference.value}` }),
					operation: "add-collection-item",
					sectionId: section.id,
				},
				snapshot: snapshotReference.value,
			});
		}

		const sourceCollection = jsonObjectSchema.parse(
			readContentPointer({
				pointer: "/items",
				value: snapshotReference.value.document.content.en.sections[section.contentId],
			})
		);

		const sourceIds = z.array(z.uuid()).parse(sourceCollection.order);
		const pattern = "faq-accordion-image";

		expect(
			listWebsitePageSectionLayouts({
				document: snapshotReference.value.document,
				pageId: page.id,
				sectionId: section.id,
			})
		).toContainEqual({ generationRequired: true, pattern });

		const preview = createWebsiteSectionLayoutPreview({
			document: snapshotReference.value.document,
			pattern,
			target: { area: "page", index: page.sections.indexOf(section), pageId: page.id, sectionId: section.id },
		});

		const previewCollection = preview
			? jsonObjectSchema.parse(
					readContentPointer({
						pointer: "/items",
						value: preview.content.en.sections[section.contentId],
					})
				)
			: undefined;

		expect(previewCollection?.order).toEqual(sourceIds);
	});

	it("rejects collection additions when a localized source item is missing", () => {
		const snapshot = createFaqSnapshot();

		const section = snapshot.document.structure.pages
			.flatMap((page) => page.sections)
			.find((candidate) => candidate.category === "faq");

		const englishCollection = section
			? jsonObjectSchema.safeParse(
					readContentPointer({
						pointer: "/items",
						value: snapshot.document.content.en.sections[section.contentId],
					})
				)
			: undefined;

		const order = englishCollection?.success
			? z.array(z.uuid()).safeParse(englishCollection.data.order)
			: undefined;

		const previousItemId = order?.success ? order.data.at(-1) : undefined;

		if (!section || !previousItemId) {
			throw new Error("Expected a localized FAQ collection");
		}

		const arabicContent = jsonObjectSchema.parse(snapshot.document.content.ar.sections[section.contentId]);
		const arabicCollection = jsonObjectSchema.parse(arabicContent.items);
		const arabicItems = jsonObjectSchema.parse(arabicCollection.items);

		delete arabicItems[previousItemId];
		arabicContent.items = { ...arabicCollection, items: arabicItems };
		snapshot.document.content.ar.sections[section.contentId] = arabicContent;

		expect(() =>
			editWebsiteSnapshot({
				input: {
					collection: "/items",
					itemId: entityIdFromSeed({ seed: "missing-localized-faq-item" }),
					operation: "add-collection-item",
					sectionId: section.id,
				},
				snapshot,
			})
		).toThrow(WebsiteEditError);
	});

	it("updates the brand as one validated foundation", () => {
		const snapshot = createSnapshot();

		const updated = editWebsiteSnapshot({
			input: {
				brand: {
					...snapshot.brand,
					colors: { ...snapshot.brand.colors, primary: "#2457d6" },
					corners: { style: "soft" },
				},
				operation: "update-brand",
			},
			snapshot,
		});

		expect(updated.brand.colors.primary).toBe("#2457d6");
		expect(updated.brand.corners.style).toBe("soft");
		expect(updated.document).toBe(snapshot.document);
	});

	it("replaces a section's persisted primitive composition without changing its pattern", () => {
		const snapshot = createSnapshot();
		const page = snapshot.document.structure.pages[0];
		const section = page?.sections[0];

		if (!page || !section) {
			throw new Error("Expected an editable section");
		}

		const root = structuredClone(section.root);
		root.props.fill = "featured";
		root.props.radius = "theme";

		const updated = editWebsiteSnapshot({
			input: {
				operation: "replace-section-root",
				pageId: page.id,
				root,
				sectionId: section.id,
			},
			snapshot,
		});

		const edited = updated.document.structure.pages[0]?.sections[0];
		expect(edited?.source.pattern).toBe(section.source.pattern);
		expect(edited?.root).toEqual(root);
	});

	it("rejects text edits that erase a composed action's accessible name", () => {
		const snapshot = createSnapshot();
		const page = snapshot.document.structure.pages[0]!;

		const added = editWebsiteSnapshot({
			input: {
				index: 0,
				operation: "add-composed-section",
				pageId: page.id,
				seed: entityIdFromSeed({ seed: "accessible-edit-section" }),
				specification: {
					content: {
						ar: { "action-label": "إجراء" },
						en: { "action-label": "Action" },
						links: { "action-link": { kind: "relative", path: "/about" } },
					},
					structure: {
						nodes: [
							{
								children: ["primary-action"],
								key: "surface",
								props: {
									padding: {
										blockEnd: "2rem",
										blockStart: "2rem",
										inlineEnd: "1rem",
										inlineStart: "1rem",
									},
								},
								type: "box",
							},
							{
								children: ["action-label"],
								key: "primary-action",
								props: { link: "action-link" },
								type: "action",
							},
							{
								children: [],
								key: "action-label",
								props: { content: "action-label" },
								type: "text",
							},
						],
						root: "surface",
					},
				},
			},
			snapshot,
		});

		const section = added.document.structure.pages[0]!.sections[0]!;
		const pointer = JSON.stringify(section.root).match(/"\$text":"([^"]+)"/u)?.[1];

		if (!pointer) {
			throw new Error("Expected a composed action label reference");
		}

		expect(() =>
			editWebsiteSnapshot({
				input: {
					locale: "en",
					operation: "update-text",
					pageId: page.id,
					pointer,
					sectionId: section.id,
					value: " ",
				},
				snapshot: added,
			})
		).toThrow(WebsiteEditError);
	});

	it("rejects deeply nested section roots before recursive schema parsing", () => {
		const snapshot = createSnapshot();
		const section = snapshot.document.structure.pages[0]!.sections[0]!;

		const leaf: JsonValue = {
			id: entityIdFromSeed({ seed: "deep-edit-leaf" }),
			props: { content: { $text: "/copy/heading" } },
			type: "text",
		};

		const root = Array.from({ length: 20_000 }, (_, index) => index).reduce<JsonValue>(
			(child, index) => ({
				id: entityIdFromSeed({ seed: `deep-edit-${index}` }),
				props: { children: [child] },
				type: "box",
			}),
			leaf
		);

		const input = {
			operation: "replace-section-root",
			root,
			sectionId: section.id,
		};

		[websiteSectionRootEditInputSchema, websiteDocumentEditInputSchema, websiteEditInputSchema].forEach(
			(schema) => {
				expect(() => schema.safeParse(input)).not.toThrow();
				expect(schema.safeParse(input).success).toBe(false);
			}
		);
	});

	it("routes section operations through the same discriminated edit contract", () => {
		const snapshot = createSnapshot();
		const page = snapshot.document.structure.pages[0];
		const first = page?.sections[0];
		const second = page?.sections[1];

		if (!page || !first || !second) {
			throw new Error("Expected two editable sections");
		}

		const updated = editWebsiteSnapshot({
			input: { operation: "move-down", pageId: page.id, sectionId: first.id },
			snapshot,
		});

		expect(updated.document.structure.pages[0]?.sections.slice(0, 2)).toEqual([second, first]);

		expect(
			websiteEditInputSchema.safeParse({
				operation: "move-down",
				pageId: page.id,
				pattern: "banner-bottom-card",
				sectionId: first.id,
			}).success
		).toBe(false);

		expect(
			websiteEditInputSchema.safeParse({ operation: "swap-layout", pageId: page.id, sectionId: first.id }).success
		).toBe(false);
	});

	it("rejects text pointers that are not used by the selected section", () => {
		const snapshot = createSnapshot();
		const section = snapshot.document.structure.pages[0]?.sections[0];

		if (!section) {
			throw new Error("Expected an editable section");
		}

		expect(() =>
			editWebsiteSnapshot({
				input: {
					locale: "en",
					operation: "update-text",
					pointer: "/copy/not-used",
					sectionId: section.id,
					value: "Not allowed",
				},
				snapshot,
			})
		).toThrow(WebsiteEditError);
	});
});

describe("website languages", () => {
	it("adds French and serves it as the default without changing page identities", () => {
		const original = createSnapshot();

		const translated = editWebsiteSnapshot({
			input: {
				content: { ...original.document.content.en!, site: { name: "Bonjour" } },
				locale: "fr",
				operation: "add-language",
			},
			snapshot: original,
		});

		const updated = editWebsiteSnapshot({
			input: { locale: "fr", operation: "set-default-language" },
			snapshot: translated,
		});

		expect(updated.document.defaultLocale).toBe("fr");
		expect(updated.brand.defaultLocale).toBe("fr");
		expect(updated.brand.locales).toEqual(updated.document.locales);
		expect(updated.document.structure).toEqual(original.document.structure);
		expect(updated.document.content.en).toEqual(original.document.content.en);
		expect(updated.document.content.fr?.site.name).toBe("Bonjour");
	});
	it("rejects an unavailable default language and duplicate additions", () => {
		const snapshot = createSnapshot();
		expect(() =>
			editWebsiteSnapshot({ input: { locale: "fr", operation: "set-default-language" }, snapshot })
		).toThrow(WebsiteEditError);
		expect(() => editWebsiteSnapshot({ input: { locale: "en", operation: "add-language" }, snapshot })).toThrow(
			WebsiteEditError
		);
	});
	it("materializes a partial translation before making it the default", () => {
		const snapshot = createSnapshot();
		snapshot.document.content.ar = { pages: {}, sections: {}, site: { name: "الاسم" } };
		const updated = editWebsiteSnapshot({ input: { locale: "ar", operation: "set-default-language" }, snapshot });
		expect(updated.document.content.ar?.pages).toEqual(snapshot.document.content.en?.pages);
		expect(updated.document.content.ar?.site.name).toBe("الاسم");
	});
});

describe("website settings and language removal", () => {
	it("persists integrations and prevents removing the main language", () => {
		const snapshot = createSnapshot();
		const settings = websiteSettingsSchema.parse({ googleAnalyticsId: "G-TEST123" });
		const updated = editWebsiteSnapshot({ input: { operation: "update-settings", settings }, snapshot });
		expect(updated.document.settings).toEqual(settings);
		expect(websiteSettingsSchema.parse({ ...settings, blog: {}, faviconUrl: null, visibility: "preview" })).toEqual(
			settings
		);
		expect(() => editWebsiteSnapshot({ input: { locale: "en", operation: "remove-language" }, snapshot })).toThrow(
			WebsiteEditError
		);
		const removed = editWebsiteSnapshot({ input: { locale: "ar", operation: "remove-language" }, snapshot });
		expect(removed.document.locales).toEqual(["en"]);
		expect(removed.brand.locales).toEqual(["en"]);
		expect(removed.document.content.ar).toBeUndefined();
	});

	it("updates a page's search title and description for one language", () => {
		const snapshot = createSnapshot();
		const page = snapshot.document.structure.pages[0];

		const updated = editWebsiteSnapshot({
			input: {
				description: "Fresh coffee in Riyadh.",
				locale: "ar",
				operation: "update-page-seo",
				pageId: page.id,
				title: "قهوة",
			},
			snapshot,
		});

		expect(updated.document.content.ar?.pages[page.id]?.seo).toMatchObject({
			description: "Fresh coffee in Riyadh.",
			title: "قهوة",
		});
		expect(updated.document.content.en?.pages[page.id]).toEqual(snapshot.document.content.en?.pages[page.id]);

		const cleared = editWebsiteSnapshot({
			input: { description: "", locale: "ar", operation: "update-page-seo", pageId: page.id, title: "قهوة" },
			snapshot: updated,
		});

		expect(cleared.document.content.ar?.pages[page.id]?.seo?.description).toBeUndefined();
		expect(() =>
			editWebsiteSnapshot({
				input: {
					description: "",
					locale: "en",
					operation: "update-page-seo",
					pageId: entityIdFromSeed({ seed: "missing-page" }),
					title: "Missing",
				},
				snapshot,
			})
		).toThrow(WebsiteEditError);
	});
});

const createPricingSnapshot = () => {
	const definition = sectionRegistry.get("pricing-table");

	if (!definition) {
		throw new Error("Expected the pricing-table pattern");
	}

	const instance = instantiateSection({
		anchor: "contact",
		content: pricingTableFixtures,
		createId: ({ kind, path }) => entityIdFromSeed({ seed: `nested-edit:${kind}:${path}` }),
		defaultLocale: "en",
		definition,
		path: "/pricing",
	});

	const pageId = entityIdFromSeed({ seed: "nested-edit:page" });

	return {
		assets: {},
		brand: testBrand,
		document: parseSiteDocument({
			content: Object.fromEntries(
				Object.entries(instance.content).map(([locale, sectionContent]) => [
					locale,
					{
						pages: locale === "en" ? { [pageId]: { route: { slug: "home" }, seo: { title: "Home" } } } : {},
						sections: { [instance.section.contentId]: sectionContent },
						site: locale === "en" ? { name: "Pricing" } : {},
					},
				])
			),
			defaultLocale: "en",
			documentVersion: 1,
			locales: ["en", "ar"],
			structure: singlePageStructure({ pageId, sections: [instance.section] }),
		}),
		schemaVersion: 1 as const,
		section: instance.section,
		templateId: "nested-edit",
	};
};

const readCollectionIds = ({
	document,
	pointer,
}: {
	document: ReturnType<typeof createPricingSnapshot>["document"];
	pointer: string;
}) => {
	const section = document.structure.pages[0]?.sections[0];

	const collection = jsonObjectSchema.parse(
		readContentPointer({ pointer, value: section ? document.content.en?.sections[section.contentId] : undefined })
	);

	return z.array(z.uuid()).parse(collection.order);
};

describe("nested collection editing", () => {
	it("adds and deletes an item in one nested collection without touching its siblings", () => {
		const snapshot = createPricingSnapshot();
		const { section } = snapshot;
		const [firstPlan, secondPlan] = readCollectionIds({ document: snapshot.document, pointer: "/items" });
		const featuresPointer = `/items/items/${firstPlan}/features`;
		const siblingPointer = `/items/items/${secondPlan}/features`;
		const featureIds = readCollectionIds({ document: snapshot.document, pointer: featuresPointer });
		const itemId = entityIdFromSeed({ seed: "nested-edit:new-feature" });

		const added = editWebsiteSnapshot({
			input: { collection: featuresPointer, itemId, operation: "add-collection-item", sectionId: section.id },
			snapshot,
		});

		expect(readCollectionIds({ document: added.document, pointer: featuresPointer })).toEqual([
			...featureIds,
			itemId,
		]);

		expect(readCollectionIds({ document: added.document, pointer: siblingPointer })).toEqual(
			readCollectionIds({ document: snapshot.document, pointer: siblingPointer })
		);

		const markup = JSON.stringify(added.document.structure);
		expect(markup).toContain(`${featuresPointer}/items/${itemId}/title`);
		expect(JSON.stringify(added.document.content.ar)).toContain(itemId);

		const removed = editWebsiteSnapshot({
			input: { collection: featuresPointer, itemId, operation: "delete-collection-item", sectionId: section.id },
			snapshot: added,
		});

		expect(JSON.stringify(removed.document)).not.toContain(itemId);
		expect(removed.document).toEqual(snapshot.document);
	});

	it("enforces the nested repeater bounds per parent item", () => {
		const snapshot = createPricingSnapshot();
		const [plan] = readCollectionIds({ document: snapshot.document, pointer: "/items" });
		const featuresPointer = `/items/items/${plan}/features`;
		const featureIds = readCollectionIds({ document: snapshot.document, pointer: featuresPointer });

		const trimmed = featureIds.slice(0, -1).reduce(
			(current, id) =>
				editWebsiteSnapshot({
					input: {
						collection: featuresPointer,
						itemId: id,
						operation: "delete-collection-item",
						sectionId: snapshot.section.id,
					},
					snapshot: current,
				}),
			snapshot
		);

		expect(() =>
			editWebsiteSnapshot({
				input: {
					collection: featuresPointer,
					itemId: featureIds.at(-1) ?? "",
					operation: "delete-collection-item",
					sectionId: snapshot.section.id,
				},
				snapshot: trimmed,
			})
		).toThrow(WebsiteEditError);

		expect(() =>
			editWebsiteSnapshot({
				input: {
					collection: `/items/items/${entityIdFromSeed({ seed: "nested-edit:missing-plan" })}/features`,
					itemId: entityIdFromSeed({ seed: "nested-edit:orphan" }),
					operation: "add-collection-item",
					sectionId: snapshot.section.id,
				},
				snapshot,
			})
		).toThrow(WebsiteEditError);
	});

	it("carries nested collections into a newly added parent item and removes them with it", () => {
		const snapshot = createPricingSnapshot();
		const planIds = readCollectionIds({ document: snapshot.document, pointer: "/items" });
		const lastPlan = planIds.at(-1);
		const itemId = entityIdFromSeed({ seed: "nested-edit:new-plan" });
		const removablePlan = planIds[0] ?? "";

		const trimmed = editWebsiteSnapshot({
			input: {
				collection: "/items",
				itemId: removablePlan,
				operation: "delete-collection-item",
				sectionId: snapshot.section.id,
			},
			snapshot,
		});

		expect(readCollectionIds({ document: trimmed.document, pointer: "/items" })).toEqual(planIds.slice(1));
		expect(JSON.stringify(trimmed.document)).not.toContain(removablePlan);

		const added = editWebsiteSnapshot({
			input: { collection: "/items", itemId, operation: "add-collection-item", sectionId: snapshot.section.id },
			snapshot: trimmed,
		});

		const sourceFeatures = readCollectionIds({
			document: trimmed.document,
			pointer: `/items/items/${planIds.at(-1)}/features`,
		});

		const addedFeatures = readCollectionIds({
			document: added.document,
			pointer: `/items/items/${itemId}/features`,
		});

		expect(addedFeatures).toHaveLength(sourceFeatures.length);
		expect(addedFeatures.some((id) => sourceFeatures.includes(id))).toBe(false);

		expect(lastPlan).toBeDefined();

		addedFeatures.forEach((featureId) =>
			expect(JSON.stringify(added.document.structure)).toContain(
				`/items/items/${itemId}/features/items/${featureId}/title`
			)
		);
	});

	describe("composed section category and anchor", () => {
		const specification = {
			content: { ar: { heading: "عنوان" }, en: { heading: "Heading" } },
			structure: {
				nodes: [
					{
						children: ["heading"],
						key: "surface",
						props: {
							padding: { blockEnd: "2rem", blockStart: "2rem", inlineEnd: "1rem", inlineStart: "1rem" },
						},
						type: "box" as const,
					},
					{ children: [], key: "heading", props: { content: "heading" }, type: "text" as const },
				],
				root: "surface",
			},
		};

		const add = ({
			anchor,
			category,
			seed,
			snapshot,
		}: {
			anchor?: string;
			category?: "pricing";
			seed: string;
			snapshot: ReturnType<typeof createSnapshot>;
		}) =>
			editWebsiteSnapshot({
				input: {
					anchor,
					category,
					index: 0,
					operation: "add-composed-section",
					pageId: snapshot.document.structure.pages[0]!.id,
					seed: entityIdFromSeed({ seed }),
					specification,
				},
				snapshot,
			});

		it("defaults to the content category and a unique category anchor", () => {
			const first = add({ seed: "default-one", snapshot: createSnapshot() });
			const second = add({ seed: "default-two", snapshot: first });
			const [newest, previous] = second.document.structure.pages[0]!.sections;

			expect(previous).toMatchObject({ anchor: "content", category: "content" });
			expect(newest).toMatchObject({ anchor: "content-2", category: "content" });
		});

		it("applies the semantic category and de-duplicates the requested anchor", () => {
			const first = add({
				anchor: "pricing-plans",
				category: "pricing",
				seed: "semantic-one",
				snapshot: createSnapshot(),
			});

			const second = add({ anchor: "pricing-plans", category: "pricing", seed: "semantic-two", snapshot: first });
			const sections = second.document.structure.pages[0]!.sections;

			expect(sections.slice(0, 2)).toMatchObject([
				{ anchor: "pricing-plans-2", category: "pricing" },
				{ anchor: "pricing-plans", category: "pricing" },
			]);
		});

		it("rejects invalid anchors and layout categories", () => {
			const pageId = createSnapshot().document.structure.pages[0]!.id;

			const base = {
				index: 0,
				operation: "add-composed-section",
				pageId,
				seed: entityIdFromSeed({ seed: "bad" }),
				specification,
			};

			expect(websiteEditInputSchema.safeParse({ ...base, anchor: "Not Kebab" }).success).toBe(false);
			expect(websiteEditInputSchema.safeParse({ ...base, category: "header" }).success).toBe(false);
			expect(websiteEditInputSchema.safeParse({ ...base, category: "footer" }).success).toBe(false);
		});
	});

	it("builds a neighbourhood preview from the section and its adjacent siblings", () => {
		const snapshot = createSnapshot();
		const page = snapshot.document.structure.pages[0]!;
		const index = Math.min(1, page.sections.length - 1);
		const section = page.sections[index]!;

		const preview = createWebsiteSectionNeighborhoodDocument({
			document: snapshot.document,
			pageId: page.id,
			sectionId: section.id,
		});

		const sections = preview.structure.pages.find(({ id }) => id === page.id)!.sections;

		expect(sections.map(({ id }) => id)).toEqual(
			page.sections.slice(Math.max(0, index - 1), index + 2).map(({ id }) => id)
		);
		expect(preview.structure.layout).toEqual({ footer: [], header: [] });
		expect(Object.keys(preview.content.en?.sections ?? {})).toEqual(sections.map(({ contentId }) => contentId));
		expect(() => parseSiteDocument(preview)).not.toThrow();
	});
});

describe("section background media", () => {
	it.each([
		["banner-compact-background", bannerCompactBackgroundFixtures, 1],
		["banner-diagonal-grid", bannerDiagonalGridFixtures, 0],
	] as const)("lists only full-bleed images directly under the %s root as backgrounds", (pattern, content, count) => {
		const definition = sectionRegistry.get(pattern);

		if (!definition) {
			throw new Error(`Expected the ${pattern} pattern`);
		}

		const { section } = instantiateSection({
			anchor: pattern,
			content,
			createId: ({ kind, path }) => entityIdFromSeed({ seed: `background:${kind}:${path}` }),
			defaultLocale: "en",
			definition,
			path: `/${pattern}`,
		});

		expect(listSectionMediaNodeReferences({ node: section.root }).length).toBeGreaterThan(0);
		expect(listSectionMediaNodeReferences({ backgroundOnly: true, node: section.root })).toHaveLength(count);
	});
});
