"use client";

import { useTranslations } from "next-intl";

import type { SitePreviewInsertionGapProps } from "@starter/infinite-website/preview";

import { selectWebsiteEditorLocked, useWebsiteGenerationStore } from "../generation/website-generation-store";

export const WebsiteInsertionGap = ({ target }: SitePreviewInsertionGapProps) => {
	const t = useTranslations("website.sectionCatalog");

	const reserved = useWebsiteGenerationStore(
		(state) =>
			selectWebsiteEditorLocked(state) &&
			!Object.values(state.readiness).some(({ slotKey }) => slotKey.startsWith("section-additions.")) &&
			state.workflow.kind === "section-addition" &&
			state.workflow.target?.pageId === target.pageId &&
			state.workflow.target.index === target.index
	);

	if (!reserved) {
		return null;
	}

	return (
		<div
			aria-label={t("preparing")}
			className='relative z-30 h-40 w-full animate-pulse bg-muted/72 motion-reduce:animate-none'
			data-website-insertion-gap=''
			role='status'
		/>
	);
};
