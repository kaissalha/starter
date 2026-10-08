import {
	linkPageDocumentSchema,
	type LinkPageDocument,
	type LocalizedLinkPageText,
} from "@starter/infinite-links/contracts";

import { translateContentFields } from "./content-translation";

export const translateLinkPageDocument = async ({
	document,
	locale,
	sourceLocale,
}: {
	document: LinkPageDocument;
	locale: string;
	sourceLocale: string;
}) => {
	const fields: Array<LocalizedLinkPageText> = [];

	const collect = (copy: LocalizedLinkPageText) => {
		fields.push(copy);

		return copy;
	};

	const mapCopy = (text: (copy: LocalizedLinkPageText) => LocalizedLinkPageText): LinkPageDocument => ({
		...document,
		blocks: document.blocks.map((block) => {
			if (block.kind === "link") {
				return {
					...block,
					description: block.description ? text(block.description) : undefined,
					label: text(block.label),
				};
			}

			if (block.kind === "header") {
				return { ...block, text: text(block.text) };
			}

			if (block.kind === "text") {
				return {
					...block,
					button: block.button ? { ...block.button, label: text(block.button.label) } : null,
					text: text(block.text),
				};
			}

			if (block.kind === "video") {
				return { ...block, title: text(block.title) };
			}

			if (block.kind === "collection") {
				return {
					...block,
					links: block.links.map((link) => ({
						...link,
						description: link.description ? text(link.description) : undefined,
						label: text(link.label),
					})),
					title: text(block.title),
				};
			}

			return block;
		}),
		profile: { ...document.profile, bio: text(document.profile.bio), title: text(document.profile.title) },
	});

	mapCopy(collect);
	const missing = fields.filter((copy) => !copy[locale]?.trim());

	const translated = await translateContentFields({
		fields: missing.map((copy) => copy[sourceLocale] ?? Object.values(copy).find((value) => value?.trim()) ?? ""),
		locale,
		sourceLocale,
	});

	const values = new Map(missing.map((copy, index) => [copy, translated[index]]));

	return linkPageDocumentSchema.parse(
		mapCopy((copy) => (values.has(copy) ? { ...copy, [locale]: values.get(copy) } : copy))
	);
};
