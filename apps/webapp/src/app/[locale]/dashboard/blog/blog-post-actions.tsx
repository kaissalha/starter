"use client";

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";

import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { getBlogBodyText } from "@starter/infinite-website";
import {
	getBlogLocaleContent,
	getBlogTranslationSource,
	type Iso6391LanguageCode,
} from "@starter/infinite-website/contracts";
import { Button } from "@starter/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
} from "@starter/ui/components/dropdown-menu";
import { useIsMobile } from "@starter/ui/hooks/use-is-mobile";

import type { useBlogEditorController } from "./use-blog-editor-controller";

export const BlogPostActions = ({
	controller,
	disabled,
	locale,
	onDelete,
	onGenerate,
	published,
}: {
	controller: ReturnType<typeof useBlogEditorController>;
	disabled: boolean;
	locale: Iso6391LanguageCode;
	onDelete: () => void;
	onGenerate: () => void;
	published: boolean;
}) => {
	const t = useTranslations("blog");
	const tSettings = useTranslations("website.settings");
	const { can } = useOrganizationPermissions();
	const isMobile = useIsMobile();
	const [, setSettingsTab] = useQueryState("websiteSettings");

	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button aria-label={t("actions")} size='icon-sm' variant='ghost' />}>
				<HugeiconsIcon className='scale-110' icon={MoreHorizontalIcon} strokeWidth={1.75} />
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end'>
				{isMobile && (
					<DropdownMenuItem
						disabled={disabled || !controller.languages.document}
						onClick={() => setSettingsTab("list")}
					>
						{tSettings("title")}
					</DropdownMenuItem>
				)}
				<DropdownMenuItem disabled={disabled} onClick={onGenerate}>
					{t("generate")}
				</DropdownMenuItem>
				{!getBlogBodyText(
					getBlogLocaleContent({ document: controller.draft.document, locale }).body.content
				).trim() && (
					<DropdownMenuItem
						disabled={disabled || !getBlogTranslationSource(controller.draft.document)}
						onClick={() => controller.perform("translate", locale)}
					>
						{t("translate")}
					</DropdownMenuItem>
				)}
				{can("workspace.delete") && published && (
					<DropdownMenuItem disabled={disabled} onClick={() => controller.perform("unpublish")}>
						{t("unpublish")}
					</DropdownMenuItem>
				)}
				{can("workspace.delete") && (
					<DropdownMenuItem disabled={disabled} onClick={onDelete} variant='destructive'>
						{t("delete")}
					</DropdownMenuItem>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
