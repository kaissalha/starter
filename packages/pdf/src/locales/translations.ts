import { flattenMessages, interpolateMessage, type NestedMessages } from "@starter/utils";

import type { Locale } from ".";
import enMessages from "./messages/en.json";

export type TranslationParams = {
	[key: string]: string | number | undefined;
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
	en: enMessages,
} satisfies Record<Locale, NestedMessages>;

export const translations = (locale: Locale, params?: TranslationParams) => {
	const messages = flattenMessages({ messages: localeMessages[locale] });
	const englishMessages = flattenMessages({ messages: localeMessages.en });
	const translationSet: Record<string, string> = {};

	Object.keys(englishMessages).forEach((key) => {
		const message = messages[key] || englishMessages[key];

		if (message) {
			const interpolated = interpolateMessage({ message, params });
			translationSet[key] = interpolated;
		}
	});

	return translationSet;
};
