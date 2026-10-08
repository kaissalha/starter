"use client";

import { useEffect, useEffectEvent } from "react";

import { selectChatSessionBusy, useChatSession } from "@/components/chat/stores/chat-session-store";

export const LibraryChatRefresh = ({ onRefresh }: { onRefresh: () => void }) => {
	const busy = useChatSession(selectChatSessionBusy);
	const refresh = useEffectEvent(onRefresh);

	useEffect(() => {
		if (!busy) {
			return;
		}

		const interval = setInterval(() => refresh(), 2500);

		return () => {
			clearInterval(interval);
			refresh();
		};
	}, [busy]);

	return null;
};
