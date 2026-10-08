"use client";

import { useState, type MouseEvent, type SyntheticEvent } from "react";

import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import type { SiteDisclosureItemTarget } from "@starter/infinite-website/preview";
import { Button } from "@starter/ui/components/button";

import { ConfirmDestructiveEdit } from "../../components/editor/confirm-destructive-edit";
import type { WebsiteEditor } from "../use-website-editor";

export const WebsiteDisclosureItemControls = ({
	editor,
	target,
}: {
	editor: Pick<WebsiteEditor, "disabled" | "edit" | "pending">;
	target: SiteDisclosureItemTarget;
}) => {
	const { can } = useOrganizationPermissions();
	const t = useTranslations("website.inlineEdit.accordion");
	const disabled = editor.disabled || editor.pending !== null;
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	const stop = (event: MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		event.stopPropagation();
	};

	const stopPointer = (event: SyntheticEvent<HTMLButtonElement>) => event.stopPropagation();

	return (
		<div className='invisible absolute inset-inline-end-3 bottom-0 z-30 flex translate-y-1/2 gap-1 rounded-full bg-popover p-1 opacity-0 smooth-shadow-ring-md transition-opacity group-focus-within/website-disclosure-item:visible group-focus-within/website-disclosure-item:opacity-100 group-hover/website-disclosure-item:visible group-hover/website-disclosure-item:opacity-100 motion-reduce:transition-none'>
			{target.index === target.itemCount - 1 && (
				<Button
					aria-label={t("add")}

					disabled={disabled || target.itemCount >= target.max}
					onClick={(event) => {
						stop(event);

						editor.edit({
							collection: target.collection,
							itemId: crypto.randomUUID(),
							operation: "add-collection-item",
							sectionId: target.sectionId,
						});
					}}
					onPointerDown={stopPointer}
					size='icon-sm'
					title={t("add")}
					type='button'
					variant='ghost'
				>
					<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Add01Icon} strokeWidth={1.75} />
				</Button>
			)}
			<Button
				aria-label={t("delete")}

				disabled={disabled || !can("workspace.delete") || target.itemCount <= target.min}
				onClick={(event) => {
					stop(event);
					setConfirmingDelete(true);
				}}
				onPointerDown={stopPointer}
				size='icon-sm'
				title={t("delete")}
				type='button'
				variant='destructive-ghost'
			>
				<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Delete02Icon} strokeWidth={1.75} />
			</Button>
			<ConfirmDestructiveEdit
				confirmLabel={t("delete")}
				description={t("deleteDescription")}
				onConfirm={() =>
					editor.edit({
						collection: target.collection,
						itemId: target.contentItemId,
						operation: "delete-collection-item",
						sectionId: target.sectionId,
					})
				}
				onOpenChange={setConfirmingDelete}
				open={confirmingDelete}
				title={t("deleteTitle")}
			/>
		</div>
	);
};
