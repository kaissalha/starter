import { cloneElement, createElement, Fragment, isValidElement, type ReactNode } from "react";

import { flattenMessages, interpolateMessage, type NestedMessages } from "@starter/utils";

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

type Join<K, P> = K extends string | number
	? P extends string | number
		? `${K}${P extends "" ? "" : "."}${P}`
		: never
	: never;

type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ...Array<0>];

type Paths<T, D extends number = 10> = [D] extends [never]
	? never
	: T extends object
		? {
				[K in keyof T]-?: K extends string | number ? `${K}` | Join<K, Paths<T[K], Prev[D]>> : never;
			}[keyof T]
		: "";

export type TranslationKey = Paths<typeof enMessages>;

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

export const translations = (locale: Locale, params?: TranslationParams) => {
	const messages = flattenMessages({ messages: localeMessages[locale] });
	const englishMessages = flattenMessages({ messages: localeMessages.en });
	const translationSet: Record<string, string> = {};

	Object.keys(englishMessages).forEach((key) => {
		const message = messages[key] || englishMessages[key];

		if (message) {
			const interpolated = interpolateMessage({ message, params });
			translationSet[key] = interpolated.replaceAll("\n", "<br />");
		}
	});

	return translationSet;
};
