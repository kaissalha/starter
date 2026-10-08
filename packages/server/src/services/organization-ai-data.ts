import { flushMastraObservability } from "../mastra";
import { deleteKnowledgeOrganization } from "../mastra/knowledge";
import { dashboardChatMemory, mastraStorage } from "../mastra/memory";
import {
	beginOrganizationAIShutdown,
	cancelStream,
	clearOrganizationAIShutdown,
	getOrganizationActiveStreamCount,
	renewOrganizationAIShutdown,
} from "./chat-stream-state";

const ORGANIZATION_THREAD_BATCH_SIZE = 100;

const STREAM_DRAIN_POLL_MS = 50;

const STREAM_DRAIN_TIMEOUT_MS = 5000;

const SHUTDOWN_LEASE_RENEW_INTERVAL_MS = 20_000;

const ORGANIZATION_DELETE_LEASE_TTL_SECONDS = 15 * 60;

type ErrorReference = { value?: unknown };

type PendingRenewalReference = { value?: Promise<void> };

const batchThreads = <Thread>(threads: Array<Thread>) =>
	Array.from({ length: Math.ceil(threads.length / ORGANIZATION_THREAD_BATCH_SIZE) }, (_, index) =>
		threads.slice(index * ORGANIZATION_THREAD_BATCH_SIZE, (index + 1) * ORGANIZATION_THREAD_BATCH_SIZE)
	);

const listOrganizationThreads = async ({ organizationId }: { organizationId: string }) => {
	const { threads } = await dashboardChatMemory.listThreads({
		filter: { resourceId: organizationId },
		perPage: false,
	});

	return threads;
};

const startShutdownLeaseRenewal = (lease: Awaited<ReturnType<typeof beginOrganizationAIShutdown>>) => {
	const errorReference: ErrorReference = {};
	const pendingRenewalReference: PendingRenewalReference = {};

	const renewLease = async () => {
		try {
			const renewed = await renewOrganizationAIShutdown({ lease });

			if (!renewed) {
				throw new Error("Organization AI shutdown lease was lost");
			}
		} catch (error) {
			errorReference.value ??= error;
		} finally {
			pendingRenewalReference.value = undefined;
		}
	};

	const interval = setInterval(() => {
		pendingRenewalReference.value ??= renewLease();
	}, SHUTDOWN_LEASE_RENEW_INTERVAL_MS);

	return async () => {
		clearInterval(interval);
		await pendingRenewalReference.value;

		if (errorReference.value) {
			throw errorReference.value;
		}
	};
};

const collectLeaseRenewalFailure = async (stopLeaseRenewal: () => Promise<void>) => {
	try {
		await stopLeaseRenewal();

		return [];
	} catch (error) {
		return [error];
	}
};

const waitForOrganizationStreamsToDrain = async ({ organizationId }: { organizationId: string }) => {
	const deadline = Date.now() + STREAM_DRAIN_TIMEOUT_MS;

	while ((await getOrganizationActiveStreamCount({ organizationId })) > 0) {
		const remainingMs = deadline - Date.now();

		if (remainingMs <= 0) {
			throw new Error("Timed out waiting for organization AI activity to stop");
		}

		await new Promise((resolve) => setTimeout(resolve, Math.min(STREAM_DRAIN_POLL_MS, remainingMs)));
	}
};

export const stopOrganizationAIActivity = async ({ organizationId }: { organizationId: string }) => {
	const lease = await beginOrganizationAIShutdown({ organizationId });
	const stopLeaseRenewal = startShutdownLeaseRenewal(lease);

	try {
		const threads = await listOrganizationThreads({ organizationId });

		for (const batch of batchThreads(threads)) {
			await Promise.all(batch.map(({ id: chatId }) => cancelStream({ chatId, organizationId })));
		}

		await waitForOrganizationStreamsToDrain({ organizationId });
		await flushMastraObservability();
		await stopLeaseRenewal();

		const renewed = await renewOrganizationAIShutdown({
			lease,
			ttlSeconds: ORGANIZATION_DELETE_LEASE_TTL_SECONDS,
		});

		if (!renewed) {
			throw new Error("Organization AI shutdown lease was lost");
		}

		return lease;
	} catch (error) {
		const leaseErrors = await collectLeaseRenewalFailure(stopLeaseRenewal);

		const failure = leaseErrors.length
			? new AggregateError([error, ...leaseErrors], "Organization AI shutdown cleanup failed")
			: error;

		try {
			await clearOrganizationAIShutdown({ lease });
		} catch {
			throw new Error("Failed to stop organization AI activity and reopen chat", {
				cause: failure,
			});
		}

		throw failure;
	}
};

export const deleteOrganizationAIData = async ({ organizationId }: { organizationId: string }) => {
	const threads = await listOrganizationThreads({ organizationId });

	for (const batch of batchThreads(threads)) {
		await Promise.all(batch.map(({ id }) => dashboardChatMemory.deleteThread(id)));
	}

	const memoryStore = await mastraStorage.getStore("memory");

	if (await memoryStore?.getResourceById({ resourceId: organizationId })) {
		await memoryStore?.updateResource({ resourceId: organizationId, workingMemory: "" });
	}

	await deleteKnowledgeOrganization({ organizationId });
};
