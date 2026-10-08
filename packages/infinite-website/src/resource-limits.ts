export const siteDocumentResourceLimits = {
	bytes: 2 * 1024 * 1024,
	customScriptPrograms: 8,
	jsonDepth: 128,
	jsonValues: 50_000,
	locales: 8,
	nodeDepth: 32,
	nodes: 8192,
	pages: 32,
	sectionNodes: 256,
	sections: 256,
} as const;

export const sectionAuthoringResourceLimits = {
	bytes: 256 * 1024,
	events: 16,
	fields: 32,
	media: 32,
	nodes: 200,
	outputs: 32,
} as const;
