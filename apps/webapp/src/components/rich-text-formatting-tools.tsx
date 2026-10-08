"use client";

import {
	TextBoldIcon,
	TextItalicIcon,
	Heading02Icon,
	LeftToRightListBulletIcon,
	LeftToRightListNumberIcon,
	QuoteUpIcon,
	Undo02Icon,
	Redo02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEditorState, type Editor } from "@tiptap/react";
import { useTranslations } from "next-intl";

import { Button } from "@starter/ui/components/button";
import { Tooltip, TooltipTrigger, TooltipPopup } from "@starter/ui/components/tooltip";

export const RichTextFormattingTools = ({ disabled, editor }: { disabled: boolean; editor: Editor }) => {
	const t = useTranslations("blog");

	const active = useEditorState({
		editor,
		selector: ({ editor: current }) => ({
			bold: current?.isActive("bold") ?? false,
			bullet: current?.isActive("bulletList") ?? false,
			heading: current?.isActive("heading", { level: 2 }) ?? false,
			italic: current?.isActive("italic") ?? false,
			ordered: current?.isActive("orderedList") ?? false,
			quote: current?.isActive("blockquote") ?? false,
		}),
	});

	return (
		<>
			{[
				{
					icon: TextBoldIcon,
					label: t("bold"),
					pressed: active?.bold,
					run: () => editor?.chain().focus().toggleBold().run(),
				},
				{
					icon: TextItalicIcon,
					label: t("italic"),
					pressed: active?.italic,
					run: () => editor?.chain().focus().toggleItalic().run(),
				},
				{
					icon: Heading02Icon,
					label: t("heading"),
					pressed: active?.heading,
					run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
				},
				{
					icon: LeftToRightListBulletIcon,
					label: t("bulletList"),
					pressed: active?.bullet,
					run: () => editor?.chain().focus().toggleBulletList().run(),
				},
				{
					icon: LeftToRightListNumberIcon,
					label: t("orderedList"),
					pressed: active?.ordered,
					run: () => editor?.chain().focus().toggleOrderedList().run(),
				},
				{
					icon: QuoteUpIcon,
					label: t("quote"),
					pressed: active?.quote,
					run: () => editor?.chain().focus().toggleBlockquote().run(),
				},
				{ icon: Undo02Icon, label: t("undo"), run: () => editor?.chain().focus().undo().run() },
				{ icon: Redo02Icon, label: t("redo"), run: () => editor?.chain().focus().redo().run() },
			].map(({ icon, label, pressed, run }) => (
				<Tooltip key={label}>
					<TooltipTrigger
						render={
							<Button
								aria-label={label}
								aria-pressed={pressed}

								disabled={!editor || disabled}
								onClick={run}
								size='icon-sm'
								variant={pressed ? "secondary" : "ghost"}
							/>
						}
					>
						<HugeiconsIcon className='scale-110' icon={icon} strokeWidth={1.75} />
					</TooltipTrigger>
					<TooltipPopup>{label}</TooltipPopup>
				</Tooltip>
			))}
		</>
	);
};
