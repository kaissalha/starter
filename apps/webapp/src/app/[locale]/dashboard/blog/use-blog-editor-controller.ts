"use client";

import { useCallback, useEffect, useEffectEvent } from "react";

import { ORPCError } from "@orpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "zustand";

import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { useRouter } from "@/i18n/navigation";
import { apiClient, client } from "@/lib/api-client";
import { downloadContent } from "@/utils/download-content";
import type { BlogPostDocument } from "@starter/infinite-website";
import type { Iso6391LanguageCode } from "@starter/infinite-website/contracts";

import { useEditorDraftSession } from "../components/editor/use-editor-draft-session";
import { useWebsiteLanguages } from "../components/editor/use-website-languages";

export type BlogEditorPost = Awaited<ReturnType<typeof client.blogPosts.get>>;

export type BlogDraft = { document: BlogPostDocument; slug: string };

export const createBlogSaveQueue = <TPost extends BlogDraft & { revision: number }>(
	initial: TPost,
	persist: (draft: BlogDraft & { revision: number }) => Promise<TPost>
) => {
	const state = {
		conflict: false,
		mutating: false,
		pending: new Promise<TPost>((resolve) => resolve(initial)),
		saved: initial,
		savedKey: JSON.stringify({ document: initial.document, slug: initial.slug }),
	};

	const write = async (draft: BlogDraft) => {
		if (state.conflict) {
			throw new ORPCError("CONFLICT");
		}

		const key = JSON.stringify(draft);

		if (key === state.savedKey) {
			return state.saved;
		}

		const saved = await persist({ ...draft, revision: state.saved.revision });
		state.saved = saved;
		state.savedKey = key;

		return saved;
	};

	const enqueue = (operation: () => Promise<TPost>) => {
		const previous = state.pending;
		state.pending = (async () => {
			try {
				await previous;
			} catch {}

			try {
				return await operation();
			} catch (error) {
				if (error instanceof ORPCError && error.code === "CONFLICT") {
					state.conflict = true;
				}

				throw error;
			}
		})();

		return state.pending;
	};

	return {
		mutate: (draft: BlogDraft, operation: (post: TPost) => Promise<TPost | void>) => {
			if (state.mutating) {
				return state.pending;
			}

			state.mutating = true;

			return enqueue(async () => {
				try {
					const saved = await write(draft);
					const result = await operation(saved);

					if (result) {
						state.saved = result;
						state.savedKey = JSON.stringify({ document: result.document, slug: result.slug });
					}

					return state.saved;
				} finally {
					state.mutating = false;
				}
			});
		},
		reload: (post: TPost) =>
			enqueue(async () => {
				state.conflict = false;
				state.saved = post;
				state.savedKey = JSON.stringify({ document: post.document, slug: post.slug });

				return post;
			}),
		save: (draft: BlogDraft) => enqueue(() => write(draft)),
	};
};

type EditorState = {
	busy: boolean;
	contentVersion: number;
	draft: BlogDraft;
	error: "conflict" | "request" | null;
	recoveryDraft: BlogDraft | null;
	status: "saved" | "saving" | "unsaved" | "saveError";
	version: number;
};

type DocumentUpdate = (current: BlogPostDocument) => BlogPostDocument;

type EditorAction =
	| { type: "document"; update: DocumentUpdate }
	| { patch: Partial<BlogDraft>; type: "change" }
	| { slug?: string; type: "saving" | "saved"; version: number }
	| { error: "conflict" | "request"; type: "error"; version: number }
	| { busy: boolean; type: "busy" };

const reduceEditor = (state: EditorState, action: EditorAction): EditorState => {
	if (action.type === "document") {
		const document = action.update(state.draft.document);

		return { ...state, draft: { ...state.draft, document }, status: "unsaved", version: state.version + 1 };
	}

	if (action.type === "change") {
		return { ...state, draft: { ...state.draft, ...action.patch }, status: "unsaved", version: state.version + 1 };
	}

	if (action.type === "busy") {
		return { ...state, busy: action.busy };
	}

	if (action.version !== state.version) {
		return state;
	}

	if (action.type === "error") {
		return { ...state, error: action.error, status: "saveError" };
	}

	if (action.type === "saved" && action.slug && action.slug !== state.draft.slug) {
		return { ...state, draft: { ...state.draft, slug: action.slug }, error: null, status: action.type };
	}

	return { ...state, error: null, status: action.type };
};

export const useBlogEditorController = (post: BlogEditorPost) => {
	const { can } = useOrganizationPermissions();
	const languages = useWebsiteLanguages();
	const queryClient = useQueryClient();
	const router = useRouter();

	const { isActive, store } = useEditorDraftSession<
		EditorState & { queue: ReturnType<typeof createBlogSaveQueue<BlogEditorPost>> }
	>({
		create: (active, previous) => ({
			busy: false,
			contentVersion: 0,
			draft: { document: post.document, slug: post.slug },
			error: null,
			queue: createBlogSaveQueue(post, (input) =>
				active()
					? client.blogPosts.update({ postId: post.id, ...input })
					: Promise.reject(new Error("Editor session ended"))
			),
			recoveryDraft: previous?.recoveryDraft ?? null,
			status: "saved",
			version: 0,
		}),
		id: `blog:${post.id}`,
		resume: (state) => state.busy || state.status !== "saved",
		retain: (state) => state.busy || state.status !== "saved" || state.recoveryDraft !== null,
	});

	const { queue, ...state } = useStore(store);

	const dispatch = useCallback(
		(action: EditorAction) => store.setState((current) => reduceEditor(current, action)),
		[store]
	);

	const save = useCallback(async () => {
		if (!isActive() || !can("workspace.write")) {
			return post;
		}

		const { draft, version } = store.getState();
		dispatch({ type: "saving", version });

		try {
			const saved = await queue.save(draft);

			if (isActive()) {
				queryClient.setQueryData(apiClient.blogPosts.get.queryKey({ input: { postId: post.id } }), saved);
				await queryClient.invalidateQueries({ queryKey: apiClient.blogPosts.list.key() });
			}

			dispatch({ type: "saved", version });

			return saved;
		} catch (error) {
			dispatch({
				error: error instanceof ORPCError && error.code === "CONFLICT" ? "conflict" : "request",
				type: "error",
				version,
			});
			throw error;
		}
	}, [can, dispatch, isActive, post, queryClient, queue, store]);

	const requestSave = async () => {
		try {
			await save();
		} catch {}
	};

	const reload = async () => {
		dispatch({ busy: true, type: "busy" });

		try {
			const latest = await client.blogPosts.get({ postId: post.id });

			if (!isActive()) {
				return;
			}

			await queue.reload(latest);
			store.setState((current) => ({
				contentVersion: current.contentVersion + 1,
				draft: { document: latest.document, slug: latest.slug },
				error: null,
				recoveryDraft: current.draft,
				status: "saved",
				version: current.version + 1,
			}));
			queryClient.setQueryData(apiClient.blogPosts.get.queryKey({ input: { postId: post.id } }), latest);
		} catch {
			dispatch({
				error: "conflict",
				type: "error",
				version: store.getState().version,
			});
		} finally {
			dispatch({ busy: false, type: "busy" });
		}
	};

	const leave = async () => {
		dispatch({ busy: true, type: "busy" });

		try {
			await save();

			if (isActive()) {
				router.push("/dashboard/blog");
			}
		} catch {
		} finally {
			dispatch({ busy: false, type: "busy" });
		}
	};

	const autosave = useEffectEvent(async () => {
		const current = store.getState();

		if (!can("workspace.write") || current.busy || current.error === "conflict" || current.status === "saved") {
			return;
		}

		await requestSave();
	});

	useEffect(
		() => () => {
			autosave();
		},
		[]
	);
	useEffect(() => {
		const timer = setTimeout(() => {
			autosave();
		}, 900);

		return () => clearTimeout(timer);
	}, [state.draft]);
	const changeDocument = (document: BlogPostDocument) => dispatch({ patch: { document }, type: "change" });
	const updateDocument = (update: DocumentUpdate) => dispatch({ type: "document", update });
	const changeSlug = (slug: string) => dispatch({ patch: { slug }, type: "change" });

	const perform = async (
		action: "publish" | "unpublish" | "delete" | "translate" | "generate",
		locale?: Iso6391LanguageCode,
		generation?: { instructions: string; topic: string }
	) => {
		if (
			!isActive() ||
			!can("workspace.write") ||
			((action === "delete" || action === "unpublish") && !can("workspace.delete"))
		) {
			return;
		}

		const version = state.version;
		dispatch({ busy: true, type: "busy" });
		dispatch({ type: "saving", version });

		try {
			const updated = await queue.mutate(state.draft, async (saved) => {
				if (!isActive()) {
					return saved;
				}

				const input = { postId: post.id, revision: saved.revision };

				if (action === "generate" && generation) {
					return client.blogPosts.generate({ ...input, ...generation });
				}

				if (action === "translate" && locale) {
					return client.blogPosts.translate({ ...input, locale });
				}

				if (action === "publish") {
					return client.blogPosts.publish(input);
				}

				if (action === "unpublish") {
					return client.blogPosts.unpublish(input);
				}

				if (action === "delete") {
					await client.blogPosts.delete(input);
				}

				return saved;
			});

			dispatch({ slug: updated.slug, type: "saved", version });

			if (!isActive()) {
				return false;
			}

			if (action === "delete") {
				router.push("/dashboard/blog");
			} else {
				queryClient.setQueryData(apiClient.blogPosts.get.queryKey({ input: { postId: post.id } }), updated);
			}

			await queryClient.invalidateQueries({ queryKey: apiClient.blogPosts.key() });

			return true;
		} catch (error) {
			dispatch({
				error: error instanceof ORPCError && error.code === "CONFLICT" ? "conflict" : "request",
				type: "error",
				version,
			});

			return false;
		} finally {
			dispatch({ busy: false, type: "busy" });
		}
	};

	const addLanguage = async (locale: Iso6391LanguageCode) => {
		try {
			await languages.add(locale);

			return await perform("translate", locale);
		} catch {
			return false;
		}
	};

	return {
		...state,
		addLanguage,
		changeDocument,
		changeSlug,
		dismissRecovery: () => store.setState({ recoveryDraft: null }),
		downloadDraft: () =>
			downloadContent({
				content: JSON.stringify(
					state.error !== null ? state.draft : (state.recoveryDraft ?? state.draft),
					null,
					2
				),
				filename: `${post.slug}-draft.json`,
				type: "application/json",
			}),
		languages,
		leave,
		perform,
		reload,
		requestSave,
		save,
		updateDocument,
	};
};
