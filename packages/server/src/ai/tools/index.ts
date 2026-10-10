import { retrieveKnowledgeTool } from "../knowledge";
import { assistantTools } from "./assistant";
import { libraryTools } from "./library";
import { notificationsTools } from "./notifications";
import { tableTools } from "./table";

export const dashboardChatTools = {
	...assistantTools,
	...libraryTools,
	...notificationsTools,
	...tableTools,
	retrieveKnowledge: retrieveKnowledgeTool,
};

for (const tool of Object.values(dashboardChatTools)) {
	tool.strict = false;
}

export const isDashboardMutationToolName = (toolName: string) =>
	Object.entries(dashboardChatTools).some(([name, tool]) => name === toolName && Boolean(tool.requireApproval));
