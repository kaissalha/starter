import {
	getBlogTranslationSource,
	setBlogLocaleContent,
	type BlogNode,
	type BlogPostDocument,
	type Iso6391LanguageCode,
} from "@starter/infinite-website/contracts";

import { translateContentFields } from "../content-translation";

export const translateBlogDocument = async ({
	document,
	locale,
}: {
	document: BlogPostDocument;
	locale: Iso6391LanguageCode;
}) => {
	const source = getBlogTranslationSource(document);

	if (!source) {
		throw new Error("Write a source title and article before translating.");
	}

	const fields = [source.title, source.excerpt, source.seoTitle, source.seoDescription, source.coverAlt];

	const visit = (node: BlogNode): void => {
		if (node.type === "text") {
			fields.push(node.text);
		}

		if (node.type === "image") {
			fields.push(node.attrs.alt ?? "");
		}

		if ("content" in node) {
			node.content?.forEach(visit);
		}
	};

	source.body.content.forEach(visit);
	const translated = await translateContentFields({ fields, locale, sourceLocale: "auto" });
	const cursor = { index: 5 };
	const text = () => translated[cursor.index++]!;

	const localize = (node: BlogNode): BlogNode => {
		if (node.type === "text") {
			return { ...node, text: text() };
		}

		if (node.type === "image") {
			return { ...node, attrs: { ...node.attrs, alt: text() } };
		}

		return "content" in node && node.content ? { ...node, content: node.content.map(localize) } : node;
	};

	return setBlogLocaleContent({
		content: {
			body: { ...source.body, content: source.body.content.map(localize) },
			coverAlt: translated[4]!,
			excerpt: translated[1]!,
			seoDescription: translated[3]!,
			seoTitle: translated[2]!,
			title: translated[0]!,
		},
		document,
		locale,
	});
};
