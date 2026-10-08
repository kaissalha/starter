import { describe, expect, it } from "vitest";

import { getDisplayFileExtension, getExtensionFromMediaType, getFileExtension } from "../src/file";

describe("file extensions", () => {
	it("prefers filename extensions and falls back to media type", () => {
		expect(getFileExtension({ filename: "notes.md", mediaType: "text/plain" })).toBe("md");
		expect(getFileExtension({ filename: "upload", mediaType: "application/pdf" })).toBe("pdf");
	});

	it("normalizes structured media types", () => {
		expect(getExtensionFromMediaType({ mediaType: "application/vnd.openxmlformats+json" })).toBe(
			"vnd.openxmlformats"
		);
		expect(getExtensionFromMediaType({ mediaType: "image/svg+xml; charset=utf-8" })).toBe("svg");
	});

	it("returns uppercase display labels", () => {
		expect(getDisplayFileExtension({ filename: "report.pdf", mediaType: "application/pdf" })).toBe("PDF");
		expect(getDisplayFileExtension({ filename: undefined, mediaType: "image/png" })).toBe("PNG");
	});
});
