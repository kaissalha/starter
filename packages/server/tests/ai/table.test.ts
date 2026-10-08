import { noopObserve } from "@mastra/core/tools";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	downloadBlob: vi.fn(),
	getFile: vi.fn(),
	readTabularFile: vi.fn(),
	requireOrganizationPermission: vi.fn(),
}));

vi.mock("../../src/lib/blob-storage", () => ({ downloadBlob: mocks.downloadBlob }));

vi.mock("@starter/documents/extraction", () => ({ readTabularFile: mocks.readTabularFile }));

vi.mock("../../src/services/permissions", () => ({
	requireOrganizationPermission: mocks.requireOrganizationPermission,
}));

vi.mock("../../src/services/storage", () => ({ getFile: mocks.getFile }));

import { tableTools } from "../../src/ai/tools/table";
import { createDashboardChatRequestContext } from "../../src/ai/types";

const fileId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d";

const requestContext = createDashboardChatRequestContext({ organizationId: "org-1", userId: "user-1" });

const execute = tableTools.inspectTable.execute;

if (!execute) {
	throw new Error("inspectTable execute handler is missing");
}

describe("inspect table tool", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getFile.mockResolvedValue({
			access: "private",
			contentType: "text/csv",
			deletedAt: null,
			name: "sales.csv",
			ragStatus: "ready",
			url: "https://example.com/sales.csv",
		});
		mocks.downloadBlob.mockResolvedValue({ body: Buffer.from("name,amount") });
		mocks.readTabularFile.mockResolvedValue([
			{
				rows: [
					["name", "amount", "other"],
					["Alice", "10", "2"],
					["Bob", "bad", "3"],
					["Cara", "", "4"],
					["Dan", "5", "5"],
					["Eva", "2", "6"],
					["Fay", "3", "7"],
				],
				sheet: "CSV",
			},
		]);
	});

	it("scopes access and reports mixed numeric columns without a partial sum", async () => {
		const result = await execute({ fileId }, { observe: noopObserve, requestContext });
		expect(mocks.requireOrganizationPermission).toHaveBeenCalledWith({
			organizationId: "org-1",
			permission: "read",
			userId: "user-1",
		});
		expect(mocks.getFile).toHaveBeenCalledWith({ fileId, organizationId: "org-1" });
		expect(result).toMatchObject({
			columnCount: 3,
			columns: [
				{ name: "name", nonNumericCount: 6, numericCount: 0, sum: null },
				{ max: null, min: null, missing: 1, name: "amount", nonNumericCount: 1, numericCount: 4, sum: null },
				{ name: "other", nonNumericCount: 0, numericCount: 6, sum: 27 },
			],
			rowCount: 6,
			sample: [
				{ recordNumber: 1, values: ["Alice", "10", "2"] },
				{ recordNumber: 2, values: ["Bob", "bad", "3"] },
				{ recordNumber: 3, values: ["Cara", "", "4"] },
				{ recordNumber: 4, values: ["Dan", "5", "5"] },
				{ recordNumber: 5, values: ["Eva", "2", "6"] },
			],
		});
	});

	it("rejects inaccessible and unready files before downloading", async () => {
		mocks.getFile.mockResolvedValueOnce(null).mockResolvedValueOnce({
			access: "private",
			contentType: "text/csv",
			deletedAt: null,
			name: "sales.csv",
			ragStatus: "pending",
			url: "https://example.com/sales.csv",
		});
		await expect(execute({ fileId }, { observe: noopObserve, requestContext })).rejects.toThrow(
			"Table file is not available"
		);
		await expect(execute({ fileId }, { observe: noopObserve, requestContext })).rejects.toThrow(
			"Table file is not available"
		);
		expect(mocks.downloadBlob).not.toHaveBeenCalled();
	});

	it("inspects a named XLSX sheet", async () => {
		mocks.getFile.mockResolvedValueOnce({
			access: "private",
			contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			deletedAt: null,
			name: "sales.xlsx",
			ragStatus: "ready",
			url: "https://example.com/sales.xlsx",
		});
		mocks.readTabularFile.mockResolvedValueOnce([
			{ rows: [["item"], ["A"]], sheet: "Sales" },
			{ rows: [["item"], ["B"]], sheet: "Other" },
		]);
		const result = await execute({ fileId, sheet: "Other" }, { observe: noopObserve, requestContext });
		expect(result).toMatchObject({
			rowCount: 1,
			sample: [{ recordNumber: 1, values: ["B"] }],
			sheet: "Other",
			sheetNames: ["Sales", "Other"],
		});
	});
});
