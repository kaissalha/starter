import { iso6391LanguageCodes, type Iso6391LanguageCode } from "../language-codes";

export type WebsiteLocalizations<T> = {
	byLocale: Partial<Record<Iso6391LanguageCode, T>>;
	defaultLocale: Iso6391LanguageCode;
};

export const listWebsiteLocalizations = <T>({ localizations }: { localizations: WebsiteLocalizations<T> }) =>
	[
		localizations.defaultLocale,
		...iso6391LanguageCodes.filter((locale) => locale !== localizations.defaultLocale),
	].flatMap((locale) => {
		const value = localizations.byLocale[locale];

		return value === undefined ? [] : [{ locale, value }];
	});

export const readDefaultWebsiteLocalization = <T>({ localizations }: { localizations: WebsiteLocalizations<T> }) => {
	const value = localizations.byLocale[localizations.defaultLocale];

	if (value === undefined) {
		throw new Error(`Website localizations are missing the default locale "${localizations.defaultLocale}"`);
	}

	return value;
};
