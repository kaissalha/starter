import { Activity, type ReactNode } from "react";

import { ORPCError } from "@orpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBlogEditorController, type BlogEditorPost } from "@/app/[locale]/dashboard/blog/use-blog-editor-controller";
import { createEmptyBlogPostDocument } from "@starter/infinite-website/contracts";

import { mockOrganizationPermissions, organizationPermissionState } from "../../../mocks/organization-permissions";

const mocks = vi.hoisted(() => ({
	download: vi.fn(),
	generate: vi.fn(),
	get: vi.fn(),
	publish: vi.fn(),
	push: vi.fn(),
	update: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

vi.mock("@/utils/download-content", () => ({ downloadContent: mocks.download }));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const wrapper = ({ children }: { children: ReactNode }) => (
	<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
	vi.resetAllMocks();
	mocks.update.mockImplementation(async (input) => ({ ...post, ...input, revision: input.revision + 1 }));
	vi.spyOn(queryClient, "setQueryData");
	vi.spyOn(queryClient, "invalidateQueries");
});

vi.mock("@/lib/api-client", () => ({
	apiClient: {
		blogPosts: {
			get: { queryKey: () => ["blogPost"] },
			key: () => ["blogPosts"],
			list: { key: () => ["blogPosts", "list"] },
		},
	},
	client: { blogPosts: { generate: mocks.generate, get: mocks.get, publish: mocks.publish, update: mocks.update } },
}));

const post: BlogEditorPost = {
	createdAt: "2026-09-06T00:00:00Z",
	document: createEmptyBlogPostDocument(),
	firstPublishedAt: null,
	generationError: null,
	generationRunId: null,
	generationStatus: "idle",
	id: "17c25e85-eace-4790-a8bd-6a707f284247",
	organizationId: "organization",
	publishedAt: null,
	publishedDocument: null,
	publishedRevision: null,
	revision: 1,
	slug: "article",
	updatedAt: "2026-09-06T00:00:00Z",
};

afterEach(() => {
	cleanup();
	queryClient.clear();
	vi.restoreAllMocks();
	vi.clearAllMocks();
	vi.useRealTimers();
});

vi.mock("@/app/[locale]/dashboard/components/editor/use-website-languages", () => ({
	useWebsiteLanguages: () => ({ enabled: false }),
}));

describe("Blog editor save state", () => {
	it("does not autosave on mount or after a downgrade and keeps back navigation available", async () => {
		vi.useFakeTimers();
		const { rerender, result, unmount } = renderHook(() => useBlogEditorController(post), { wrapper });
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1000);
		});
		expect(mocks.update).not.toHaveBeenCalled();
		act(() => result.current.changeSlug("pending"));
		organizationPermissionState.role = "member";
		rerender();
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1000);
			await result.current.leave();
		});
		expect(mocks.update).not.toHaveBeenCalled();
		expect(mocks.push).toHaveBeenCalledWith("/dashboard/blog");
		unmount();
		vi.useRealTimers();
	});
	it("prevents member publication and admin deletion or unpublishing", async () => {
		organizationPermissionState.role = "member";
		const { rerender, result, unmount } = renderHook(() => useBlogEditorController(post), { wrapper });
		await act(async () => {
			await result.current.perform("publish");
		});
		expect(mocks.publish).not.toHaveBeenCalled();
		organizationPermissionState.role = "admin";
		rerender();
		await act(async () => {
			await result.current.perform("delete");
			await result.current.perform("unpublish");
		});
		expect(mocks.push).not.toHaveBeenCalled();
		expect(mocks.update).not.toHaveBeenCalled();
		unmount();
	});
	it("updates cached post state after saving and blocks leaving on save failure", async () => {
		mocks.update.mockRejectedValueOnce(new Error("Save failed"));
		const { result, unmount } = renderHook(() => useBlogEditorController(post), { wrapper });
		act(() => result.current.changeSlug("keep-me"));
		await act(async () => {
			await result.current.leave();
		});
		expect(mocks.push).not.toHaveBeenCalled();
		expect(result.current.draft.slug).toBe("keep-me");
		mocks.update.mockResolvedValueOnce({ ...post, revision: 2, slug: "keep-me" });
		await act(async () => {
			await result.current.leave();
		});
		expect(queryClient.setQueryData).toHaveBeenCalledWith(
			["blogPost"],
			expect.objectContaining({ revision: 2, slug: "keep-me" })
		);
		expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["blogPosts", "list"] });
		expect(mocks.push).toHaveBeenCalledWith("/dashboard/blog");
		unmount();
	});

	it("adopts the slug the server derives at first publication", async () => {
		mocks.publish.mockResolvedValue({ ...post, revision: 2, slug: "english-title" });
		const { result, unmount } = renderHook(() => useBlogEditorController(post), { wrapper });
		await act(async () => {
			await result.current.perform("publish");
		});
		expect(result.current.draft.slug).toBe("english-title");
		expect(result.current.status).toBe("saved");
		await act(async () => {
			await result.current.leave();
		});
		expect(mocks.update).not.toHaveBeenCalled();
		unmount();
	});

	it("flushes edits before starting generation", async () => {
		mocks.update.mockImplementation(async (input) => ({ ...post, ...input, revision: 2 }));
		mocks.generate.mockResolvedValue({ ...post, generationStatus: "writing", revision: 3, slug: "local" });
		const { result, unmount } = renderHook(() => useBlogEditorController(post), { wrapper });
		act(() => result.current.changeSlug("local"));
		await act(async () => {
			await result.current.perform("generate", undefined, {
				instructions: "Be concise",
				topic: "Useful article",
			});
		});
		expect(mocks.generate).toHaveBeenCalledWith({
			instructions: "Be concise",
			postId: post.id,
			revision: 2,
			topic: "Useful article",
		});
		expect(result.current.status).toBe("saved");
		unmount();
	});
	it("applies an asynchronous image change to the latest draft", () => {
		const { result, unmount } = renderHook(() => useBlogEditorController(post), { wrapper });
		const document = createEmptyBlogPostDocument();
		document.en.title = "Latest title";
		act(() => result.current.changeDocument(document));
		act(() =>
			result.current.updateDocument((current) => ({
				...current,
				coverImage: { src: "https://example.com/image.jpg" },
			}))
		);
		expect(result.current.draft.document.en.title).toBe("Latest title");
		expect(result.current.draft.document.coverImage?.src).toBe("https://example.com/image.jpg");
		unmount();
	});

	it("keeps newer edits unsaved when an older snapshot finishes saving", async () => {
		const request = Promise.withResolvers<BlogEditorPost>();
		mocks.update.mockReturnValueOnce(request.promise);
		const { result, unmount } = renderHook(() => useBlogEditorController(post), { wrapper });
		act(() => result.current.changeSlug("first"));
		const saving = { promise: Promise.resolve(post) };
		act(() => {
			saving.promise = result.current.save();
		});
		act(() => result.current.changeSlug("latest"));
		await act(async () => {
			request.resolve({ ...post, revision: 2, slug: "first" });
			await saving.promise;
		});
		expect(result.current.draft.slug).toBe("latest");
		expect(result.current.status).toBe("unsaved");
		unmount();
	});
	it("preserves the local draft and blocks publication when its save conflicts", async () => {
		mocks.update.mockRejectedValueOnce(new ORPCError("CONFLICT", { message: "Revision conflict" }));
		const { result, unmount } = renderHook(() => useBlogEditorController(post), { wrapper });
		act(() => result.current.changeSlug("local-draft"));
		await act(async () => {
			await result.current.perform("publish");
		});
		expect(mocks.publish).not.toHaveBeenCalled();
		expect(result.current.draft.slug).toBe("local-draft");
		expect(result.current.status).toBe("saveError");
		expect(result.current.error).toBe("conflict");
		expect(result.current.busy).toBe(false);
		unmount();
	});

	it.each(["hidden", "unmounted"] as const)("flushes the latest edit before 900ms when %s", async (navigation) => {
		vi.useFakeTimers();
		const request = Promise.withResolvers<BlogEditorPost>();
		mocks.update.mockReturnValueOnce(request.promise);
		const activity = { hidden: false };

		const activityWrapper = ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={queryClient}>
				<Activity mode={activity.hidden ? "hidden" : "visible"}>{children}</Activity>
			</QueryClientProvider>
		);

		const editor = renderHook(() => useBlogEditorController(post), { wrapper: activityWrapper });
		act(() => editor.result.current.changeSlug("leaving-immediately"));
		await act(async () => {
			if (navigation === "hidden") {
				activity.hidden = true;
				editor.rerender();
			} else {
				editor.unmount();
			}
		});
		expect(mocks.update).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ revision: 1, slug: "leaving-immediately" })
		);
		const saved = { ...post, revision: 2, slug: "leaving-immediately" };
		await act(async () => {
			request.resolve(saved);
			await request.promise;
		});
		expect(queryClient.getQueryData(["blogPost"])).toEqual(saved);
		expect(queryClient.getQueryCache().findAll({ queryKey: ["editor-draft"] })).toHaveLength(0);

		const returned =
			navigation === "hidden" ? editor : renderHook(() => useBlogEditorController(saved), { wrapper });

		await act(async () => {
			activity.hidden = false;
			returned.rerender();
		});
		expect(returned.result.current.status).toBe("saved");
		expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true);
	});

	it("retains a failed background save beyond query GC and retries the recovered draft", async () => {
		vi.useFakeTimers();
		mocks.update.mockRejectedValueOnce(new Error("Offline"));
		const editor = renderHook(() => useBlogEditorController(post), { wrapper });
		act(() => editor.result.current.changeSlug("recover-after-navigation"));
		await act(async () => editor.unmount());
		await act(async () => vi.advanceTimersByTimeAsync(600_000));
		expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(false);
		const recovered = renderHook(() => useBlogEditorController(post), { wrapper });
		expect(recovered.result.current.draft.slug).toBe("recover-after-navigation");
		expect(recovered.result.current.status).toBe("saveError");
		await act(async () => recovered.result.current.requestSave());
		expect(mocks.update).toHaveBeenLastCalledWith(
			expect.objectContaining({ revision: 1, slug: "recover-after-navigation" })
		);
		expect(recovered.result.current.status).toBe("saved");
	});

	it("loads the latest revision after a conflict and keeps one downloadable local draft", async () => {
		mocks.update.mockRejectedValueOnce(new ORPCError("CONFLICT"));
		const latestDocument = createEmptyBlogPostDocument();
		latestDocument.en.title = "Teammate title";
		const latest = { ...post, document: latestDocument, revision: 4, slug: "teammate-slug" };
		mocks.get.mockResolvedValueOnce(latest);
		const { result } = renderHook(() => useBlogEditorController(post), { wrapper });
		act(() => result.current.changeSlug("my-local-slug"));
		await act(async () => result.current.requestSave());
		await act(async () => result.current.requestSave());
		expect(mocks.update).toHaveBeenCalledOnce();
		expect(result.current.draft.slug).toBe("my-local-slug");
		await act(async () => result.current.reload());
		expect(result.current.draft).toEqual({ document: latestDocument, slug: "teammate-slug" });
		expect(result.current.recoveryDraft?.slug).toBe("my-local-slug");
		expect(result.current.error).toBeNull();
		act(() => result.current.downloadDraft());
		expect(mocks.download).toHaveBeenCalledWith(
			expect.objectContaining({ content: expect.stringContaining('"slug": "my-local-slug"') })
		);
		act(() => result.current.changeSlug("merged-slug"));
		await act(async () => result.current.requestSave());
		expect(mocks.update).toHaveBeenLastCalledWith({
			document: latestDocument,
			postId: post.id,
			revision: 4,
			slug: "merged-slug",
		});
		expect(result.current.status).toBe("saved");
	});

	it("discards retained drafts and ignores late save responses after the auth cache is cleared", async () => {
		const request = Promise.withResolvers<BlogEditorPost>();
		mocks.update.mockReturnValueOnce(request.promise);
		const editor = renderHook(() => useBlogEditorController(post), { wrapper });
		act(() => editor.result.current.changeSlug("previous-organization"));
		await act(async () => editor.unmount());
		queryClient.getQueryCache().clear();
		await act(async () => {
			request.resolve({ ...post, revision: 2, slug: "previous-organization" });
			await request.promise;
		});
		expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
		expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true);
	});
});

vi.mock("@/hooks/use-organization-permissions", () => ({
	useOrganizationPermissions: () => mockOrganizationPermissions(),
}));
