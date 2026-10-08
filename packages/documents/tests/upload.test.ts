import { describe, expect, it } from "vitest";

import { getDocumentViewerKind, isKnowledgeFile, isUploadAllowed, uploadPolicies } from "../src/upload";

const megabytes = (value: number) => value * 1024 * 1024;

describe("upload policies", () => {
	it("checks content type and size against the purpose policy", () => {
		expect(isUploadAllowed({ mediaType: "image/png", purpose: "image", sizeBytes: megabytes(10) })).toBe(true);
		expect(isUploadAllowed({ mediaType: "image/png", purpose: "image", sizeBytes: megabytes(10) + 1 })).toBe(false);
		expect(isUploadAllowed({ mediaType: "image/heic", purpose: "image", sizeBytes: 1 })).toBe(false);
		expect(isUploadAllowed({ mediaType: "image/svg+xml", purpose: "logo", sizeBytes: 1 })).toBe(true);
		expect(isUploadAllowed({ mediaType: "video/mp4", purpose: "video", sizeBytes: 0 })).toBe(false);
		expect(uploadPolicies.knowledge.access).toBe("private");
	});

	it("accepts knowledge files by the same rules the server enforces", () => {
		expect(isKnowledgeFile({ filename: "notes.md", mediaType: "" })).toBe(true);
		expect(isKnowledgeFile({ filename: "report.pdf", mediaType: "application/pdf" })).toBe(true);
		expect(isKnowledgeFile({ filename: "photo.png", mediaType: "image/png" })).toBe(true);
		expect(isKnowledgeFile({ filename: "script.py", mediaType: "text/x-python" })).toBe(false);
		expect(isKnowledgeFile({ filename: "archive.zip", mediaType: "application/zip" })).toBe(false);
	});

	it("maps document content types to viewers", () => {
		expect(getDocumentViewerKind("application/pdf")).toBe("pdf");
		expect(getDocumentViewerKind("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("xlsx");
		expect(getDocumentViewerKind("text/plain")).toBeUndefined();
	});
});
