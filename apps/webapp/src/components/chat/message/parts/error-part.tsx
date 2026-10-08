"use client";

import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { ChatMessageMarkdown } from "../chat-message-markdown";

export type ErrorPartProps = {
	message: string;
};

export const ErrorPart = ({ message }: ErrorPartProps) => {
	return (
		<div className='flex w-fit max-w-full items-center gap-3 rounded-2xl bg-destructive/10 px-4 py-3 text-destructive'>
			<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Alert02Icon} strokeWidth={1.75} />
			<ChatMessageMarkdown>{message}</ChatMessageMarkdown>
		</div>
	);
};

ErrorPart.displayName = "ErrorPart";
