"use client";

import type { ReactNode } from "react";

import { ChatComposer } from "@/components/chat/chat-input/chat-composer";
import { isAwaitingApproval, useChatSession } from "@/components/chat/chat-session";
import { ChatMessageList } from "@/components/chat/message/chat-message-list";
import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { cn } from "@starter/ui/lib/utils";

export const ChatContent = ({
	composerAreaClassName,
	composerClassName,
	emptyState,
	media = false,
	messageClassName,
	placeholder,
}: {
	composerAreaClassName?: string;
	composerClassName?: string;
	emptyState?: ReactNode;
	media?: boolean;
	messageClassName?: string;
	placeholder?: string;
}) => {
	const { can } = useOrganizationPermissions();
	const awaitingApproval = isAwaitingApproval(useChatSession().messages);

	return (
		<div className='relative flex h-full min-h-0 w-full flex-col items-center overflow-hidden'>
			<ChatMessageList className='w-full' contentClassName={messageClassName} emptyState={emptyState} />
			{can("workspace.write") && !awaitingApproval && (
				<>
					<div
						className={cn(
							"absolute start-0 end-0 bottom-0 z-40 flex justify-center px-4 pb-4",
							composerAreaClassName
						)}
					>
						<ChatComposer
							className={composerClassName}
							containerClassName='w-full max-w-3xl'
							media={media}
							placeholder={placeholder}
						/>
					</div>
					<div className='pointer-events-none absolute start-0 end-0 bottom-0 z-30 h-30 bg-linear-to-t from-background to-transparent' />
				</>
			)}
		</div>
	);
};

ChatContent.displayName = "ChatContent";
