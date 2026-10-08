"use client";

import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { TextShimmer } from "@starter/ui/components/text-shimmer";

import { ChatActivityOrb } from "../chat-activity-orb";

export const ToolLoading = ({ message }: { message: string }) => {
	return (
		<div className='flex items-center gap-2.5 rounded-2xl border border-border/50 bg-muted/30 px-4 py-3'>
			<ChatActivityOrb state='composing' />
			<TextShimmer variant='muted'>{message}</TextShimmer>
		</div>
	);
};

export const ToolError = () => {
	const t = useTranslations("components.chat.message.tool");

	return (
		<div className='flex items-center gap-3 rounded-2xl bg-destructive/10 px-4 py-3 text-destructive'>
			<HugeiconsIcon aria-hidden='true' className='size-4 scale-110' icon={Alert02Icon} strokeWidth={1.75} />
			<span className='text-sm'>{t("error")}</span>
		</div>
	);
};
