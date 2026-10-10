import { cloneElement, createElement, Fragment, isValidElement, type ReactNode } from "react";

import { type MessageKey, type NestedMessages, translateMessages } from "@starter/utils";

import type { Locale } from ".";
import arMessages from "./messages/ar.json";
import enMessages from "./messages/en.json";

export type TranslationParams = {
	[key: string]: string | number | null | undefined;
};

export type MarkupComponent = {
	[key: string]: (chunks: ReactNode) => ReactNode;
};

const withStableMarkupKey = ({ key, node }: { key: string; node: ReactNode }) => {
	if (isValidElement(node)) {
		return cloneElement(node, {
			key,
		});
	}

	return createElement(Fragment, { key }, node);
};

export type TranslationKey = MessageKey<typeof enMessages>;

const localeMessages = {
	ar: arMessages,
	en: enMessages,
} satisfies Record<Locale, NestedMessages>;

export const parseMarkup = (message: string, components: MarkupComponent): ReactNode => {
	if (!message) {
		return message;
	}

	const tagPattern = /<([a-zA-Z0-9_]+)\s*\/>|<([a-zA-Z0-9_]+)>(.*?)<\/\2>/gs;

	const matches = [...message.matchAll(tagPattern)];

	if (matches.length === 0) {
		return message;
	}

	const result: Array<ReactNode> = [];
	const lastIndexReference = { value: 0 };

	matches.forEach((match) => {
		const [fullMatch, selfClosingTagName, pairedTagName, content = ""] = match;
		const startIndex: number = match.index;
		const tagName = selfClosingTagName ?? pairedTagName;

		if (startIndex > lastIndexReference.value) {
			result.push(message.slice(lastIndexReference.value, startIndex));
		}

		const processedContent = content ? parseMarkup(content, components) : null;

		if (components[tagName]) {
			result.push(
				withStableMarkupKey({
					key: `markup-${startIndex}`,
					node: components[tagName](processedContent),
				})
			);
		} else {
			result.push(processedContent);
		}

		lastIndexReference.value = startIndex + fullMatch.length;
	});

	if (lastIndexReference.value < message.length) {
		result.push(message.slice(lastIndexReference.value));
	}

	return result.length === 1 ? result[0] : result;
};

export const translations = (locale: Locale, params?: TranslationParams) =>
	Object.fromEntries(
		Object.entries(
			translateMessages({ fallback: localeMessages.en, messages: localeMessages[locale], params })
		).map(([key, message]) => [key, message.replaceAll("\n", "<br />")])
	);
