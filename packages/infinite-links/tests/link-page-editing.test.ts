import { describe, expect, it } from "vitest";

import {
	createDefaultLinkPageDocument,
	defaultLinkPageSectionAppearance,
	linkPageLimits,
	type LinkPageDocument,
	type LinkPageLink,
} from "../src";
import { blockOperations, collectionOperations, socialOperations } from "../src/link-page-editing";

const createLink = (id: string): LinkPageLink => ({
	appearance: defaultLinkPageSectionAppearance,
	enabled: true,
	id,
	kind: "link",
	label: { en: id },
	layout: "classic",
	url: "https://example.com",
});

const withBlocks = (ids: Array<string>): LinkPageDocument => ({
	...createDefaultLinkPageDocument({ name: "Studio" }),
	blocks: ids.map(createLink),
});

const blockIds = (document: LinkPageDocument) => document.blocks.map(({ id }) => id);

describe("link page editing", () => {
	it("moves blocks by offset and to an absolute index", () => {
		const document = withBlocks(["a", "b", "c"]);

		expect(blockIds(blockOperations.move(document, "c", -1))).toEqual(["a", "c", "b"]);
		expect(blockIds(blockOperations.moveTo(document, "a", 2))).toEqual(["b", "c", "a"]);
		expect(blockOperations.moveTo(document, "missing", 0)).toBe(document);
	});

	it("returns the same document when an add would exceed a limit", () => {
		const full = withBlocks(Array.from({ length: linkPageLimits.blocks }, (_, index) => `block-${index}`));

		expect(blockOperations.add(full, createLink("extra"))).toBe(full);
	});

	it("caps collection links and socials", () => {
		const collection = {
			appearance: defaultLinkPageSectionAppearance,
			display: "stack" as const,
			enabled: true,
			id: "collection",
			kind: "collection" as const,
			links: Array.from({ length: linkPageLimits.collectionLinks }, (_, index) => createLink(`link-${index}`)),
			title: {},
		};

		const socials = {
			appearance: defaultLinkPageSectionAppearance,
			enabled: true,
			id: "socials",
			items: [],
			kind: "socials" as const,
		};

		const document = { ...withBlocks([]), blocks: [collection, socials] };

		expect(collectionOperations.addLink(document, "collection", createLink("extra"))).toBe(document);
		expect(
			socialOperations.add(document, "socials", { id: "s", platform: "instagram", url: "https://instagram.com" })
				.blocks[1]
		).toMatchObject({ items: [{ id: "s" }] });
	});

	it("removes collection links from the header and redirect when a block is removed", () => {
		const collection = {
			appearance: defaultLinkPageSectionAppearance,
			display: "stack" as const,
			enabled: true,
			id: "collection",
			kind: "collection" as const,
			links: [createLink("inner")],
			title: {},
		};

		const document = {
			...withBlocks([]),
			blocks: [collection],
			headerBlockIds: ["collection"],
			redirectBlockId: "inner",
		};

		expect(blockOperations.remove(document, "collection")).toMatchObject({
			blocks: [],
			headerBlockIds: [],
			redirectBlockId: null,
		});
	});
});
