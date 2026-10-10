import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db, files, organizationPurges, organizations } from "@starter/db";

import {
	runOrganizationPurge,
	snapshotOrganizationPurge,
	sweepOrganizationPurges,
} from "../../src/services/organization-purge";

const mocks = vi.hoisted(() => ({
	deleteBlob: vi.fn(),
	deleteKnowledgeOrganization: vi.fn(),
	logError: vi.fn(),
}));

vi.mock("../../src/lib/blob-storage", () => ({ deleteBlob: mocks.deleteBlob }));

vi.mock("@starter/observability", () => ({
	log: { error: mocks.logError, info: vi.fn(), warn: vi.fn() },
	serializeLogError: (error: Error) => error,
}));

vi.mock("../../src/ai/knowledge", () => ({ deleteKnowledgeOrganization: mocks.deleteKnowledgeOrganization }));

vi.mock("../../src/ai/memory", async () => (await import("../helpers/ai")).emptyMastraMemoryMock);

const organizationIds: Array<string> = [];

const createWorkspace = async () => {
	const organizationId = randomUUID();
	organizationIds.push(organizationId);
	await db.insert(organizations).values({
		id: organizationId,
		name: "Purge test",
		slug: organizationId,
	});
	const file = { contentType: "image/png", name: "file.png", organizationId };
	await db.insert(files).values([
		{ ...file, storageKey: `${organizationId}/public.png` },
		{ ...file, access: "private", storageKey: `${organizationId}/doc.pdf` },
		{ ...file, deletedAt: new Date().toISOString(), storageKey: `${organizationId}/deleted.png` },
		{ ...file, sourceType: "text" },
	]);

	return { organizationId };
};

const readPurge = async (organizationId: string) => {
	const [purge] = await db
		.select()
		.from(organizationPurges)
		.where(eq(organizationPurges.organizationId, organizationId));

	return purge;
};

const deleteWorkspace = async (organizationId: string) => {
	await snapshotOrganizationPurge({ organizationId });
	await db.delete(organizations).where(eq(organizations.id, organizationId));
};

beforeEach(() => {
	vi.clearAllMocks();
	mocks.deleteBlob.mockResolvedValue(undefined);
});

afterEach(async () => {
	await db.delete(organizationPurges).where(inArray(organizationPurges.organizationId, organizationIds));
	await db.delete(organizations).where(inArray(organizations.id, organizationIds));
	organizationIds.length = 0;
});

describe("organization purge", () => {
	it("snapshots every stored object, including soft-deleted files", async () => {
		const { organizationId } = await createWorkspace();

		await snapshotOrganizationPurge({ organizationId });

		const purge = await readPurge(organizationId);
		expect(purge?.blobs).toHaveLength(3);
		expect(purge?.blobs).toEqual(
			expect.arrayContaining([
				{ access: "public", key: `${organizationId}/public.png` },
				{ access: "private", key: `${organizationId}/doc.pdf` },
				{ access: "public", key: `${organizationId}/deleted.png` },
			])
		);
		expect(purge?.completedAt).toBeNull();
	});

	it("resets an existing snapshot instead of duplicating it", async () => {
		const { organizationId } = await createWorkspace();
		await snapshotOrganizationPurge({ organizationId });
		await db
			.update(organizationPurges)
			.set({ attempts: 3, completedAt: new Date().toISOString(), lastError: "blobs:1:Error" })
			.where(eq(organizationPurges.organizationId, organizationId));

		await snapshotOrganizationPurge({ organizationId });

		const rows = await db
			.select()
			.from(organizationPurges)
			.where(eq(organizationPurges.organizationId, organizationId));

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ attempts: 0, completedAt: null, lastError: null });
	});

	it("refuses to purge a live organization", async () => {
		const { organizationId } = await createWorkspace();
		await snapshotOrganizationPurge({ organizationId });

		expect(await runOrganizationPurge({ organizationId })).toEqual({ completed: false });
		expect(mocks.deleteKnowledgeOrganization).not.toHaveBeenCalled();
		expect(mocks.deleteBlob).not.toHaveBeenCalled();
		expect((await readPurge(organizationId))?.blobs).toHaveLength(3);
	});

	it("purges every external resource after the organization is deleted", async () => {
		const { organizationId } = await createWorkspace();
		await deleteWorkspace(organizationId);

		expect(await runOrganizationPurge({ organizationId })).toEqual({ completed: true });

		expect(mocks.deleteKnowledgeOrganization).toHaveBeenCalledWith({ organizationId });
		expect(mocks.deleteBlob).toHaveBeenCalledTimes(3);
		expect(mocks.deleteBlob).toHaveBeenCalledWith({ access: "private", key: `${organizationId}/doc.pdf` });
		expect(await readPurge(organizationId)).toMatchObject({
			blobs: [],
			lastError: null,
		});
		expect((await readPurge(organizationId))?.completedAt).not.toBeNull();
	});

	it("keeps only failed blobs and resumes on the next run", async () => {
		const { organizationId } = await createWorkspace();
		await deleteWorkspace(organizationId);
		const failingKey = `${organizationId}/public.png`;
		mocks.deleteBlob.mockImplementation(async ({ key }: { key: string }) => {
			if (key === failingKey) {
				throw new Error(`failed ${key}`);
			}
		});

		expect(await runOrganizationPurge({ organizationId })).toEqual({ completed: false });

		const failed = await readPurge(organizationId);
		expect(failed).toMatchObject({
			attempts: 1,
			blobs: [{ access: "public", key: failingKey }],
			completedAt: null,
		});
		expect(failed?.lastError).toBe("blobs:1:Error");
		mocks.deleteBlob.mockResolvedValue(undefined);
		mocks.deleteBlob.mockClear();

		expect(await runOrganizationPurge({ organizationId })).toEqual({ completed: true });
		expect(mocks.deleteBlob).toHaveBeenCalledExactlyOnceWith({ access: "public", key: failingKey });
	});

	it("sweeps pending purges, cancels stale live ones and reports exhausted ones", async () => {
		const pending = await createWorkspace();
		const stale = await createWorkspace();
		const exhausted = await createWorkspace();
		await deleteWorkspace(pending.organizationId);
		await deleteWorkspace(exhausted.organizationId);
		await snapshotOrganizationPurge({ organizationId: stale.organizationId });
		await db
			.update(organizationPurges)
			.set({ updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() })
			.where(eq(organizationPurges.organizationId, stale.organizationId));
		await db
			.update(organizationPurges)
			.set({ attempts: 20 })
			.where(eq(organizationPurges.organizationId, exhausted.organizationId));

		const result = await sweepOrganizationPurges({ limit: 100 });

		expect(result.cancelled).toBeGreaterThanOrEqual(1);
		expect(result.completed).toBeGreaterThanOrEqual(1);
		expect(await readPurge(stale.organizationId)).toBeUndefined();
		expect((await readPurge(pending.organizationId))?.completedAt).not.toBeNull();
		expect(mocks.deleteKnowledgeOrganization).not.toHaveBeenCalledWith({
			organizationId: exhausted.organizationId,
		});
		expect((await readPurge(exhausted.organizationId))?.completedAt).toBeNull();
		expect(mocks.logError).toHaveBeenCalledWith({
			message: "Organization purge exhausted retries",
			organizationId: exhausted.organizationId,
		});
	});

	it("makes no external calls for a completed purge", async () => {
		const { organizationId } = await createWorkspace();
		await deleteWorkspace(organizationId);
		await runOrganizationPurge({ organizationId });
		vi.clearAllMocks();

		expect(await runOrganizationPurge({ organizationId })).toEqual({ completed: true });

		for (const mock of Object.values(mocks)) {
			expect(mock).not.toHaveBeenCalled();
		}
	});
});
