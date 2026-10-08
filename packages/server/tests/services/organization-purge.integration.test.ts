import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	db,
	domainRegistrations,
	files,
	organizationPurges,
	organizations,
	websiteDomains,
	websites,
} from "@starter/db";

import {
	runOrganizationPurge,
	snapshotOrganizationPurge,
	sweepOrganizationPurges,
} from "../../src/services/organization-purge";

const mocks = vi.hoisted(() => ({
	deleteBlob: vi.fn(),
	deleteOrganizationAIData: vi.fn(),
	invalidateWebsiteHosts: vi.fn(),
	logError: vi.fn(),
	removeVercelDomain: vi.fn(),
	setVercelAutoRenew: vi.fn(),
}));

vi.mock("../../src/lib/blob-storage", () => ({ deleteBlob: mocks.deleteBlob }));

vi.mock("@starter/observability", () => ({
	log: { error: mocks.logError, info: vi.fn(), warn: vi.fn() },
	serializeLogError: (error: Error) => error,
}));

vi.mock("../../src/services/organization-ai-data", () => ({
	deleteOrganizationAIData: mocks.deleteOrganizationAIData,
}));

vi.mock("../../src/services/websites/vercel-domains", () => ({
	removeVercelDomain: mocks.removeVercelDomain,
	setVercelAutoRenew: mocks.setVercelAutoRenew,
}));

vi.mock("../../src/services/websites/website-host", () => ({
	invalidateWebsiteHosts: mocks.invalidateWebsiteHosts,
}));

const organizationIds: Array<string> = [];

const domains: Array<string> = [];

const blobHost = "https://store.public.blob.vercel-storage.com";

const createWorkspace = async () => {
	const organizationId = randomUUID();
	const websiteId = randomUUID();
	const domain = `${organizationId}.com`;
	organizationIds.push(organizationId);
	domains.push(domain, `pending-${domain}`);
	await db.insert(organizations).values({
		id: organizationId,
		logo: `${blobHost}/organizations/${organizationId}/logo.png`,
		name: "Purge test",
		slug: organizationId,
	});
	await db.insert(websites).values({
		brief: { location: "Toronto", name: "Test", schemaVersion: 1, type: "Design" },
		id: websiteId,
		locale: "en",
		organizationId,
	});

	const registrant = {
		address1: "1 Main St",
		city: "Toronto",
		country: "CA",
		email: "owner@example.com",
		firstName: "Ada",
		lastName: "Lovelace",
		phone: "+1.4165550100",
		state: "ON",
		zip: "M5V 1A1",
	};

	await db.insert(domainRegistrations).values([
		{ domain, organizationId, purchasePrice: 10, registrant, renewalPrice: 12, status: "active", websiteId },
		{ domain: `pending-${domain}`, organizationId, purchasePrice: 10, registrant, renewalPrice: 12 },
	]);
	await db.insert(websiteDomains).values([
		{ hostname: `www.${domain}`, ownershipVerified: true, websiteId },
		{ hostname: `new.${domain}`, websiteId },
	]);
	const file = { contentType: "image/png", name: "file.png", organizationId };
	await db.insert(files).values([
		{ ...file, url: `${blobHost}/${organizationId}/public.png` },
		{ ...file, access: "private", url: `https://store.private.blob.vercel-storage.com/${organizationId}/doc.pdf` },
		{ ...file, deletedAt: new Date().toISOString(), url: `${blobHost}/${organizationId}/deleted.png` },
		{ ...file, sourceType: "url", url: `${blobHost}/${organizationId}/linked.png` },
		{ ...file, url: `https://example.com/${organizationId}/external.png` },
	]);

	return { domain, organizationId, websiteId };
};

const readPurge = async (organizationId: string) => {
	const [purge] = await db
		.select()
		.from(organizationPurges)
		.where(eq(organizationPurges.organizationId, organizationId));

	return purge;
};

const deleteWorkspace = async (organizationId: string) => {
	const [organization] = await db
		.select({ logo: organizations.logo })
		.from(organizations)
		.where(eq(organizations.id, organizationId));

	await snapshotOrganizationPurge({ logo: organization?.logo ?? null, organizationId });
	await db.delete(organizations).where(eq(organizations.id, organizationId));
};

beforeEach(() => {
	vi.clearAllMocks();
	mocks.deleteBlob.mockResolvedValue(undefined);
	mocks.deleteOrganizationAIData.mockResolvedValue(undefined);
	mocks.removeVercelDomain.mockResolvedValue(undefined);
	mocks.setVercelAutoRenew.mockResolvedValue(undefined);
});

afterEach(async () => {
	await db.delete(organizationPurges).where(inArray(organizationPurges.organizationId, organizationIds));
	await db.delete(domainRegistrations).where(inArray(domainRegistrations.domain, domains));
	await db.delete(organizations).where(inArray(organizations.id, organizationIds));
	organizationIds.length = 0;
	domains.length = 0;
});

describe("organization purge", () => {
	it("snapshots upload blobs, the logo, verified hostnames and settled registrations", async () => {
		const { domain, organizationId, websiteId } = await createWorkspace();

		await snapshotOrganizationPurge({
			logo: `${blobHost}/organizations/${organizationId}/logo.png`,
			organizationId,
		});

		const purge = await readPurge(organizationId);
		expect(purge?.blobs).toHaveLength(4);
		expect(purge?.blobs).toEqual(
			expect.arrayContaining([
				{ access: "public", url: `${blobHost}/${organizationId}/public.png` },
				{ access: "private", url: `https://store.private.blob.vercel-storage.com/${organizationId}/doc.pdf` },
				{ access: "public", url: `${blobHost}/${organizationId}/deleted.png` },
				{ access: "public", url: `${blobHost}/organizations/${organizationId}/logo.png` },
			])
		);
		expect(purge?.hostnames).toEqual([{ hostname: `www.${domain}`, websiteId }]);
		expect(purge?.registrationDomains).toEqual([domain]);
		expect(purge?.completedAt).toBeNull();
	});

	it("resets an existing snapshot instead of duplicating it", async () => {
		const { organizationId } = await createWorkspace();
		await snapshotOrganizationPurge({ logo: null, organizationId });
		await db
			.update(organizationPurges)
			.set({ attempts: 3, completedAt: new Date().toISOString(), lastError: "blobs:1:Error" })
			.where(eq(organizationPurges.organizationId, organizationId));

		await snapshotOrganizationPurge({ logo: null, organizationId });

		const rows = await db
			.select()
			.from(organizationPurges)
			.where(eq(organizationPurges.organizationId, organizationId));

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ attempts: 0, completedAt: null, lastError: null });
	});

	it("refuses to purge a live organization", async () => {
		const { organizationId } = await createWorkspace();
		await snapshotOrganizationPurge({ logo: null, organizationId });

		expect(await runOrganizationPurge({ organizationId })).toEqual({ completed: false });
		expect(mocks.deleteOrganizationAIData).not.toHaveBeenCalled();
		expect(mocks.deleteBlob).not.toHaveBeenCalled();
		expect(mocks.removeVercelDomain).not.toHaveBeenCalled();
		expect(mocks.setVercelAutoRenew).not.toHaveBeenCalled();
		expect((await readPurge(organizationId))?.blobs).toHaveLength(3);
	});

	it("purges every external resource after the organization is deleted", async () => {
		const { domain, organizationId, websiteId } = await createWorkspace();
		await deleteWorkspace(organizationId);

		expect(await runOrganizationPurge({ organizationId })).toEqual({ completed: true });

		expect(mocks.deleteOrganizationAIData).toHaveBeenCalledWith({ organizationId });
		expect(mocks.deleteBlob).toHaveBeenCalledTimes(4);
		expect(mocks.deleteBlob).toHaveBeenCalledWith({
			access: "private",
			url: `https://store.private.blob.vercel-storage.com/${organizationId}/doc.pdf`,
		});
		expect(mocks.removeVercelDomain).toHaveBeenCalledExactlyOnceWith(`www.${domain}`);
		expect(mocks.invalidateWebsiteHosts).toHaveBeenCalledExactlyOnceWith({
			hostnames: [`www.${domain}`],
			websiteId,
		});
		expect(mocks.setVercelAutoRenew).toHaveBeenCalledExactlyOnceWith({ autoRenew: false, domain });

		const [registration] = await db
			.select()
			.from(domainRegistrations)
			.where(eq(domainRegistrations.domain, domain));

		expect(registration).toMatchObject({ autoRenew: false, organizationId: null });
		expect(await readPurge(organizationId)).toMatchObject({
			blobs: [],
			hostnames: [],
			lastError: null,
			registrationDomains: [],
		});
		expect((await readPurge(organizationId))?.completedAt).not.toBeNull();
	});

	it("keeps only failed blobs and resumes on the next run", async () => {
		const { organizationId } = await createWorkspace();
		await deleteWorkspace(organizationId);
		const failingUrl = `${blobHost}/${organizationId}/public.png`;
		mocks.deleteBlob.mockImplementation(async ({ url }: { url: string }) => {
			if (url === failingUrl) {
				throw new Error(`failed ${url}`);
			}
		});

		expect(await runOrganizationPurge({ organizationId })).toEqual({ completed: false });

		const failed = await readPurge(organizationId);
		expect(failed).toMatchObject({
			attempts: 1,
			blobs: [{ access: "public", url: failingUrl }],
			completedAt: null,
		});
		expect(failed?.lastError).toBe("blobs:1:Error");
		mocks.deleteBlob.mockResolvedValue(undefined);
		mocks.deleteBlob.mockClear();

		expect(await runOrganizationPurge({ organizationId })).toEqual({ completed: true });
		expect(mocks.deleteBlob).toHaveBeenCalledExactlyOnceWith({ access: "public", url: failingUrl });
	});

	it("does not remove a hostname another workspace has since connected", async () => {
		const { domain, organizationId } = await createWorkspace();
		await deleteWorkspace(organizationId);
		const other = await createWorkspace();
		await db.insert(websiteDomains).values({ hostname: `www.${domain}`, websiteId: other.websiteId });

		expect(await runOrganizationPurge({ organizationId })).toEqual({ completed: true });
		expect(mocks.removeVercelDomain).not.toHaveBeenCalled();
		expect(mocks.invalidateWebsiteHosts).not.toHaveBeenCalled();
	});

	it("sweeps pending purges, cancels stale live ones and reports exhausted ones", async () => {
		const pending = await createWorkspace();
		const stale = await createWorkspace();
		const exhausted = await createWorkspace();
		await deleteWorkspace(pending.organizationId);
		await deleteWorkspace(exhausted.organizationId);
		await snapshotOrganizationPurge({ logo: null, organizationId: stale.organizationId });
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
		expect(mocks.deleteOrganizationAIData).not.toHaveBeenCalledWith({ organizationId: exhausted.organizationId });
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
