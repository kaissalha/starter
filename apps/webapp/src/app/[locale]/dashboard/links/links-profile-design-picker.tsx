"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";

import { LinkPageRenderer, linkPageProfileDesigns, type LinkPageProfile } from "@starter/infinite-links";

import { LinksSegmented, LinksTilePicker } from "./links-option-controls";
import { LinksPickerSection } from "./links-panel";
import type { LinksPageController } from "./use-links-page-controller";

type DesignGroup = keyof typeof linkPageProfileDesigns;

const designGroups = ["studio", "minimal", "creative", "bold"] satisfies ReadonlyArray<DesignGroup>;

const groupOf = (layout: LinkPageProfile["layout"]): DesignGroup =>
	designGroups.find((group) => linkPageProfileDesigns[group].some((candidate) => candidate === layout)) ?? "minimal";

export const LinksProfileDesignPicker = ({ controller }: { controller: LinksPageController }) => {
	const t = useTranslations("links.design");
	const { document, locale } = controller;
	const [group, setGroup] = useState<DesignGroup>(() => groupOf(document.profile.layout));

	const preview = (layout: LinkPageProfile["layout"]) => (
		<span
			aria-hidden='true'
			className='pointer-events-none relative block aspect-[9/17] w-full overflow-hidden rounded-lg'
			inert
		>
			<span className='absolute start-0 top-0 block h-[400%] w-[400%] origin-top-left scale-25 rtl:origin-top-right'>
				<LinkPageRenderer
					brand={controller.brand}
					document={{
						...document,
						blocks: [],
						headerBlockIds: [],
						profile: { ...document.profile, layout },
						redirectBlockId: null,
					}}
					locale={locale}
					preview
				/>
			</span>
		</span>
	);

	return (
		<LinksPickerSection title={t("headerLayout")}>
			<LinksSegmented
				hideLabel
				label={t("designCategory")}
				onChange={setGroup}
				options={designGroups.map((value) => ({ label: t(`designCategories.${value}`), value }))}
				value={group}
			/>
			<LinksTilePicker
				columns={4}
				label={t("headerLayout")}
				onChange={(layout) =>
					controller.updateProfile({
						alignment: layout === "minimal-04" || layout === "bold-03" ? "start" : "center",
						layout,
					})
				}
				options={linkPageProfileDesigns[group].map((layout) => ({
					label: t(`headerLayouts.${layout}`),
					preview: preview(layout),
					value: layout,
				}))}
				previewClassName='min-h-0 bg-transparent'
				value={document.profile.layout}
			/>
		</LinksPickerSection>
	);
};
