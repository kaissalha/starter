"use client";

import { LanguagesIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLocale, useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import { locales } from "@/i18n/routing";
import { Button } from "@starter/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@starter/ui/components/dropdown-menu";

export const LocaleSwitcher = () => {
	const t = useTranslations("language");
	const locale = useLocale();
	const pathname = usePathname();
	const router = useRouter();
	const currentLanguage = locale === "ar" ? t("options.ar") : t("options.en");

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				aria-label={t("current", { language: currentLanguage })}
				render={<Button size='sm' variant='ghost' />}
			>
				<HugeiconsIcon aria-hidden='true' className='scale-110' icon={LanguagesIcon} strokeWidth={1.75} />
				{currentLanguage}
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end' aria-label={t("label")}>
				<DropdownMenuRadioGroup value={locale}>
					{locales.map((option) => (
						<DropdownMenuRadioItem
							closeOnClick
							key={option}
							onClick={() =>
								option !== locale &&
								router.replace(`${pathname}${window.location.search}`, { locale: option })
							}
							value={option}
						>
							{t(`options.${option}`)}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
