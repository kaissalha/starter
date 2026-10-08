import { isToolUIPart } from "ai";

import type { DashboardChatUIMessage } from "@starter/server";

export const getVisibleMessageParts = ({
	isStreaming = false,
	isUser,
	parts,
}: {
	isStreaming?: boolean;
	isUser: boolean;
	parts: DashboardChatUIMessage["parts"];
}) => {
	if (isUser) {
		return parts;
	}

	const lastToolIndex = parts.findLastIndex(isToolUIPart);

	return parts.filter(
		(part, index) =>
			part.type !== "reasoning" &&
			(part.type !== "text" || (!isStreaming && part.state !== "streaming" && index > lastToolIndex)) &&
			!["tool-skill", "tool-skill_read", "tool-skill_search"].includes(part.type) &&
			!(part.type === "dynamic-tool" && ["skill", "skill_read", "skill_search"].includes(part.toolName))
	);
};
