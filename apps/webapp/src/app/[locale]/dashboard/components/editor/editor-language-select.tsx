"use client";

import { useLocale, useTranslations } from "next-intl";
import { useQueryState } from "nuqs";

import {
	Select,
	SelectGroup,
	SelectGroupLabel,
	SelectItem,
	SelectPopup,
	SelectSeparator,
	SelectTrigger,
} from "@starter/ui/components/select";

import { MainLanguageIndicator } from "./main-language-indicator";

const getLanguageFlag = (locale: string) => {
	const region = locale === "ar" ? "SA" : new Intl.Locale(locale).maximize().region;

	return region && /^[A-Z]{2}$/u.test(region)
		? String.fromCodePoint(...[...region].map((character) => 127_397 + character.charCodeAt(0)))
		: "🌐";
};

export const EditorLanguageSelect = <Locale extends string>({
	allowAddLanguage,
	defaultLocale,
	disabled,
	locale,
	locales,
	onLocaleChange,
}: {
	allowAddLanguage?: boolean;
	defaultLocale?: string;
	disabled?: boolean;
	locale: Locale;
	locales: Array<Locale>;
	onLocaleChange: (locale: Locale) => void;
}) => {
	const t = useTranslations("website.languages");
	const [, setSettingsTab] = useQueryState("websiteSettings");
	const uiLocale = useLocale();
	const languageNames = new Intl.DisplayNames([uiLocale], { type: "language" });
	const selectedLanguage = languageNames.of(locale) ?? locale.toUpperCase();

	return (
		<Select
			disabled={disabled}
			onValueChange={(value) => {
				if (value === "add-languages") {
					setSettingsTab("languages");

					return;
				}

				const nextLocale = locales.find((candidate) => candidate === value);

				if (nextLocale) {
					onLocaleChange(nextLocale);
				}
			}}
			value={locale}
		>
			<SelectTrigger
				aria-label={`${t("label")}: ${selectedLanguage}`}
				className='md:max-w-48'
				iconOnMobile
				size='default'
				variant='subtle'
			>
				<span aria-hidden='true' className='shrink-0 text-base leading-none md:hidden'>
					{getLanguageFlag(locale)}
				</span>
				<span className='hidden shrink-0 text-muted-foreground md:inline'>{t("label")}:</span>
				<span className='hidden truncate md:inline'>{selectedLanguage}</span>
			</SelectTrigger>
			<SelectPopup className='min-w-56' sideOffset={6}>
				<SelectGroup>
					<SelectGroupLabel>{t("label")}</SelectGroupLabel>
					{locales.map((candidate) => (
						<SelectItem key={candidate} value={candidate}>
							<span className='flex items-center gap-2'>
								<span aria-hidden='true'>{getLanguageFlag(candidate)}</span>
								<span>{languageNames.of(candidate) ?? candidate.toUpperCase()}</span>
								{candidate === defaultLocale && <MainLanguageIndicator />}
							</span>
						</SelectItem>
					))}
				</SelectGroup>
				{allowAddLanguage && (
					<>
						<SelectSeparator className='-mx-1' />
						<SelectItem value='add-languages'>{t("addLanguages")}</SelectItem>
					</>
				)}
			</SelectPopup>
		</Select>
	);
};
