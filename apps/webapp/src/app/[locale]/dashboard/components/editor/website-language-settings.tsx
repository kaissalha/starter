"use client";

import { useState } from "react";

import { useLocale, useTranslations } from "next-intl";

import type { Iso6391LanguageCode } from "@starter/infinite-website";
import { Badge } from "@starter/ui/components/badge";
import { Button } from "@starter/ui/components/button";

import { ConfirmDestructiveEdit } from "./confirm-destructive-edit";
import { MainLanguageIndicator } from "./main-language-indicator";
import type { useWebsiteLanguages } from "./use-website-languages";

const editorLanguages: Array<Iso6391LanguageCode> = [
	"bg",
	"hr",
	"et",
	"ga",
	"lv",
	"lt",
	"mt",
	"sk",
	"sl",
	"sq",
	"bs",
	"sr",
	"ar",
	"bn",
	"zh",
	"cs",
	"da",
	"nl",
	"en",
	"fi",
	"fr",
	"de",
	"el",
	"he",
	"hi",
	"hu",
	"id",
	"it",
	"ja",
	"ko",
	"ms",
	"no",
	"fa",
	"pl",
	"pt",
	"ro",
	"ru",
	"es",
	"sv",
	"th",
	"tr",
	"uk",
	"ur",
	"vi",
];

export const WebsiteLanguageSettings = ({
	controller,
	onAddLanguage,
}: {
	controller: ReturnType<typeof useWebsiteLanguages>;
	onAddLanguage?: (locale: Iso6391LanguageCode) => Promise<boolean | void>;
}) => {
	const t = useTranslations("website.languages");
	const uiLocale = useLocale();
	const [adding, setAdding] = useState(false);
	const [working, setWorking] = useState<Iso6391LanguageCode>();
	const [failed, setFailed] = useState<Iso6391LanguageCode>();
	const [removing, setRemoving] = useState<Iso6391LanguageCode>();
	const names = new Intl.DisplayNames([uiLocale], { type: "language" });
	const document = controller.document;

	if (!document) {
		return null;
	}

	const add = async (locale: Iso6391LanguageCode) => {
		setWorking(locale);
		setAdding(false);
		setFailed(undefined);

		try {
			const result = await (onAddLanguage ? onAddLanguage(locale) : controller.add(locale));

			if (result === false) {
				setFailed(locale);

				return;
			}
		} catch {
			setFailed(locale);
		} finally {
			setWorking(undefined);
		}
	};

	const pendingLocale = controller.translation?.locale ?? working ?? failed;
	const failedLocale = controller.translation?.state === "failed" ? controller.translation.locale : failed;
	const locales = [...new Set([...document.locales, ...(pendingLocale ? [pendingLocale] : [])])];
	const busy = !controller.enabled || controller.pending || Boolean(working);

	return (
		<div className='space-y-6'>
			<div className='divide-y divide-border rounded-xl border border-border'>
				{locales.map((locale) => (
					<div className='flex flex-wrap items-center gap-3 p-4' key={locale}>
						<div className='min-w-0 flex-1'>
							<div className='flex flex-wrap items-center gap-2'>
								<p className='font-medium'>{names.of(locale)}</p>
								{locale === document.defaultLocale && <MainLanguageIndicator />}
								{locale === pendingLocale && (
									<Badge role='status' variant={locale === failedLocale ? "critical" : "secondary"}>
										{t(locale === failedLocale ? "translationFailed" : "translatingBadge")}
									</Badge>
								)}
							</div>
							<p className='text-xs text-muted-foreground'>
								{locale === document.defaultLocale ? "/" : `/${locale}`}
							</p>
						</div>
						{locale !== document.defaultLocale && locale !== pendingLocale && (
							<>
								<Button
									disabled={busy}
									onClick={() => controller.setDefault(locale)}
									size='sm'
									variant='outline'
								>
									{t("setMain")}
								</Button>
								<Button disabled={busy} onClick={() => setRemoving(locale)} size='sm' variant='ghost'>
									{t("remove")}
								</Button>
							</>
						)}
					</div>
				))}
			</div>
			<ConfirmDestructiveEdit
				confirmLabel={t("remove")}
				description={t("removeDescription")}
				onConfirm={async () => {
					if (!removing) {
						return;
					}

					try {
						await controller.edit({ locale: removing, operation: "remove-language" });
					} catch {
						return;
					}
				}}
				onOpenChange={(open) => {
					if (!open) {
						setRemoving(undefined);
					}
				}}
				open={removing !== undefined}
				title={t("removeTitle", { language: removing ? (names.of(removing) ?? removing) : "" })}
			/>
			{failedLocale && (
				<div className='flex gap-2'>
					<Button disabled={busy} onClick={() => add(failedLocale)} variant='outline'>
						{t("retry")}
					</Button>
					{controller.translation?.state === "failed" && (
						<Button disabled={busy} onClick={() => controller.cancelTranslation()} variant='ghost'>
							{t("remove")}
						</Button>
					)}
				</div>
			)}
			{adding ? (
				<div className='space-y-3'>
					<div className='max-h-64 overflow-y-auto rounded-xl border border-border'>
						{editorLanguages
							.filter((locale) => !locales.includes(locale))
							.sort((left, right) =>
								(names.of(left) ?? left).localeCompare(names.of(right) ?? right, uiLocale)
							)
							.map((locale) => (
								<Button
									className='w-full justify-start'
									disabled={busy}
									key={locale}
									onClick={() => add(locale)}
									variant='ghost'
								>
									<span>{names.of(locale)}</span>
								</Button>
							))}
					</div>
				</div>
			) : (
				<Button
					disabled={busy || document.locales.length >= 8}
					onClick={() => setAdding(true)}
					variant='outline'
				>
					{t("add")}
				</Button>
			)}
		</div>
	);
};
