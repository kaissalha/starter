"use client";

import { useTranslations } from "next-intl";

export const ChatEmptyState = () => {
	const t = useTranslations("chats");

	return (
		<div className='mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 text-center'>
			<div className='space-y-2'>
				<h2 className='text-2xl font-semibold text-foreground'>{t("startConversation")}</h2>
				<p className='text-sm text-muted-foreground'>{t("askAnything")}</p>
			</div>
		</div>
	);
};
