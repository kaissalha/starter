"use client";

import type * as React from "react";

import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { Button } from "@starter/ui/components/button";

type ChatPlusMenuProps = {
	disabled?: boolean;
	fileInputRef: React.RefObject<HTMLInputElement | null>;
};

export const ChatPlusMenu = ({ disabled = false, fileInputRef }: ChatPlusMenuProps) => {
	const t = useTranslations("components.chat.chatInput.plusMenu");

	return (
		<Button
			aria-label={t("addFiles")}

			disabled={disabled}
			onClick={() => fileInputRef.current?.click()}
			size='icon-sm'
			type='button'
			variant='ghost'
		>
			<HugeiconsIcon aria-hidden className='scale-110' icon={Add01Icon} strokeWidth={1.75} />
		</Button>
	);
};
