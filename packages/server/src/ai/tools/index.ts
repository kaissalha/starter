import { retrieveKnowledgeTool } from "../../mastra/knowledge";
import { assistantTools } from "./assistant";
import { libraryTools } from "./library";
import { notificationsTools } from "./notifications";
import { tableTools } from "./table";

const tools = {
	...assistantTools,
	...libraryTools,
	...notificationsTools,
	...tableTools,
	retrieveKnowledge: retrieveKnowledgeTool,
};

for (const tool of Object.values(tools)) {
	tool.strict = false;
}

export const dashboardChatTools = tools;

export const isDashboardMutationToolName = (toolName: string) =>
	Object.entries(dashboardChatTools).some(([name, tool]) => name === toolName && Boolean(tool.requireApproval));
