import { ORPCError } from "@orpc/client";
import { describe, expect, it, vi } from "vitest";

import { createBlogSaveQueue, type BlogDraft } from "@/app/[locale]/dashboard/blog/use-blog-editor-controller";
import { createEmptyBlogPostDocument } from "@starter/infinite-website/contracts";

const initial = () => ({ document: createEmptyBlogPostDocument(), revision: 1, slug: "article" });

const draftWithTitle = (title: string): BlogDraft => {
	const document = createEmptyBlogPostDocument();
	document.en.title = title;

	return { document, slug: "article" };
};

describe("Blog save queue", () => {
	it("stops queued stale writes after a conflict and adopts the revision on explicit reload", async () => {
		const persist = vi.fn(async (input: BlogDraft & { revision: number }) => ({
			...input,
			revision: input.revision + 1,
		}));

		persist.mockRejectedValueOnce(new ORPCError("CONFLICT"));
		const queue = createBlogSaveQueue(initial(), persist);
		await Promise.all([
			expect(queue.save(draftWithTitle("First local edit"))).rejects.toMatchObject({ code: "CONFLICT" }),
			expect(queue.save(draftWithTitle("Newest local edit"))).rejects.toMatchObject({ code: "CONFLICT" }),
		]);
		await expect(queue.save(draftWithTitle("Retry while stale"))).rejects.toMatchObject({ code: "CONFLICT" });
		expect(persist).toHaveBeenCalledOnce();
		await queue.reload({ ...draftWithTitle("Another writer's content"), revision: 9 });
		const saved = await queue.save(draftWithTitle("Edit after loading latest"));
		expect(saved.revision).toBe(10);
		expect(persist.mock.calls.map(([input]) => input.revision)).toEqual([1, 9]);
	});

	it("serializes edits and uses the revision returned by the preceding save", async () => {
		const release = Promise.withResolvers<void>();

		const persist = vi.fn(async (draft: BlogDraft & { revision: number }) => {
			if (draft.revision === 1) {
				await release.promise;
			}

			return { ...draft, revision: draft.revision + 1 };
		});

		const queue = createBlogSaveQueue(initial(), persist);
		const first = queue.save(draftWithTitle("First"));
		const second = queue.save(draftWithTitle("Latest"));
		await Promise.resolve();
		expect(persist).toHaveBeenCalledTimes(1);
		release.resolve();
		expect((await first).revision).toBe(2);
		expect((await second).revision).toBe(3);
		expect(persist.mock.calls.map(([input]) => input.revision)).toEqual([1, 2]);
	});
	it("publishes only after the latest draft is saved and rebases later edits", async () => {
		const persist = vi.fn(async (draft: BlogDraft & { revision: number }) => ({
			...draft,
			revision: draft.revision + 1,
		}));

		const queue = createBlogSaveQueue(initial(), persist);
		const saved = queue.save(draftWithTitle("First"));
		const publish = vi.fn(async (post: ReturnType<typeof initial>) => ({ ...post, revision: post.revision + 1 }));
		const published = queue.mutate(draftWithTitle("Latest"), publish);
		await saved;
		expect((await published).revision).toBe(4);
		expect(publish).toHaveBeenCalledWith(
			expect.objectContaining({ document: draftWithTitle("Latest").document, revision: 3 })
		);
		expect((await queue.save(draftWithTitle("After publishing"))).revision).toBe(5);
		expect(persist.mock.calls.map(([input]) => input.revision)).toEqual([1, 2, 4]);
	});
	it("blocks publication on a failed flush and preserves the draft and revision for a retry", async () => {
		const draft = draftWithTitle("Keep local content");

		const persist = vi.fn(async (input: BlogDraft & { revision: number }) => ({
			...input,
			revision: input.revision + 1,
		}));

		persist.mockRejectedValueOnce(new Error("Network unavailable"));
		const publish = vi.fn();
		const queue = createBlogSaveQueue(initial(), persist);
		await expect(queue.mutate(draft, publish)).rejects.toThrow("Network unavailable");
		expect(publish).not.toHaveBeenCalled();
		expect(draft.document.en.title).toBe("Keep local content");
		expect((await queue.save(draft)).revision).toBe(2);
		expect(persist.mock.calls.map(([input]) => input.revision)).toEqual([1, 1]);
	});
	it("deduplicates equal autosaves and overlapping publish clicks", async () => {
		const hold = Promise.withResolvers<void>();

		const persist = vi.fn(async (draft: BlogDraft & { revision: number }) => ({
			...draft,
			revision: draft.revision + 1,
		}));

		const queue = createBlogSaveQueue(initial(), persist);
		const draft = draftWithTitle("One edit");
		await Promise.all([queue.save(draft), queue.save(draft)]);
		expect(persist).toHaveBeenCalledOnce();

		const publish = vi.fn(async (post: ReturnType<typeof initial>) => {
			await hold.promise;

			return { ...post, revision: post.revision + 1 };
		});

		const first = queue.mutate(draft, publish);
		const second = queue.mutate(draft, publish);
		hold.resolve();
		await Promise.all([first, second]);
		expect(publish).toHaveBeenCalledOnce();
		expect((await queue.save(draft)).revision).toBe(3);
		expect(persist).toHaveBeenCalledOnce();
	});
});
