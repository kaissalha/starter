import { retrieveKnowledgeTool } from "../../mastra/knowledge";
import { analyticsTools } from "./analytics";
import { assistantTools } from "./assistant";
import { blogTools } from "./blog";
import { brandTools } from "./brand";
import { contactsTools } from "./contacts";
import { domainsTools } from "./domains";
import { editWebsiteTools } from "./edit-website";
import { inspectWebsiteTools } from "./inspect-website";
import { libraryTools } from "./library";
import { linksTools } from "./links";
import { seoTools } from "./seo";
import { tableTools } from "./table";
import { websiteTools } from "./website";

const tools = {
	...analyticsTools,
	...assistantTools,
	...blogTools,
	...brandTools,
	...contactsTools,
	...domainsTools,
	...editWebsiteTools,
	...inspectWebsiteTools,
	...libraryTools,
	...linksTools,
	...seoTools,
	...tableTools,
	...websiteTools,
	retrieveKnowledge: retrieveKnowledgeTool,
};

for (const tool of Object.values(tools)) {
	tool.strict = false;
}

export const dashboardChatTools = tools;

export const isDashboardMutationToolName = (toolName: string) =>
	Object.entries(dashboardChatTools).some(([name, tool]) => name === toolName && Boolean(tool.requireApproval));

const websiteMutationToolNames = new Set([
	"addWebsiteSection",
	"buildWebsite",
	"cancelWebsiteWorkflow",
	"changeWebsiteTemplate",
	"composeWebsiteSection",
	"editWebsite",
	"generateWebsite",
	"generateWebsiteLayout",
	"previewWebsiteTemplate",
	"publishBrand",
	"publishWebsite",
	"updateBrand",
]);

export const isWebsiteMutationToolName = (toolName: string) =>
	isDashboardMutationToolName(toolName) && websiteMutationToolNames.has(toolName);
