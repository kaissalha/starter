"use client";

import { useTheme } from "@wrksz/themes/client";
import { useLocale, useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import { locales } from "@/i18n/routing";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@starter/ui/components/select";

import { SettingsCard } from "./settings-card";

const themeOptions = ["light", "dark", "system"] as const;

export const DisplayTab = () => {
	const t = useTranslations();
	const locale = useLocale();
	const pathname = usePathname();
	const router = useRouter();
	const { setTheme, theme = "system" } = useTheme();
	const selectedTheme = themeOptions.find((option) => option === theme) ?? "system";

	return (
		<div className='flex max-w-3xl flex-col gap-6'>
			<SettingsCard title={t("language.label")}>
				<Select
					onValueChange={(next) =>
						next &&
						next !== locale &&
						router.replace(`${pathname}${window.location.search}`, { locale: next })
					}
					value={locale}
				>
					<SelectTrigger aria-label={t("language.label")} className='w-full max-w-xs'>
						<SelectValue>{t(`language.options.${locale}`)}</SelectValue>
					</SelectTrigger>
					<SelectPopup>
						{locales.map((option) => (
							<SelectItem key={option} value={option}>
								{t(`language.options.${option}`)}
							</SelectItem>
						))}
					</SelectPopup>
				</Select>
			</SettingsCard>
			<SettingsCard title={t("theme.label")}>
				<Select onValueChange={(next) => next && setTheme(next)} value={selectedTheme}>
					<SelectTrigger aria-label={t("theme.label")} className='w-full max-w-xs'>
						<SelectValue>{t(`theme.options.${selectedTheme}`)}</SelectValue>
					</SelectTrigger>
					<SelectPopup>
						{themeOptions.map((option) => (
							<SelectItem key={option} value={option}>
								{t(`theme.options.${option}`)}
							</SelectItem>
						))}
					</SelectPopup>
				</Select>
			</SettingsCard>
		</div>
	);
};
