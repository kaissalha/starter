import type { BrandUpdate } from "@starter/infinite-brand";

import {
	defaultLinkPageAppearance,
	linkPageLimits,
	type LinkPageAppearance,
	type LinkPageBlock,
	type LinkPageBlockKind,
	type LinkPageDocument,
	type LinkPageLink,
	type LinkPageProfile,
	type LinkPageSocial,
} from "./contracts";

const isBlockOfKind = <Kind extends LinkPageBlockKind>(
	block: LinkPageBlock,
	kind: Kind
): block is Extract<LinkPageBlock, { kind: Kind }> => block.kind === kind;

const reorderBy = <Item extends { id: string }>(items: Array<Item>, orderedIds: Array<string>) => {
	const byId = new Map(items.map((item) => [item.id, item]));

	const ordered = orderedIds.flatMap((id) => {
		const item = byId.get(id);

		return item ? [item] : [];
	});

	return ordered.length === items.length ? ordered : items;
};

const moveBy = <Item>(items: Array<Item>, index: number, offset: -1 | 1) => {
	const target = index + offset;

	if (index < 0 || target < 0 || target >= items.length) {
		return items;
	}

	const next = [...items];
	const [item] = next.splice(index, 1);

	if (item === undefined) {
		return items;
	}

	next.splice(target, 0, item);

	return next;
};

const insertAt = (document: LinkPageDocument, block: LinkPageBlock, index: number): LinkPageDocument => {
	const target = Math.min(Math.max(index, 0), document.blocks.length);

	return withBlocks(document, [...document.blocks.slice(0, target), block, ...document.blocks.slice(target)]);
};

const withBlocks = (document: LinkPageDocument, blocks: Array<LinkPageBlock>): LinkPageDocument => ({
	...document,
	blocks,
});

const withoutHeaderLinks = (document: LinkPageDocument, ids: Array<string>): LinkPageDocument => ({
	...document,
	headerBlockIds: document.headerBlockIds.filter((id) => !ids.includes(id)),
});

const withoutRedirect = (document: LinkPageDocument, ids: Array<string>) =>
	document.redirectBlockId && ids.includes(document.redirectBlockId)
		? { ...document, redirectBlockId: null }
		: document;

export const blockOperations = {
	add: (
		document: LinkPageDocument,
		block: LinkPageBlock,
		index = document.blocks.length,
		placement: "header" | "page" = "page"
	) => {
		const contentBlockCount = document.blocks.filter((candidate) => candidate.kind !== "socials").length;

		if (
			(block.kind !== "socials" && contentBlockCount >= linkPageLimits.blocks) ||
			(block.kind === "socials" && document.blocks.some((candidate) => candidate.kind === "socials"))
		) {
			return document;
		}

		const next = insertAt(document, block, index);

		return placement === "header" ? { ...next, headerBlockIds: [...next.headerBlockIds, block.id] } : next;
	},
	move: (document: LinkPageDocument, id: string, offset: -1 | 1) => {
		const headerBlockIds = new Set(document.headerBlockIds);
		const inHeader = headerBlockIds.has(id);
		const sectionBlocks = document.blocks.filter((block) => headerBlockIds.has(block.id) === inHeader);

		const movedBlocks = moveBy(
			sectionBlocks,
			sectionBlocks.findIndex((block) => block.id === id),
			offset
		);

		if (movedBlocks === sectionBlocks) {
			return document;
		}

		const movedBySlot = new Map(sectionBlocks.map((block, index) => [block.id, movedBlocks[index]]));

		return withBlocks(
			document,
			document.blocks.map((block) => movedBySlot.get(block.id) ?? block)
		);
	},
	moveTo: (document: LinkPageDocument, id: string, index: number) => {
		const block = document.blocks.find((candidate) => candidate.id === id);

		return block
			? insertAt(
					withBlocks(
						document,
						document.blocks.filter((candidate) => candidate.id !== id)
					),
					block,
					index
				)
			: document;
	},
	patch: (document: LinkPageDocument, id: string, update: (block: LinkPageBlock) => LinkPageBlock) =>
		withBlocks(
			document,
			document.blocks.map((block) => (block.id === id ? update(block) : block))
		),
	remove: (document: LinkPageDocument, id: string) => {
		const removed = document.blocks.find((block) => block.id === id);

		const removedIds = removed
			? [removed.id, ...(removed.kind === "collection" ? removed.links.map((link) => link.id) : [])]
			: [];

		return withoutHeaderLinks(
			withoutRedirect(
				withBlocks(
					document,
					document.blocks.filter((block) => block.id !== id)
				),
				removedIds
			),
			removedIds
		);
	},
	setHeaderLinked: (document: LinkPageDocument, id: string, linked: boolean): LinkPageDocument => {
		if (!document.blocks.some((block) => block.id === id)) {
			return document;
		}

		const headerBlockIds = linked
			? [...new Set([...document.headerBlockIds, id])]
			: document.headerBlockIds.filter((blockId) => blockId !== id);

		return { ...document, headerBlockIds };
	},
	update: <Kind extends LinkPageBlockKind>(
		document: LinkPageDocument,
		id: string,
		kind: Kind,
		update: (block: Extract<LinkPageBlock, { kind: Kind }>) => LinkPageBlock
	) =>
		withBlocks(
			document,
			document.blocks.map((block) => (block.id === id && isBlockOfKind(block, kind) ? update(block) : block))
		),
};

const findBlock = <Kind extends LinkPageBlockKind>(document: LinkPageDocument, id: string, kind: Kind) =>
	document.blocks.find(
		(block): block is Extract<LinkPageBlock, { kind: Kind }> => block.id === id && isBlockOfKind(block, kind)
	);

const updateCollectionLinks = (
	document: LinkPageDocument,
	collectionId: string,
	update: (links: Array<LinkPageLink>) => Array<LinkPageLink>
) =>
	blockOperations.update(document, collectionId, "collection", (block) => ({ ...block, links: update(block.links) }));

export const collectionOperations = {
	addLink: (document: LinkPageDocument, collectionId: string, link: LinkPageLink) =>
		(findBlock(document, collectionId, "collection")?.links.length ?? linkPageLimits.collectionLinks) >=
		linkPageLimits.collectionLinks
			? document
			: updateCollectionLinks(document, collectionId, (links) => [...links, link]),
	removeLink: (document: LinkPageDocument, collectionId: string, linkId: string) =>
		withoutRedirect(
			updateCollectionLinks(document, collectionId, (links) => links.filter((link) => link.id !== linkId)),
			[linkId]
		),
	reorderLinks: (document: LinkPageDocument, collectionId: string, orderedIds: Array<string>) =>
		updateCollectionLinks(document, collectionId, (links) => reorderBy(links, orderedIds)),
	updateLink: (
		document: LinkPageDocument,
		collectionId: string,
		linkId: string,
		update: (link: LinkPageLink) => LinkPageLink
	) =>
		updateCollectionLinks(document, collectionId, (links) =>
			links.map((link) => (link.id === linkId ? update(link) : link))
		),
};

const updateSocials = (
	document: LinkPageDocument,
	blockId: string,
	update: (items: Array<LinkPageSocial>) => Array<LinkPageSocial>
) => blockOperations.update(document, blockId, "socials", (block) => ({ ...block, items: update(block.items) }));

export const socialOperations = {
	add: (document: LinkPageDocument, blockId: string, social: LinkPageSocial): LinkPageDocument =>
		(findBlock(document, blockId, "socials")?.items.length ?? linkPageLimits.socials) >= linkPageLimits.socials
			? document
			: updateSocials(document, blockId, (items) => [...items, social]),
	remove: (document: LinkPageDocument, blockId: string, id: string): LinkPageDocument =>
		updateSocials(document, blockId, (items) => items.filter((social) => social.id !== id)),
	reorder: (document: LinkPageDocument, blockId: string, orderedIds: Array<string>): LinkPageDocument =>
		updateSocials(document, blockId, (items) => reorderBy(items, orderedIds)),
	update: (
		document: LinkPageDocument,
		blockId: string,
		id: string,
		update: (social: LinkPageSocial) => LinkPageSocial
	): LinkPageDocument =>
		updateSocials(document, blockId, (items) =>
			items.map((social) => (social.id === id ? update(social) : social))
		),
};

const withAppearance = (
	document: LinkPageDocument,
	update: (appearance: LinkPageAppearance) => LinkPageAppearance
): LinkPageDocument => ({ ...document, appearance: update(document.appearance) });

export const appearanceOperations = {
	brandOverride: (document: LinkPageDocument, brandOverride: BrandUpdate | null) =>
		withAppearance(document, (appearance) => ({ ...appearance, brandOverride, themeId: null })),
	buttonColors: (document: LinkPageDocument, colors: Partial<LinkPageAppearance["buttons"]["colors"]>) =>
		withAppearance(document, (appearance) => ({
			...appearance,
			buttons: { ...appearance.buttons, colors: { ...appearance.buttons.colors, ...colors } },
			themeId: null,
		})),
	buttons: (document: LinkPageDocument, buttons: Partial<Omit<LinkPageAppearance["buttons"], "colors">>) =>
		withAppearance(document, (appearance) => ({
			...appearance,
			buttons: { ...appearance.buttons, ...buttons },
			themeId: null,
		})),
	patch: (
		document: LinkPageDocument,
		update: Partial<Omit<LinkPageAppearance, "brandOverride" | "buttons" | "wallpaper">>
	) => withAppearance(document, (appearance) => ({ ...appearance, ...update })),
	profile: (document: LinkPageDocument, update: Partial<LinkPageProfile>): LinkPageDocument => ({
		...document,
		profile: { ...document.profile, ...update },
	}),
	redirect: (document: LinkPageDocument, blockId: string | null): LinkPageDocument => ({
		...document,
		redirectBlockId: blockId,
	}),
	resetToBrand: (document: LinkPageDocument) => withAppearance(document, () => defaultLinkPageAppearance),
	wallpaper: (document: LinkPageDocument, wallpaper: Partial<LinkPageAppearance["wallpaper"]>) =>
		withAppearance(document, (appearance) => ({
			...appearance,
			themeId: null,
			wallpaper: { ...appearance.wallpaper, ...wallpaper },
		})),
};
