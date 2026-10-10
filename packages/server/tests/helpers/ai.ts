export const emptyMastraMemoryMock = {
	dashboardChatMemory: { listThreads: async () => ({ threads: [] }) },
	mastraStorage: { getStore: async () => undefined },
};
