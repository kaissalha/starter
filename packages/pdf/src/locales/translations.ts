import { type MessageKey, type NestedMessages, translateMessages } from "@starter/utils";

import type { Locale } from ".";
import enMessages from "./messages/en.json";

export type TranslationParams = {
	[key: string]: string | number | undefined;
};

export type TranslationKey = MessageKey<typeof enMessages>;

const localeMessages = {
	en: enMessages,
} satisfies Record<Locale, NestedMessages>;

export const translations = (locale: Locale, params?: TranslationParams) =>
	translateMessages({ fallback: localeMessages.en, messages: localeMessages[locale], params });
