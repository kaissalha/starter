import { type TranslationKey, type TranslationParams, translations } from "./translations";

type Options = {
	locale?: string;
};

const supportedLocales = ["en"] as const;

export type Locale = (typeof supportedLocales)[number];

export const getI18n = ({ locale = "en" }: Options) => {
	const safeLocale = locale === "en" ? locale : "en";

	return {
		isRtl: false,
		locale: safeLocale,
		t: (key: TranslationKey, params?: TranslationParams) => {
			const translationSet = translations(safeLocale, params);

			return translationSet[key] ?? key;
		},
	};
};
