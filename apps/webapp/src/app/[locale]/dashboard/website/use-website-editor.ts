"use client";

import { useCallback, useRef, useState } from "react";

import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { apiClient, client } from "@/lib/api-client";
import type { Iso6391LanguageCode } from "@starter/infinite-website";
import {
	type WebsiteLayoutGenerationTargetV1,
	type WebsiteSnapshotV1,
	type WebsiteStateV1,
} from "@starter/infinite-website/contracts";
import { editWebsiteSnapshot, type WebsiteEditInput } from "@starter/infinite-website/editing";
import { toast } from "@starter/ui/components/toaster";

import { selectWebsiteEditorLocked, useWebsiteGenerationStore } from "./generation/website-generation-store";

export type WebsiteMode = "edit" | "preview";

export type WebsiteSidebarMode = "agent" | "page";

export type WebsiteViewport = "desktop" | "mobile" | "tablet";

type WebsiteLayoutTarget = WebsiteLayoutGenerationTargetV1;

const websiteQueryKey = apiClient.websites.get.queryKey();

const invalidateDerivedWebsiteQueries = (queryClient: QueryClient) =>
	queryClient.invalidateQueries({ queryKey: apiClient.seo.overview.key() });

type WebsiteMediaTarget = { pointer?: string; sectionId: string };

type WebsiteEditorOverlayRequest =
	| { kind: "customize" }
	| { kind: "layout"; target: WebsiteLayoutTarget }
	| { kind: "templates" }
	| { kind: "media"; target: WebsiteMediaTarget };

type WebsiteEditorDraft = {
	baselineSnapshot: WebsiteSnapshotV1;
	input: WebsiteEditInput | null;
	selection: string | null;
	snapshot: WebsiteSnapshotV1;
};

type WebsiteEditorOverlay =
	| { draft: WebsiteEditorDraft; kind: "customize" }
	| { draft: WebsiteEditorDraft; kind: "layout"; target: WebsiteLayoutTarget }
	| { draft: WebsiteEditorDraft; kind: "templates" }
	| { draft: WebsiteEditorDraft; kind: "media"; target: WebsiteMediaTarget }
	| null;

type WebsiteEditorPending = {
	operation: WebsiteEditInput["operation"];
	sectionId?: string;
};

type WebsiteEditorState = {
	locale: Iso6391LanguageCode;
	mode: WebsiteMode;
	overlay: WebsiteEditorOverlay;
	pending: WebsiteEditorPending | null;
	sidebarMode: WebsiteSidebarMode;
	viewport: WebsiteViewport;
};

type WebsiteEditorInput = {
	agentLocked?: boolean;
	defaultLocale: Iso6391LanguageCode;
	website: WebsiteStateV1 | null | undefined;
};

const createWebsiteEditorStore = ({ locale }: { locale: Iso6391LanguageCode }) =>
	createStore<WebsiteEditorState>()(() => ({
		locale,
		mode: "edit",
		overlay: null,
		pending: null,
		sidebarMode: "page",
		viewport: "desktop",
	}));

export const getWebsiteLayoutTargetSection = ({
	snapshot,
	target,
}: {
	snapshot: WebsiteSnapshotV1;
	target: WebsiteLayoutTarget;
}) => {
	if (target.area === "page") {
		return snapshot.document.structure.pages.find((page) => page.id === target.pageId)?.sections[target.index];
	}

	return snapshot.document.structure.layout[target.area][target.index];
};

const previewWebsiteEdit = ({ input, snapshot }: { input: WebsiteEditInput; snapshot: WebsiteSnapshotV1 }) => {
	try {
		return editWebsiteSnapshot({ input, snapshot });
	} catch {
		return null;
	}
};

export const useWebsiteEditor = ({ agentLocked = false, defaultLocale, website }: WebsiteEditorInput) => {
	const { can, role } = useOrganizationPermissions();
	const canDelete = can("workspace.delete");
	const t = useTranslations("website.editor");
	const tPublish = useTranslations("website.publish");
	const queryClient = useQueryClient();

	const workflowLocked = useWebsiteGenerationStore((state) =>
		selectWebsiteEditorLocked(state, state.snapshot ?? website?.snapshot)
	);

	const [publishing, setPublishing] = useState(false);
	const pendingEditRef = useRef<Promise<WebsiteStateV1> | null>(null);

	const [store] = useState(() => createWebsiteEditorStore({ locale: defaultLocale }));

	const state = useStore(store);
	const disabled = !can("workspace.write") || !website?.snapshot || workflowLocked || agentLocked || publishing;

	const edit = useCallback(
		async (input: WebsiteEditInput, assets?: WebsiteSnapshotV1["assets"]) => {
			const current = useWebsiteGenerationStore.getState();
			const persisted = queryClient.getQueryData<WebsiteStateV1 | null>(websiteQueryKey) ?? website;

			if (
				disabled ||
				(!canDelete && input.operation.startsWith("delete")) ||
				store.getState().pending ||
				!persisted?.snapshot ||
				selectWebsiteEditorLocked(current, persisted.snapshot)
			) {
				return false;
			}

			const base = current.snapshot ?? persisted.snapshot;

			const optimisticSnapshot = previewWebsiteEdit({
				input,
				snapshot: assets ? { ...base, assets: { ...base.assets, ...assets } } : base,
			});

			if (!optimisticSnapshot) {
				toast.error(t("failed"));

				return false;
			}

			const pending: WebsiteEditorPending =
				"sectionId" in input
					? { operation: input.operation, sectionId: input.sectionId }
					: { operation: input.operation };

			store.setState({ pending });

			try {
				const optimisticWebsite: WebsiteStateV1 = {
					...persisted,
					publication: { ...persisted.publication, hasUnpublishedChanges: true },
					snapshot: optimisticSnapshot,
				};

				queryClient.setQueryData<WebsiteStateV1 | null>(websiteQueryKey, optimisticWebsite);
				current.recover({ snapshot: optimisticSnapshot, websiteId: persisted.id });

				const editRequest = client.websites.edit({
					edit: input,
					updatedAt: persisted.updatedAt,
					websiteId: persisted.id,
				});

				pendingEditRef.current = editRequest;
				const updated = await editRequest;

				if (!updated.snapshot) {
					throw new Error("Edited website is missing its snapshot");
				}

				queryClient.setQueryData<WebsiteStateV1 | null>(websiteQueryKey, updated);
				invalidateDerivedWebsiteQueries(queryClient);
				current.recover({ snapshot: updated.snapshot, websiteId: persisted.id });

				return true;
			} catch {
				queryClient.setQueryData<WebsiteStateV1 | null>(websiteQueryKey, persisted);

				if (useWebsiteGenerationStore.getState().snapshot === optimisticSnapshot) {
					current.recover({ snapshot: persisted.snapshot, websiteId: persisted.id });
				}

				await queryClient.invalidateQueries({ queryKey: apiClient.websites.get.key() });
				toast.error(t("failed"));

				return false;
			} finally {
				pendingEditRef.current = null;
				store.setState({ pending: null });
			}
		},
		[canDelete, disabled, queryClient, store, t, website]
	);

	const publish = useCallback(async () => {
		const current = useWebsiteGenerationStore.getState();
		const currentWebsite = queryClient.getQueryData<WebsiteStateV1 | null>(websiteQueryKey) ?? website;

		if (disabled || !currentWebsite?.snapshot || selectWebsiteEditorLocked(current, currentWebsite.snapshot)) {
			return;
		}

		setPublishing(true);

		try {
			try {
				await pendingEditRef.current;
			} catch {}

			const publishable = queryClient.getQueryData<WebsiteStateV1 | null>(websiteQueryKey) ?? website;

			if (
				!publishable?.snapshot ||
				!publishable.publication.hasUnpublishedChanges ||
				selectWebsiteEditorLocked(useWebsiteGenerationStore.getState(), publishable.snapshot)
			) {
				return;
			}

			const published = await client.websites.publish({
				updatedAt: publishable.updatedAt,
				websiteId: publishable.id,
			});

			if (!published.snapshot) {
				throw new Error("Published website is missing its snapshot");
			}

			queryClient.setQueryData<WebsiteStateV1 | null>(websiteQueryKey, published);
			invalidateDerivedWebsiteQueries(queryClient);
			current.recover({ snapshot: published.snapshot, websiteId: published.id });
			toast.success(tPublish("success"));
		} catch {
			await queryClient.invalidateQueries({ queryKey: apiClient.websites.get.key() });
			toast.error(tPublish("failed"));
		} finally {
			setPublishing(false);
		}
	}, [disabled, queryClient, tPublish, website]);

	const openOverlay = useCallback(
		(request: WebsiteEditorOverlayRequest) => {
			const current = useWebsiteGenerationStore.getState();
			const snapshot = current.snapshot ?? website?.snapshot;

			if (disabled || (!canDelete && request.kind === "templates") || !snapshot || store.getState().pending) {
				return;
			}

			const section =
				request.kind === "layout" ? getWebsiteLayoutTargetSection({ snapshot, target: request.target }) : null;

			const selection =
				request.kind === "layout" && section?.id === request.target.sectionId
					? (section.source?.pattern ?? null)
					: null;

			const draft = { baselineSnapshot: snapshot, input: null, selection, snapshot };

			store.setState({ overlay: { ...request, draft }, sidebarMode: "page" });
		},
		[canDelete, disabled, store, website]
	);

	const previewDraft = useCallback(
		({
			input,
			selection,
			snapshot: previewSnapshot,
		}: Pick<WebsiteEditorDraft, "input" | "selection"> & { snapshot?: WebsiteSnapshotV1 }) => {
			const overlay = store.getState().overlay;
			const draft = overlay?.draft;
			const generation = useWebsiteGenerationStore.getState();

			if (
				disabled ||
				!overlay ||
				overlay.kind === "media" ||
				!draft ||
				store.getState().pending ||
				selectWebsiteEditorLocked(generation, generation.snapshot ?? website?.snapshot)
			) {
				return;
			}

			try {
				const snapshot =
					previewSnapshot ??
					(input ? editWebsiteSnapshot({ input, snapshot: draft.baselineSnapshot }) : draft.baselineSnapshot);

				store.setState({ overlay: { ...overlay, draft: { ...draft, input, selection, snapshot } } });
				generation.recover({ snapshot, websiteId: website?.id });
			} catch {
				toast.error(t("failed"));
			}
		},
		[disabled, store, t, website]
	);

	const closeDraft = useCallback(() => {
		if (!store.getState().pending) {
			store.setState({ overlay: null });
		}
	}, [store]);

	const cancelDraft = useCallback(() => {
		const { overlay, pending } = store.getState();

		if (pending) {
			return;
		}

		const generation = useWebsiteGenerationStore.getState();

		if (overlay && overlay.kind !== "media" && !selectWebsiteEditorLocked(generation, overlay.draft.snapshot)) {
			generation.recover({
				snapshot: overlay.draft.baselineSnapshot,
				websiteId: website?.id,
			});
		}

		store.setState({ overlay: null });
	}, [store, website]);

	const commitDraft = useCallback(async () => {
		const input = store.getState().overlay?.draft.input;

		if (!input) {
			cancelDraft();

			return;
		}

		const committed = edit(input);

		store.setState({ overlay: null });
		await committed;
	}, [cancelDraft, edit, store]);

	const { overlay, ...editorState } = state;

	return {
		...editorState,
		cancelDraft,
		closeDraft,
		commitDraft,
		disabled,
		draft: state.overlay?.draft ?? null,
		edit,
		layoutTarget: state.overlay?.kind === "layout" ? state.overlay.target : null,
		locale: website?.snapshot?.document.locales.includes(editorState.locale) ? editorState.locale : defaultLocale,
		mediaTarget: state.overlay?.kind === "media" ? state.overlay.target : null,
		mode: role === "owner" || role === "admin" ? editorState.mode : "preview",
		openOverlay,
		overlay: overlay?.kind ?? null,
		previewDraft,
		publish,
		publishing,
		setState: store.setState,
	};
};

export type WebsiteEditor = ReturnType<typeof useWebsiteEditor>;
