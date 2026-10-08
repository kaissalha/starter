import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useBlogGenerationStream } from "@/app/[locale]/dashboard/blog/use-blog-generation-stream";
import { createEmptyBlogPostDocument } from "@starter/infinite-website/contracts";

const mocks = vi.hoisted(() => ({ queryClient: { invalidateQueries: vi.fn() }, stream: vi.fn() }));

vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => mocks.queryClient }));

vi.mock("@/lib/api-client", () => ({
	apiClient: { blogPosts: { get: { queryOptions: () => ({ queryKey: ["post"] }) } } },
	client: { blogPosts: { streamGeneration: mocks.stream } },
}));

const post = { document: createEmptyBlogPostDocument(), generationRunId: "run", id: "post" };

describe("blog generation preview subscription", () => {
	beforeEach(() => vi.resetAllMocks());

	it("renders partial content before completion and reconciles the saved draft", async () => {
		const finished = Promise.withResolvers<void>();
		const partial = { ...post.document, en: { ...post.document.en, title: "Growing draft" } };
		mocks.stream.mockResolvedValue({
			async *[Symbol.asyncIterator]() {
				yield { cursor: "0", document: partial, locale: "ar" };
				await finished.promise;
			},
		});
		const { result, unmount } = renderHook(() => useBlogGenerationStream(post));
		await waitFor(() => expect(result.current.document.en.title).toBe("Growing draft"));
		expect(result.current.locale).toBe("ar");
		expect(mocks.queryClient.invalidateQueries).not.toHaveBeenCalled();
		await act(async () => finished.resolve());
		expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["post"] });
		unmount();
		expect(mocks.stream.mock.calls[0]?.[1].signal.aborted).toBe(true);
	});

	it("resumes after the last received cursor when delivery fails", async () => {
		mocks.stream.mockResolvedValueOnce({
			async *[Symbol.asyncIterator]() {
				yield { cursor: "7", document: post.document, locale: "en" };
				throw new Error("disconnected");
			},
		});
		mocks.stream.mockResolvedValueOnce({
			async *[Symbol.asyncIterator]() {
				yield { cursor: "8", document: post.document, locale: "en" };
			},
		});
		const { unmount } = renderHook(() => useBlogGenerationStream(post));
		await waitFor(() => expect(mocks.stream).toHaveBeenCalledTimes(2));
		expect(mocks.stream.mock.calls[1]?.[0]).toEqual({ afterCursor: "7", postId: "post", runId: "run" });
		unmount();
	});
});
