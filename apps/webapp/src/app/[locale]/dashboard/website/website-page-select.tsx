"use client";

import { useTranslations } from "next-intl";

import { resolveLocalizedPageSlug, type Iso6391LanguageCode } from "@starter/infinite-website";
import type { WebsiteSnapshotV1 } from "@starter/infinite-website/contracts";
import {
	Select,
	SelectGroup,
	SelectGroupLabel,
	SelectItem,
	SelectPopup,
	SelectTrigger,
} from "@starter/ui/components/select";

export const getPageTitle = ({
	locale,
	pageId,
	snapshot,
}: {
	locale: Iso6391LanguageCode;
	pageId: string;
	snapshot: WebsiteSnapshotV1;
}) =>
	resolveLocalizedPageSlug({
		content: snapshot.document.content,
		defaultLocale: snapshot.document.defaultLocale,
		locale,
		pageId,
	})
		.split("/")
		.at(-1)
		?.replaceAll(/[-_]+/gu, " ")
		.replaceAll(/\b\p{L}/gu, (character) => character.toLocaleUpperCase(locale)) ?? pageId;

export const WebsitePageSelect = ({
	disabled,
	locale,
	onPageChange,
	pageId,
	snapshot,
}: {
	disabled?: boolean;
	locale: Iso6391LanguageCode;
	onPageChange: (pageId: string) => void;
	pageId?: string;
	snapshot: WebsiteSnapshotV1;
}) => {
	const t = useTranslations("website");

	const pages = snapshot.document.structure.pages.map((page) => {
		const title = page.home ? t("pages.home") : getPageTitle({ locale, pageId: page.id, snapshot });

		return { home: page.home, id: page.id, title: title.toLocaleLowerCase(locale) === "faq" ? "FAQ" : title };
	});

	const selectedPage = pages.find((page) => page.id === pageId) ?? pages.find((page) => page.home) ?? pages[0];

	if (!selectedPage) {
		return null;
	}

	return (
		<Select
			disabled={disabled}
			onValueChange={(value) => {
				if (value && pages.some((page) => page.id === value)) {
					onPageChange(value);
				}
			}}
			value={selectedPage.id}
		>
			<SelectTrigger
				aria-label={`${t("pages.label")}: ${selectedPage.title}`}
				className='max-w-36 sm:max-w-48'
				size='default'
				variant='subtle'
			>
				<span className='hidden shrink-0 text-muted-foreground md:inline'>{t("pages.label")}:</span>
				<span className='truncate'>{selectedPage.title}</span>
			</SelectTrigger>
			<SelectPopup className='min-w-56' sideOffset={6}>
				<SelectGroup>
					<SelectGroupLabel>{t("pages.navigation")}</SelectGroupLabel>
					{pages.map((page) => (
						<SelectItem key={page.id} value={page.id}>
							{page.title}
						</SelectItem>
					))}
				</SelectGroup>
			</SelectPopup>
		</Select>
	);
};
