"use client";

import { useState } from "react";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";

import { apiClient } from "@/lib/api-client";
import type { DashboardChatUIMessage } from "@starter/server";

export const useLibraryChatSession = ({ assetId, enabled = true }: { assetId?: string; enabled?: boolean }) => {
	const query = useQuery({
		...apiClient.library.agentChat.queryOptions({ input: { assetId } }),
		enabled,
		placeholderData: keepPreviousData,
	});

	const [fresh, setFresh] = useState<{ chatId: string; messages: Array<DashboardChatUIMessage> } | null>(null);

	return {
		query,
		session: fresh ?? query.data,
		startNewChat: () => setFresh({ chatId: uuidv4(), messages: [] }),
	};
};
