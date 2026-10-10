import { and, asc, eq, gt, gte, inArray, isNotNull, isNull, lt } from "drizzle-orm";

import { db, files, organizationPurges, organizations } from "@starter/db";
import { log } from "@starter/observability";

import { deleteBlob } from "../lib/blob-storage";

const PAGE_SIZE = 1000;

const BLOB_BATCH_SIZE = 25;

const MAX_ATTEMPTS = 20;

const THREAD_BATCH_SIZE = 100;

const chunk = <Item>(items: Array<Item>, size: number) =>
	Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

type PurgeBlob = { access: "private" | "public"; key: string };

const listUploadBlobs = async ({
	afterId,
	organizationId,
}: {
	afterId?: string;
	organizationId: string;
}): Promise<Array<PurgeBlob>> => {
	const rows = await db
		.select({ access: files.access, id: files.id, key: files.storageKey })
		.from(files)
		.where(
			and(
				eq(files.organizationId, organizationId),
				isNotNull(files.storageKey),
				afterId ? gt(files.id, afterId) : undefined
			)
		)
		.orderBy(asc(files.id))
		.limit(PAGE_SIZE);

	const blobs = rows.flatMap(({ access, key }) => (key ? [{ access, key }] : []));
	const lastId = rows.at(-1)?.id;

	return rows.length < PAGE_SIZE || !lastId
		? blobs
		: [...blobs, ...(await listUploadBlobs({ afterId: lastId, organizationId }))];
};

const summarizeFailures = (failures: Record<string, Array<unknown>>) =>
	Object.entries(failures)
		.filter(([, errors]) => errors.length)
		.map(
			([step, errors]) =>
				`${step}:${errors.length}:${[...new Set(errors.map((error) => (error instanceof Error ? error.name : "Error")))].join(",")}`
		)
		.join(" ");

export const deleteOrganizationAIData = async ({ organizationId }: { organizationId: string }) => {
	const [{ deleteKnowledgeOrganization }, { dashboardChatMemory, mastraStorage }, { cancelChatStream }] =
		await Promise.all([import("../ai/knowledge"), import("../ai/memory"), import("./chat")]);

	const { threads } = await dashboardChatMemory.listThreads({
		filter: { resourceId: organizationId },
		perPage: false,
	});

	for (const batch of chunk(threads, THREAD_BATCH_SIZE)) {
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

export const snapshotOrganizationPurge = async ({ organizationId }: { organizationId: string }) => {
	const values = {
		attempts: 0,
		blobs: await listUploadBlobs({ organizationId }),
		completedAt: null,
		lastError: null,
		updatedAt: new Date().toISOString(),
	};

	await db
		.insert(organizationPurges)
		.values({ ...values, organizationId })
		.onConflictDoUpdate({ set: values, target: organizationPurges.organizationId });
};

export const runOrganizationPurge = async ({ organizationId }: { organizationId: string }) => {
	const [purge] = await db
		.select()
		.from(organizationPurges)
		.where(eq(organizationPurges.organizationId, organizationId))
		.limit(1);

	if (!purge || purge.completedAt) {
		return { completed: true };
	}

	const [organization] = await db
		.select({ id: organizations.id })
		.from(organizations)
		.where(eq(organizations.id, organizationId))
		.limit(1);

	if (organization) {
		return { completed: false };
	}

	const updatePurge = (values: Partial<typeof organizationPurges.$inferInsert>) =>
		db
			.update(organizationPurges)
			.set({ ...values, updatedAt: new Date().toISOString() })
			.where(eq(organizationPurges.organizationId, organizationId));

	const [aiResult] = await Promise.allSettled([deleteOrganizationAIData({ organizationId })]);

	const blobResults: Array<PromiseSettledResult<void>> = [];
	const remainingBlobs = () => purge.blobs.filter((_, index) => blobResults[index]?.status !== "fulfilled");

	for (const batch of chunk(purge.blobs, BLOB_BATCH_SIZE)) {
		blobResults.push(...(await Promise.allSettled(batch.map((blob) => deleteBlob(blob)))));
		await updatePurge({ blobs: remainingBlobs() });
	}

	const rejected = (results: Array<PromiseSettledResult<unknown>>) =>
		results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));

	const lastError = summarizeFailures({
		ai: rejected([aiResult]),
		blobs: rejected(blobResults),
	});

	const blobs = remainingBlobs();
	const completed = !lastError && !blobs.length;

	await updatePurge(
		completed
			? { blobs, completedAt: new Date().toISOString(), lastError: null }
			: { attempts: purge.attempts + 1, blobs, lastError }
	);

	return { completed };
};

export const sweepOrganizationPurges = async ({ limit = 10 }: { limit?: number } = {}) => {
	const [pending, exhausted] = await Promise.all([
		db
			.select({
				existingOrganizationId: organizations.id,
				organizationId: organizationPurges.organizationId,
				updatedAt: organizationPurges.updatedAt,
			})
			.from(organizationPurges)
			.leftJoin(organizations, eq(organizations.id, organizationPurges.organizationId))
			.where(and(isNull(organizationPurges.completedAt), lt(organizationPurges.attempts, MAX_ATTEMPTS)))
			.orderBy(asc(organizationPurges.updatedAt))
			.limit(limit),
		db
			.select({ organizationId: organizationPurges.organizationId })
			.from(organizationPurges)
			.where(and(isNull(organizationPurges.completedAt), gte(organizationPurges.attempts, MAX_ATTEMPTS)))
			.limit(limit),
	]);

	await Promise.all(
		exhausted.map(({ organizationId }) =>
			log.error({ message: "Organization purge exhausted retries", organizationId })
		)
	);

	const stale = pending.filter(
		({ existingOrganizationId, updatedAt }) =>
			existingOrganizationId && Date.parse(updatedAt) < Date.now() - 24 * 60 * 60 * 1000
	);

	if (stale.length) {
		await db.delete(organizationPurges).where(
			and(
				inArray(
					organizationPurges.organizationId,
					stale.map(({ organizationId }) => organizationId)
				),
				isNull(organizationPurges.completedAt)
			)
		);
	}

	const results = await Promise.allSettled(
		pending
			.filter((row) => !stale.includes(row))
			.map(({ organizationId }) => runOrganizationPurge({ organizationId }))
	);

	const completed = results.filter((result) => result.status === "fulfilled" && result.value.completed).length;

	return { cancelled: stale.length, completed, failed: results.length - completed };
};
