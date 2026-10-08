import {
	type MarkupComponent,
	parseMarkup,
	type TranslationKey,
	type TranslationParams,
	translations,
} from "./translations";

type Options = {
	locale?: string;
};

const supportedLocales = ["en", "ar"] as const;

export type Locale = (typeof supportedLocales)[number];

export const isSupportedLocale = (value: string | undefined): value is Locale =>
	supportedLocales.some((locale) => locale === value);

export const getI18n = ({ locale = "en" }: Options) => {
	const safeLocale = isSupportedLocale(locale) ? locale : "en";

	return {
		markup: (key: TranslationKey, components: MarkupComponent) => {
			const translationSet = translations(safeLocale);
			const message = translationSet[key] ?? key;

			return parseMarkup(message, components);
		},
		t: (key: TranslationKey, params?: TranslationParams) => {
			const translationSet = translations(safeLocale, params);

			return translationSet[key] ?? key;
		},
	};
};
