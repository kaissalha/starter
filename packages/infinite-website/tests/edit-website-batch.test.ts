import { beforeEach, describe, expect, it, vi } from "vitest";

import { entityIdFromSeed, instantiateTemplate } from "@starter/infinite-website";
import {
	editWebsiteSnapshot,
	editWebsiteSnapshots,
	WebsiteEditError,
	type WebsiteEditInput,
} from "@starter/infinite-website/editing";
import { nordicEdgeTemplate } from "@starter/infinite-website/templates/nordic-edge";
import nordicEdgeContent from "@starter/infinite-website/templates/nordic-edge/content";

import { testBrand } from "./fixtures/brand";

const validation = vi.hoisted(() => ({ count: 0 }));

vi.mock("../src/document/document-validation", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../src/document/document-validation")>();

	return {
		...actual,
		parseSiteDocument: (...args: Parameters<typeof actual.parseSiteDocument>) => {
			validation.count += 1;

			return actual.parseSiteDocument(...args);
		},
	};
});

const createSnapshot = () => ({
	assets: {},
	brand: testBrand,
	document: instantiateTemplate({
		content: nordicEdgeContent,
		createId: ({ kind, path }) => entityIdFromSeed({ seed: `edit-website-batch:${kind}:${path}` }),
		definition: nordicEdgeTemplate,
		path: "/edit-website-batch",
	}),
	schemaVersion: 1 as const,
	templateId: "nordic-edge",
});

const getTextEditTarget = (snapshot: ReturnType<typeof createSnapshot>) => {
	const page = snapshot.document.structure.pages[0];
	const section = page?.sections[0];
	const pointer = JSON.stringify(section?.root).match(/"\$text":"([^"]+)"/u)?.[1];

	if (!page || !section || !pointer) {
		throw new Error("Expected an editable text target");
	}

	return { page, pointer, section };
};

describe("website edit batches", () => {
	beforeEach(() => {
		validation.count = 0;
	});

	it("matches sequential edits with one canonical document validation", () => {
		const snapshot = createSnapshot();
		const { page, pointer, section } = getTextEditTarget(snapshot);

		const inputs: Array<WebsiteEditInput> = Array.from({ length: 8 }, (_, index) => ({
			locale: index % 2 === 0 ? "en" : "ar",
			operation: "update-text",
			pageId: page.id,
			pointer,
			sectionId: section.id,
			value: `Atomic copy ${index}`,
		}));

		validation.count = 0;
		const batched = editWebsiteSnapshots({ inputs, snapshot });
		expect(validation.count).toBe(1);

		validation.count = 0;

		const sequential = inputs.reduce(
			(current, input) => editWebsiteSnapshot({ input, snapshot: current }),
			snapshot
		);

		expect(validation.count).toBe(inputs.length);
		expect(batched).toEqual(sequential);
	});

	it("canonically validates a brand-only batch once", () => {
		const snapshot = createSnapshot();

		validation.count = 0;

		const edited = editWebsiteSnapshots({
			inputs: [
				{
					brand: { ...snapshot.brand, corners: { style: "soft" } },
					operation: "update-brand",
				},
			],
			snapshot,
		});

		expect(validation.count).toBe(1);
		expect(edited.brand.corners.style).toBe("soft");
		expect(edited.document).toEqual(snapshot.document);
	});

	it("fails operation-local checks before canonical document validation", () => {
		const snapshot = createSnapshot();
		const original = structuredClone(snapshot);
		const { page, pointer, section } = getTextEditTarget(snapshot);

		validation.count = 0;
		expect(() =>
			editWebsiteSnapshots({
				inputs: [
					{
						locale: "en",
						operation: "update-text",
						pageId: page.id,
						pointer,
						sectionId: section.id,
						value: "Valid first edit",
					},
					{
						locale: "en",
						operation: "update-text",
						pageId: page.id,
						pointer: "/copy/not-used",
						sectionId: section.id,
						value: "Invalid second edit",
					},
				],
				snapshot,
			})
		).toThrow(WebsiteEditError);

		expect(validation.count).toBe(0);
		expect(snapshot).toEqual(original);
	});

	it("rejects the completed draft through one final canonical validation", () => {
		const snapshot = createSnapshot();
		const page = snapshot.document.structure.pages[0];
		const section = page?.sections[0];

		if (!page || !section) {
			throw new Error("Expected an editable section");
		}

		const root = structuredClone(section.root);
		const firstChild = root.props.children[0];

		if (!firstChild) {
			throw new Error("Expected a section child");
		}

		firstChild.id = root.id;

		validation.count = 0;
		expect(() =>
			editWebsiteSnapshots({
				inputs: [
					{
						brand: { ...snapshot.brand, corners: { style: "soft" } },
						operation: "update-brand",
					},
					{
						operation: "replace-section-root",
						pageId: page.id,
						root,
						sectionId: section.id,
					},
				],
				snapshot,
			})
		).toThrow(WebsiteEditError);

		expect(validation.count).toBe(1);
	});
});
