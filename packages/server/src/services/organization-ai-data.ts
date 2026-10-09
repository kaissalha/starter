import { deleteKnowledgeOrganization } from "../mastra/knowledge";
import { dashboardChatMemory, mastraStorage } from "../mastra/memory";
import { cancelChatStream } from "./chat-stream-state";

const ORGANIZATION_THREAD_BATCH_SIZE = 100;

const batchThreads = <Thread>(threads: Array<Thread>) =>
	Array.from({ length: Math.ceil(threads.length / ORGANIZATION_THREAD_BATCH_SIZE) }, (_, index) =>
		threads.slice(index * ORGANIZATION_THREAD_BATCH_SIZE, (index + 1) * ORGANIZATION_THREAD_BATCH_SIZE)
	);

export const deleteOrganizationAIData = async ({ organizationId }: { organizationId: string }) => {
	const { threads } = await dashboardChatMemory.listThreads({
		filter: { resourceId: organizationId },
		perPage: false,
	});

	for (const batch of batchThreads(threads)) {
		await Promise.all(
			batch.map(async ({ id: chatId }) => {
				await cancelChatStream({ chatId, organizationId });
				await dashboardChatMemory.deleteThread(chatId);
			})
		);
	}

	const memoryStore = await mastraStorage.getStore("memory");

	if (await memoryStore?.getResourceById({ resourceId: organizationId })) {
		await memoryStore?.updateResource({ resourceId: organizationId, workingMemory: "" });
	}

	await deleteKnowledgeOrganization({ organizationId });
};
