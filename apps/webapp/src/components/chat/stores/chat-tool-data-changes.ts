import type { DashboardChatTools } from "@starter/server";

export type ChatDataDomain = "library";

export const chatToolDataChanges = new Map<string, ReadonlyArray<ChatDataDomain>>(
	Object.entries({
		createLibraryDocument: ["library"],
		editLibraryDocument: ["library"],
		generateLibraryImage: ["library"],
	} satisfies Partial<Record<keyof DashboardChatTools, Array<ChatDataDomain>>>)
);
