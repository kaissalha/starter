import type { DashboardChatTools } from "@starter/server";

export type ChatDataDomain = "brand" | "library" | "links" | "website";

export const chatToolDataChanges = new Map<string, ReadonlyArray<ChatDataDomain>>(
	Object.entries({
		addWebsiteSection: ["website"],
		buildWebsite: ["website"],
		cancelWebsiteWorkflow: ["website"],
		changeWebsiteTemplate: ["website"],
		composeWebsiteSection: ["website"],
		createLibraryDocument: ["library"],
		editLibraryDocument: ["library"],
		editLinkPage: ["links"],
		editWebsite: ["website"],
		generateLibraryImage: ["library"],
		generateWebsite: ["website"],
		generateWebsiteLayout: ["website"],
		publishBrand: ["brand", "links", "website"],
		publishLinkPage: ["links"],
		publishWebsite: ["website"],
		updateBrand: ["brand", "links", "website"],
	} satisfies Partial<Record<keyof DashboardChatTools, Array<ChatDataDomain>>>)
);
