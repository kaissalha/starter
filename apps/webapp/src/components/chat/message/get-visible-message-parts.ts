import { isToolUIPart } from "ai";

import type { DashboardChatUIMessage } from "@starter/server";

export const getVisibleMessageParts = ({
	isUser,
	parts,
}: {
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
			(part.type !== "text" || index > lastToolIndex) &&
			!["tool-skill", "tool-skill_read", "tool-skill_search"].includes(part.type) &&
			!(part.type === "dynamic-tool" && ["skill", "skill_read", "skill_search"].includes(part.toolName))
	);
};
