import { beforeEach, describe, expect, it, vi } from "vitest";

import { createEmptyBlogPostDocument } from "@starter/infinite-website/contracts";

const mocks = vi.hoisted(() => ({ getRun: vi.fn(), read: vi.fn(), readable: vi.fn(), requireMember: vi.fn() }));

vi.mock("workflow/api", () => ({ getRun: mocks.getRun }));

vi.mock("../../src/services/blog-posts/access", () => ({
	readBlogPost: mocks.read,
	requireBlogMember: mocks.requireMember,
}));

import { streamBlogGeneration } from "../../src/services/blog-posts/stream";

const actor = { organizationId: "org", userId: "user" };

const input = { postId: "post", runId: "run" };

describe("blog generation stream", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mocks.read.mockResolvedValue({ generationRunId: "run", generationStatus: "writing" });
		mocks.getRun.mockReturnValue({ exists: true, getReadable: mocks.readable });
	});

	it("authorizes the post and resumes snapshots after the last cursor", async () => {
		const document = createEmptyBlogPostDocument();
		document.en.title = "Streaming";
		mocks.readable.mockReturnValue(
			new ReadableStream({
				start: (controller) => {
					controller.enqueue({ document, locale: "en" });
					controller.close();
				},
			})
		);
		const events = await streamBlogGeneration({ actor, input: { ...input, afterCursor: "4" } });
		expect(await Array.fromAsync(events)).toEqual([{ cursor: "5", document, locale: "en" }]);
		expect(mocks.requireMember).toHaveBeenCalledWith({ actor });
		expect(mocks.read).toHaveBeenCalledWith({ organizationId: "org", postId: "post" });
		expect(mocks.readable).toHaveBeenCalledWith({ startIndex: 5 });
	});

	it("rejects stale runs before accessing workflow content", async () => {
		mocks.read.mockResolvedValue({ generationRunId: "other-run", generationStatus: "writing" });
		await expect(streamBlogGeneration({ actor, input })).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect(mocks.getRun).not.toHaveBeenCalled();
	});

	it("does not read content for callers without organization access", async () => {
		mocks.requireMember.mockRejectedValue(new Error("forbidden"));
		await expect(streamBlogGeneration({ actor, input })).rejects.toThrow("forbidden");
		expect(mocks.read).not.toHaveBeenCalled();
		expect(mocks.getRun).not.toHaveBeenCalled();
	});

	it("cancels the workflow reader when the subscriber leaves", async () => {
		const cancel = vi.fn();
		mocks.readable.mockReturnValue(
			new ReadableStream({
				cancel,
				start: (controller) => controller.enqueue({ document: createEmptyBlogPostDocument(), locale: "ar" }),
			})
		);
		const events = await streamBlogGeneration({ actor, input });
		await events.next();
		await events.return?.();
		await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce());
	});
});
