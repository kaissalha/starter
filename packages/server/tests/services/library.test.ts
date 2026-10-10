import { describe, expect, it, vi } from "vitest";

vi.mock("@starter/db", () => ({ db: {}, files: {} }));

vi.mock("../../src/lib/blob-storage", () => ({ uploadBufferToBlob: vi.fn() }));

vi.mock("../../src/ai/models", () => ({ models: {} }));

vi.mock("../../src/services/documents", () => ({ startFileIngestion: vi.fn() }));

vi.mock("../../src/services/storage", () => ({ createFile: vi.fn(), deleteFile: vi.fn(), getFile: vi.fn() }));

import { applyLibraryDocumentEdits, LibraryError } from "../../src/services/library";

describe("applyLibraryDocumentEdits", () => {
	it("applies exact replacements in order without interpreting replacement patterns", () => {
		expect(
			applyLibraryDocumentEdits({
				content: "# Prices\n\nMowing: $40\nEdging: $20",
				edits: [
					{ find: "Mowing: $40", replace: "Mowing: $45 ($& extra)" },
					{ find: "\nEdging: $20", replace: "" },
				],
			})
		).toBe("# Prices\n\nMowing: $45 ($& extra)");
	});

	it.each(["missing", "a"])("rejects text that does not match exactly once: %s", (find) => {
		expect(() => applyLibraryDocumentEdits({ content: "a b a", edits: [{ find, replace: "x" }] })).toThrow(
			LibraryError
		);
	});
});
