import { ORPCError } from "@orpc/client";

import type { DashboardChatUIMessage } from "../ai/types";
import { mastra } from "../mastra";
import { convertChatMessagesForUI, expireChatToolApprovals, getChatMessages } from "../services/chat";
import { getPendingApprovalToolCallIds } from "./chat-stream-validation";

export const reconcileExpiredToolApprovals = async ({
	chatId,
	existingMessages,
	organizationId,
	persistedMessages,
}: {
	chatId: string;
	existingMessages: Awaited<ReturnType<typeof getChatMessages>>;
	organizationId: string;
	persistedMessages: Array<DashboardChatUIMessage>;
}) => {
	const pendingMessage = persistedMessages.at(-1);
	const pendingToolCallIds = getPendingApprovalToolCallIds(pendingMessage);

	if (pendingToolCallIds.length === 0) {
		return { expired: false, persistedMessages };
	}

	const dashboardChatAgent = mastra.getAgentById("dashboard-chat-agent");
	const { runs } = await dashboardChatAgent.listSuspendedRuns({ resourceId: organizationId, threadId: chatId });

	const suspendedToolCallIds = new Set(
		runs.flatMap(({ toolCalls }) =>
			toolCalls.flatMap(({ requiresApproval, toolCallId }) =>
				requiresApproval && toolCallId ? [toolCallId] : []
			)
		)
	);

	const expiredToolCallIds = pendingToolCallIds.filter((toolCallId) => !suspendedToolCallIds.has(toolCallId));

	if (expiredToolCallIds.length === 0 || !pendingMessage) {
		return { expired: false, persistedMessages };
	}

	const persistedMessage = existingMessages.find(({ id }) => id === pendingMessage.id);

	if (!persistedMessage) {
		return { expired: false, persistedMessages };
	}

	await expireChatToolApprovals({ message: persistedMessage, toolCallIds: expiredToolCallIds });

	return {
		expired: true,
		persistedMessages: await convertChatMessagesForUI(await getChatMessages({ chatId, organizationId })),
	};
};

export const loadReconciledPersistedMessages = async ({
	chatId,
	existingMessages,
	organizationId,
	rejectExpiredApproval,
}: {
	chatId: string;
	existingMessages: Awaited<ReturnType<typeof getChatMessages>>;
	organizationId: string;
	rejectExpiredApproval: boolean;
}) => {
	const reconciled = await reconcileExpiredToolApprovals({
		chatId,
		existingMessages,
		organizationId,
		persistedMessages: await convertChatMessagesForUI(existingMessages),
	});

	if (reconciled.expired && rejectExpiredApproval) {
		throw new ORPCError("BAD_REQUEST", {
			message: "This approval expired before Mastra could resume it. Please try again.",
		});
	}

	return reconciled.persistedMessages;
};

export const getReconciledChatMessages = async ({
	chatId,
	organizationId,
}: {
	chatId: string;
	organizationId: string;
}) =>
	loadReconciledPersistedMessages({
		chatId,
		existingMessages: await getChatMessages({ chatId, organizationId }),
		organizationId,
		rejectExpiredApproval: false,
	});
