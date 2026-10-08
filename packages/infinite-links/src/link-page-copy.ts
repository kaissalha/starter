import type { BrandFoundationV1 } from "@starter/infinite-brand";

import {
	type LinkPageBlock,
	type LinkPageBlockKind,
	type LinkPageDocument,
	type LinkPageLink,
	type LinkPageLocale,
	type LocalizedLinkPageText,
} from "./contracts";
import { resolveLinkPageEmbed, resolveYouTubeVideoId, type LinkPageEmbed } from "./link-page-embeds";

const hasText = (value: string | undefined): value is string => value !== undefined && value.trim().length > 0;

const resolveLocalizedLinkPageText = ({
	copy,
	defaultLocale,
	locale,
}: {
	copy: LocalizedLinkPageText;
	defaultLocale: string;
	locale: string;
}) => {
	const candidates = [copy[locale], copy[defaultLocale], ...Object.values(copy)];

	return candidates.find(hasText)?.trim() ?? "";
};

type BlockOfKind<Kind extends LinkPageBlockKind> = Extract<LinkPageBlock, { kind: Kind }>;

type Localize<Block, Keys extends keyof Block> = Omit<Block, Keys> & Record<Keys, string>;

type LocalizeItems<Block extends { items: Array<unknown> }, Keys extends keyof Block["items"][number]> = Omit<
	Block,
	"items"
> & { items: Array<Localize<Block["items"][number], Keys>> };

export type ResolvedLinkPageLink = Omit<LinkPageLink, "badge" | "cta" | "description" | "label"> & {
	badge?: string;
	cta?: string;
	description?: string;
	label: string;
};

export type ResolvedLinkPageBlock =
	| ResolvedLinkPageLink
	| Localize<BlockOfKind<"header">, "text">
	| (Omit<BlockOfKind<"text">, "button" | "text"> & { button: { label: string; url: string } | null; text: string })
	| BlockOfKind<"socials">
	| (Localize<BlockOfKind<"video">, "title"> & { videoId: string })
	| (Omit<BlockOfKind<"collection">, "links" | "title"> & { links: Array<ResolvedLinkPageLink>; title: string })
	| LocalizeItems<BlockOfKind<"tabs">, "label">
	| (Localize<BlockOfKind<"embed">, "title"> & { embed: LinkPageEmbed | null })
	| (Omit<BlockOfKind<"form">, "description" | "fields" | "submitLabel" | "title"> & {
			description: string;
			fields: Array<Localize<BlockOfKind<"form">["fields"][number], "label">>;
			submitLabel: string;
			title: string;
	  })
	| Localize<BlockOfKind<"marquee">, "text">
	| (Omit<BlockOfKind<"announcement">, "button" | "description" | "title"> & {
			button: { label: string; url: string } | null;
			description: string;
			title: string;
	  })
	| Localize<LocalizeItems<BlockOfKind<"faq">, "answer" | "question">, "description" | "title">
	| Localize<LocalizeItems<BlockOfKind<"testimonials">, "company" | "name" | "quote">, "description" | "title">
	| Localize<BlockOfKind<"countdown">, "description" | "endedMessage" | "title">;

export const resolveLinkPageCopy = ({
	brand,
	document,
	locale,
}: {
	brand: BrandFoundationV1;
	document: LinkPageDocument;
	locale: LinkPageLocale;
}) => {
	const text = (copy: LocalizedLinkPageText) =>
		resolveLocalizedLinkPageText({ copy, defaultLocale: brand.defaultLocale, locale });

	const resolveLink = (link: LinkPageLink): ResolvedLinkPageLink => ({
		...link,
		badge: link.badge ? text(link.badge) : undefined,
		cta: link.cta ? text(link.cta) : undefined,
		description: link.description ? text(link.description) : undefined,
		label: text(link.label),
	});

	const button = (value: { label: LocalizedLinkPageText; url: string } | null) =>
		value ? { label: text(value.label), url: value.url } : null;

	const resolveBlock = (block: LinkPageBlock): ResolvedLinkPageBlock => {
		switch (block.kind) {
			case "announcement":
				return {
					...block,
					button: button(block.button),
					description: text(block.description),
					title: text(block.title),
				};
			case "collection":
				return { ...block, links: block.links.map(resolveLink), title: text(block.title) };
			case "countdown":
				return {
					...block,
					description: text(block.description),
					endedMessage: text(block.endedMessage),
					title: text(block.title),
				};
			case "embed":
				return { ...block, embed: resolveLinkPageEmbed(block.url), title: text(block.title) };
			case "faq":
				return {
					...block,
					description: text(block.description),
					items: block.items.map((item) => ({
						...item,
						answer: text(item.answer),
						question: text(item.question),
					})),
					title: text(block.title),
				};
			case "form":
				return {
					...block,
					description: text(block.description),
					fields: block.fields.map((field) => ({ ...field, label: text(field.label) })),
					submitLabel: text(block.submitLabel),
					title: text(block.title),
				};
			case "header":
				return { ...block, text: text(block.text) };
			case "link":
				return resolveLink(block);
			case "marquee":
				return { ...block, text: text(block.text) };
			case "socials":
				return block;
			case "tabs":
				return { ...block, items: block.items.map((item) => ({ ...item, label: text(item.label) })) };
			case "testimonials":
				return {
					...block,
					description: text(block.description),
					items: block.items.map((item) => ({
						...item,
						company: text(item.company),
						name: text(item.name),
						quote: text(item.quote),
					})),
					title: text(block.title),
				};
			case "text":
				return { ...block, button: button(block.button), text: text(block.text) };
			case "video":
				return { ...block, title: text(block.title), videoId: resolveYouTubeVideoId(block.url) ?? "" };
		}
	};

	return {
		bio: text(document.profile.bio),
		blocks: document.blocks.map(resolveBlock),
		tagline: text(document.profile.tagline ?? {}),
		title: text(document.profile.title),
	};
};
