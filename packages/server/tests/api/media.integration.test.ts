import { eq } from "drizzle-orm";
import { Files } from "files-sdk";
import { createFilesClient } from "files-sdk/client";
import { memory } from "files-sdk/memory";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db, members, users } from "@starter/db";

const mocks = vi.hoisted(() => {
	const storage: MutableReference<Files | undefined> = { value: undefined };

	return { getBlob: vi.fn(), getFile: vi.fn(), resolveSession: vi.fn(), storage };
});

vi.mock("../../src/lib/auth", () => ({ resolveSession: mocks.resolveSession }));

vi.mock("../../src/lib/blob-storage", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/lib/blob-storage")>()),
	getBlob: mocks.getBlob,
	getFilesClient: () => mocks.storage.value,
	getPublicBlobUrl: async (key: string) => `https://cdn.example.com/${key}`,
}));

vi.mock("../../src/services/storage", () => ({ getFile: mocks.getFile }));

import { handleFilesRequest } from "../../src/api/files";
import { handleGetMedia } from "../../src/api/media";
import { cleanupOrganization, createTestOrganization } from "../helpers/db";

type MutableReference<Value> = { value: Value };

const userId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d";

const fileId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32e";

const organizationIds: Array<string> = [];

const filesClient = ({ organizationId, purpose }: { organizationId: string; purpose: string }) => {
	const endpoint = `https://example.com/api/files?${new URLSearchParams({ organizationId, purpose })}`;

	const send = (input: RequestInfo | URL, init?: RequestInit) =>
		handleFilesRequest(
			new Request(input, { ...init, headers: { ...init?.headers, origin: "https://example.com" } })
		);

	return createFilesClient({
		endpoint,
		fetchImpl: send,
		transport: async ({ body, headers, method, url }) => {
			const response = await send(url, { body: body instanceof Blob ? body : null, headers, method });

			return { status: response.status, text: await response.text() };
		},
	});
};

afterEach(async () => {
	for (const organizationId of organizationIds) {
		await cleanupOrganization(organizationId);
	}

	organizationIds.length = 0;
	await db.delete(users).where(eq(users.id, userId));
});

describe("media HTTP integration", () => {
	const organizationIdReference: MutableReference<string | undefined> = { value: undefined };

	const mediaRequest = (organizationId = organizationIdReference.value ?? "", init?: RequestInit) =>
		new Request(`https://example.com/api/media?${new URLSearchParams({ fileId, organizationId })}`, init);

	beforeEach(async () => {
		vi.clearAllMocks();
		mocks.storage.value = new Files({ adapter: memory() });

		await db.insert(users).values({
			email: `media-${crypto.randomUUID()}@example.com`,
			emailVerified: true,
			id: userId,
			name: "Media User",
		});

		const organization = await createTestOrganization();
		organizationIdReference.value = organization.id;
		organizationIds.push(organization.id);

		await db.insert(members).values({
			id: crypto.randomUUID(),
			organizationId: organization.id,
			role: "admin",
			userId,
		});

		mocks.resolveSession.mockResolvedValue({
			session: { activeOrganizationId: organization.id },
			user: { email: "media@example.com", id: userId, name: "Media User" },
		});
	});

	it("redirects public media to its derived URL only after a live organization membership check", async () => {
		mocks.getFile.mockResolvedValue({
			access: "public",
			deletedAt: null,
			name: "photo.jpg",
			storageKey: "photo.jpg",
		});

		const response = await handleGetMedia(mediaRequest());

		expect(response.status).toBe(302);
		expect(mocks.resolveSession).toHaveBeenCalledWith(expect.any(Headers), false);
		expect(response.headers.get("location")).toBe("https://cdn.example.com/photo.jpg");
		expect(mocks.getFile).toHaveBeenCalledWith({ fileId, organizationId: organizationIdReference.value });
	});

	it("forbids cross-organization reads before looking up a file", async () => {
		const other = await createTestOrganization();
		organizationIds.push(other.id);

		await expect(handleGetMedia(mediaRequest(other.id))).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(mocks.getFile).not.toHaveBeenCalled();
	});

	it("serves private bytes and conditional 304 responses with safe headers", async () => {
		mocks.getFile.mockResolvedValue({
			access: "private",
			deletedAt: null,
			name: 'report"\n.pdf',
			storageKey: "org/report.pdf",
		});
		mocks.getBlob.mockResolvedValueOnce({ etag: "etag-1", status: 304 });

		const conditional = await handleGetMedia(mediaRequest(undefined, { headers: { "if-none-match": '"etag-1"' } }));

		expect(mocks.getBlob).toHaveBeenCalledWith({
			access: "private",
			ifNoneMatch: '"etag-1"',
			key: "org/report.pdf",
		});
		expect(conditional.status).toBe(304);
		expect(conditional.headers.get("etag")).toBe('"etag-1"');
		expect(conditional.headers.get("content-security-policy")).toContain("sandbox");
		expect(conditional.headers.get("x-content-type-options")).toBe("nosniff");

		mocks.getBlob.mockResolvedValueOnce({
			contentType: "application/pdf",
			etag: "etag-2",
			status: 200,
			stream: new Blob(["pdf-bytes"]).stream(),
		});

		const response = await handleGetMedia(mediaRequest());

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/pdf");
		expect(response.headers.get("content-disposition")).toBe('inline; filename="report.pdf"');
		expect(response.headers.get("content-security-policy")).toBe(
			"default-src 'none'; sandbox; frame-ancestors 'none'"
		);
		expect(await response.text()).toBe("pdf-bytes");
	});

	it.each(["text/html; charset=utf-8", "image/svg+xml", "application/xml", "application/octet-stream"])(
		"downloads private %s content with a script-blocking policy even without a filename",
		async (contentType) => {
			mocks.getFile.mockResolvedValue({ access: "private", deletedAt: null, storageKey: "org/document" });
			mocks.getBlob.mockResolvedValue({ contentType, status: 200, stream: new ReadableStream() });

			const response = await handleGetMedia(mediaRequest());

			expect(response.headers.get("content-disposition")).toBe("attachment");
			expect(response.headers.get("content-security-policy")).toContain("sandbox");
			expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		}
	);

	it("uploads through the files gateway under a server-minted organization and purpose prefix", async () => {
		const organizationId = organizationIdReference.value ?? "";
		const file = new File(["%PDF"], "report.pdf", { type: "application/pdf" });

		const { key } = await filesClient({ organizationId, purpose: "knowledge" }).upload(file);

		expect(key).toMatch(/^[0-9a-f-]+\.pdf$/);
		await expect(
			mocks.storage.value?.head(`development/${organizationId}/knowledge/${key}`)
		).resolves.toMatchObject({ contentType: "application/pdf", size: 4 });
	});

	it("rejects oversized, client-keyed, unauthenticated and Member uploads", async () => {
		const organizationId = organizationIdReference.value ?? "";
		const client = filesClient({ organizationId, purpose: "logo" });

		await expect(client.upload(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png"))).rejects.toThrow(
			"upload exceeds maxUploadSize"
		);
		await expect(client.upload("chosen.png", new Blob(["png"]))).rejects.toMatchObject({ code: "ReadOnly" });
		mocks.resolveSession.mockResolvedValueOnce(null);
		await expect(client.upload(new File(["png"], "logo.png"))).rejects.toMatchObject({ code: "Unauthorized" });
		await db.update(members).set({ role: "member" }).where(eq(members.userId, userId));
		await expect(client.upload(new File(["png"], "logo.png"))).rejects.toMatchObject({ code: "ReadOnly" });
		await expect(mocks.storage.value?.list()).resolves.toMatchObject({ items: [] });
	});

	it("rejects gateway requests without a valid upload scope", () => {
		expect(() =>
			handleFilesRequest(
				new Request(
					`https://example.com/api/files?organizationId=${organizationIdReference.value}&purpose=avatar`
				)
			)
		).toThrow("Invalid upload scope.");
	});
});
