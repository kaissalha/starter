const toolNames = [
	"askUserQuestions",
	"createLibraryDocument",
	"editLibraryDocument",
	"generateLibraryImage",
	"getDocument",
	"getLibraryAsset",
	"inspectTable",
	"listDocuments",
	"listLibraryAssets",
	"retrieveKnowledge",
	"webSearch",
] as const;

export const getToolLabelKey = (name: string) => toolNames.find((toolName) => toolName === name) ?? "other";
