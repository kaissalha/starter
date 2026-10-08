"use client";

import { useState } from "react";

import Image from "next/image";

import { useTranslations } from "next-intl";

import { EditorBackButton } from "@/app/[locale]/dashboard/components/editor/editor-back-button";
import { MediaEditButton } from "@/components/media/media-edit-button";
import { MediaPickerContent } from "@/components/media/media-picker";
import type { WebsiteSnapshotV1 } from "@starter/infinite-website/contracts";
import {
	listSectionMediaNodeReferences,
	resolveSectionContentReference,
	entityIdSchema,
} from "@starter/infinite-website/editing";
import { Button } from "@starter/ui/components/button";
import { Card } from "@starter/ui/components/card";

import { useWebsiteGenerationStore } from "../generation/website-generation-store";
import type { WebsiteEditor } from "../use-website-editor";

type MediaTarget = NonNullable<WebsiteEditor["mediaTarget"]>;

const getSectionMedia = ({
	backgroundOnly = true,
	sectionId,
	snapshot,
}: {
	backgroundOnly?: boolean;
	sectionId: string;
	snapshot: WebsiteSnapshotV1 | null;
}) => {
	if (!snapshot) {
		return [];
	}

	const { document } = snapshot;

	const section = [
		...document.structure.layout.header,
		...document.structure.pages.flatMap((page) => page.sections),
		...document.structure.layout.footer,
	].find((item) => item.id === sectionId);

	if (!section) {
		return [];
	}

	const pointers = new Set(
		listSectionMediaNodeReferences({ backgroundOnly, node: section.root }).map(({ pointer }) => pointer)
	);

	return [...pointers].map((pointer) => {
		const assetId = entityIdSchema.parse(
			resolveSectionContentReference({
				content: document.content,
				contentId: section.contentId,
				defaultLocale: document.defaultLocale,
				locale: document.defaultLocale,
				reference: { $asset: pointer },
			})
		);

		return { asset: snapshot.assets[assetId], pointer };
	});
};

export const WebsiteMediaButton = ({
	disabled,
	label,
	openOverlay,
	target,
}: {
	disabled: boolean;
	label?: string;
	openOverlay: WebsiteEditor["openOverlay"];
	target: MediaTarget;
}) => {
	const t = useTranslations("media");
	const snapshot = useWebsiteGenerationStore((state) => state.snapshot);
	const overlay = target.pointer !== undefined;

	if (!overlay && getSectionMedia({ sectionId: target.sectionId, snapshot }).length === 0) {
		return null;
	}

	if (overlay) {
		return (
			<MediaEditButton
				data-website-media-trigger=''
				disabled={disabled}
				label={label}
				onClick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					openOverlay({ kind: "media", target });
				}}
				sectionScoped
			/>
		);
	}

	return (
		<Button
			data-website-media-trigger=''
			disabled={disabled}
			onClick={(event) => {
				event.preventDefault();
				event.stopPropagation();
				openOverlay({ kind: "media", target });
			}}
			type='button'
			variant='ghost'
		>
			{t("media")}
		</Button>
	);
};

export const WebsiteMediaPanel = ({ editor, target }: { editor: WebsiteEditor; target: MediaTarget }) => {
	const t = useTranslations("media");
	const tCommon = useTranslations("common");
	const snapshot = useWebsiteGenerationStore((state) => state.snapshot);

	const items = getSectionMedia({
		backgroundOnly: target.pointer === undefined,
		sectionId: target.sectionId,
		snapshot,
	});

	const [pointer, setPointer] = useState(target.pointer ?? items[0]?.pointer);
	const disabled = editor.disabled || editor.pending !== null;

	return (
		<div className='flex h-full min-h-0 flex-col gap-4 p-4'>
			<div className='flex shrink-0 items-center gap-2'>
				<EditorBackButton
					aria-label={tCommon("actions.back")}
					disabled={editor.pending !== null}
					onClick={editor.cancelDraft}
				/>
				<h2 className='text-lg font-medium'>{t("title")}</h2>
			</div>
			<p className='shrink-0 text-sm text-muted-foreground'>{t("description")}</p>
			{!target.pointer && items.length > 1 && (
				<div className='flex shrink-0 gap-2 overflow-x-auto pb-1'>
					{items.map(({ asset, pointer: slot }, index) => (
						<Button
							aria-label={t("replaceSlot", { number: index + 1 })}
							aria-pressed={slot === pointer}
							className='group relative block w-20 shrink-0'
							disabled={disabled}
							key={slot}
							onClick={() => setPointer(slot)}
							unstyled
						>
							<Card variant='selectable'>
								{asset?.type === "video" && (
									<video
										aria-label={t("slot", { number: index + 1 })}
										className='aspect-video w-full rounded object-cover'
										muted
										playsInline
										preload='metadata'
										src={asset.src}
									/>
								)}
								{asset && asset.type !== "video" && (
									<Image
										alt=''
										className='aspect-video w-full rounded object-cover'
										height={45}
										src={asset.src}
										unoptimized
										width={80}
									/>
								)}
								{!asset && t("slot", { number: index + 1 })}
							</Card>
						</Button>
					))}
				</div>
			)}
			{pointer && (
				<MediaPickerContent
					disabled={disabled}
					key={pointer}
					onSelect={async (media) => {
						const saved = await editor.edit(
							{ fileId: media.id, operation: "update-media", pointer, sectionId: target.sectionId },
							{ [media.id]: { src: media.url, type: media.kind } }
						);

						if (saved) {
							editor.closeDraft();
						}
					}}
				/>
			)}
		</div>
	);
};
