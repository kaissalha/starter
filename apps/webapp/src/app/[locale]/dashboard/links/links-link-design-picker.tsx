"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";

import {
	LinkPageRenderer,
	defaultLinkPageSectionAppearance,
	linkPageLinkDesigns,
	type LinkPageCollectionBlock,
	type LinkPageLink,
	type LinkPageLinkDesign,
} from "@starter/infinite-links";
import { Button } from "@starter/ui/components/button";

import { LinksSegmented, LinksTilePicker } from "./links-option-controls";
import type { LinksPageController } from "./use-links-page-controller";

type DesignGroup = keyof typeof linkPageLinkDesigns;

export const LinksLinkDesignPicker = ({
	block,
	controller,
	onChange,
	value,
}: {
	block?: LinkPageCollectionBlock | LinkPageLink;
	controller: LinksPageController;
	onChange: (design: LinkPageLinkDesign | undefined) => void;
	value: LinkPageLinkDesign | undefined;
}) => {
	const t = useTranslations("links.design");

	const [group, setGroup] = useState<DesignGroup>(() => {
		if (value?.startsWith("cards")) {
			return "cards";
		}

		return value?.startsWith("advanced") ? "advanced" : "buttons";
	});

	const links = (block ? [block] : controller.document.blocks).flatMap((item) => {
		if (item.kind === "collection") {
			return item.links;
		}

		return item.kind === "link" ? [item] : [];
	});

	const first: LinkPageLink = links[0] ?? {
		appearance: defaultLinkPageSectionAppearance,
		enabled: true,
		id: "00000000-0000-4000-8000-000000000004",
		kind: "link",
		label: { [controller.locale]: t("buttonPreview") },
		layout: "classic",
		url: "https://example.com",
	};

	const samples =
		links.length < 3
			? [
					first,
					{ ...first, id: "00000000-0000-4000-8000-000000000002" },
					{ ...first, id: "00000000-0000-4000-8000-000000000003" },
				]
			: links.slice(0, 4);

	return (
		<div className='space-y-3'>
			<LinksSegmented
				hideLabel
				label={t("designCategory")}
				onChange={setGroup}
				options={(["buttons", "cards", "advanced"] as const).map((value) => ({
					label: t(`designCategories.${value}`),
					value,
				}))}
				value={group}
			/>
			<LinksTilePicker
				columns={4}
				label={t("buttonLayout")}
				onChange={(design) => onChange(design || undefined)}
				options={linkPageLinkDesigns[group].map((design) => ({
					label: t(`linkDesigns.${design}`),
					preview: (
						<span
							aria-hidden='true'
							className='pointer-events-none relative block aspect-square w-full overflow-hidden rounded-lg'
							inert
						>
							<span className='absolute start-0 top-0 block h-[400%] w-[400%] origin-top-left scale-25 rtl:origin-top-right [&_[data-links-profile-layout]]:hidden [&_main>div>ul]:mt-4'>
								<LinkPageRenderer
									brand={controller.brand}
									document={{
										...controller.document,
										blocks: [
											{
												appearance: block?.appearance ?? defaultLinkPageSectionAppearance,
												design,
												display: "stack",
												enabled: true,
												id: "00000000-0000-4000-8000-000000000001",
												kind: "collection",
												links: samples,
												title: {},
											},
										],
										headerBlockIds: [],
										redirectBlockId: null,
									}}
									locale={controller.locale}
									preview
								/>
							</span>
						</span>
					),
					value: design,
				}))}
				previewClassName='min-h-0 bg-transparent'
				value={value ?? ""}
			/>
			<Button
				aria-pressed={!value}
				className='w-full'
				onClick={() => onChange(undefined)}
				size='sm'
				type='button'
				variant='ghost'
			>
				{t("originalLayout")}
			</Button>
		</div>
	);
};
