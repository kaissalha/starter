import { useState, type ReactNode } from "react";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWebsiteGenerationController } from "@/app/[locale]/dashboard/website/generation/use-website-generation-controller";
import {
	initialWebsiteGenerationState,
	selectWebsiteEditorLocked,
	useWebsiteGenerationStore,
} from "@/app/[locale]/dashboard/website/generation/website-generation-store";
import { useWebsiteEditor } from "@/app/[locale]/dashboard/website/use-website-editor";
import { entityIdFromSeed, instantiateTemplate, type CreateEntityId } from "@starter/infinite-website";
import { editWebsiteSnapshot } from "@starter/infinite-website/editing";
import {
	createWebsiteGenerationShell,
	generationPageKeys,
	selectWebsiteGenerationProfile,
	type WebsiteStateV1,
} from "@starter/infinite-website/generation";
import { nordicEdgeTemplate } from "@starter/infinite-website/templates/nordic-edge";
import nordicEdgeContent from "@starter/infinite-website/templates/nordic-edge/content";

import { mockOrganizationPermissions } from "../../mocks/organization-permissions";

type MutableReference<Value> = { value: Value };

const mocks = vi.hoisted(() => ({
	addSection: vi.fn(),
	changeTemplate: vi.fn(),
	edit: vi.fn(),
	generate: vi.fn(),
	publish: vi.fn(),
	queryFn: vi.fn(),
	subscribeToWebsiteWorkflow: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
	apiClient: {
		linkPages: { get: { key: () => ["linkPages", "get"] } },
		seo: { overview: { key: () => ["seo", "overview"] } },
		websites: {
			agentChat: {
				key: () => ["websites", "agentChat"],
				queryOptions: () => ({
					queryFn: async () => ({ chatId: "chat-id", messages: [] }),
					queryKey: ["websites", "agentChat"],
				}),
			},
			get: {
				key: () => ["websites", "get"],
				queryKey: () => ["websites", "get"],
				queryOptions: () => ({ queryFn: mocks.queryFn, queryKey: ["websites", "get"] }),
			},
			templates: {
				queryOptions: () => ({ queryFn: async () => [], queryKey: ["websites", "templates"] }),
			},
		},
	},
	client: {
		websites: {
			addSection: mocks.addSection,
			changeTemplate: mocks.changeTemplate,
			edit: mocks.edit,
			generate: mocks.generate,
			publish: mocks.publish,
		},
	},
}));

vi.mock("@/app/[locale]/dashboard/website/generation/website-workflow-subscription", () => ({
	subscribeToWebsiteWorkflow: mocks.subscribeToWebsiteWorkflow,
}));

const initialWebsite: WebsiteStateV1 = {
	brief: { location: "Toronto", name: "Northstar", schemaVersion: 1, type: "Design studio" },
	createdAt: "2026-08-14T12:00:00.000Z",
	id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d",
	locale: "en",
	publication: { hasUnpublishedChanges: false, publishedAt: null },
	snapshot: null,
	updatedAt: "2026-08-14T12:00:00.000Z",
	workflow: null,
};

const snapshot = createWebsiteGenerationShell({
	brief: initialWebsite.brief,
	localizations: {
		byLocale: {
			en: {
				kind: "plan",
				pages: generationPageKeys.map((pageKey) => ({
					description: `The ${pageKey} page.`,
					pageKey,
					title: pageKey,
				})),
				siteDescription: "A Toronto design studio.",
			},
		},
		defaultLocale: "en",
	},
	profile: selectWebsiteGenerationProfile({ businessType: initialWebsite.brief.type }),
	websiteId: initialWebsite.id,
});

const activeWebsite: WebsiteStateV1 = {
	...initialWebsite,
	workflow: { kind: "generation", runId: "run-generation", state: "active" },
};

const completedWebsite: WebsiteStateV1 = {
	...initialWebsite,
	publication: { hasUnpublishedChanges: true, publishedAt: null },
	snapshot,
};

const createId: CreateEntityId = ({ kind, path }) => {
	return entityIdFromSeed({ seed: `website-controller:${kind}:${path}` });
};

const editableSnapshot = {
	...snapshot,
	document: instantiateTemplate({
		content: nordicEdgeContent,
		createId,
		definition: nordicEdgeTemplate,
		path: "/website-controller",
	}),
};

const useHydratedWebsiteGenerationController = (initialWebsite: WebsiteStateV1 | null) => {
	const queryClient = useQueryClient();

	useState(() => queryClient.setQueryData(["websites", "get"], initialWebsite));

	return useWebsiteGenerationController();
};

const createWrapper = (queryClient: QueryClient) => {
	const WebsiteGenerationTestProvider = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);

	WebsiteGenerationTestProvider.displayName = "WebsiteGenerationTestProvider";

	return WebsiteGenerationTestProvider;
};

const renderActiveWorkflow = async (queryClient: QueryClient, website: WebsiteStateV1 = activeWebsite) => {
	renderHook(() => useHydratedWebsiteGenerationController(website), {
		wrapper: createWrapper(queryClient),
	});

	await waitFor(() => expect(mocks.subscribeToWebsiteWorkflow).toHaveBeenCalledOnce());
	const subscription = mocks.subscribeToWebsiteWorkflow.mock.calls[0]?.[0];

	if (!subscription) {
		throw new Error("Expected a website workflow subscription");
	}

	return subscription;
};

describe("website generation hydration", () => {
	beforeEach(() => {
		mocks.queryFn.mockReset();
		mocks.generate.mockReset();
		mocks.addSection.mockReset();
		mocks.changeTemplate.mockReset();
		mocks.edit.mockReset();
		mocks.publish.mockReset();
		mocks.subscribeToWebsiteWorkflow.mockReset();
		mocks.subscribeToWebsiteWorkflow.mockResolvedValue(undefined);
		useWebsiteGenerationStore.setState(initialWebsiteGenerationState);
	});

	it("uses the prefetched website without entering a client loading state", () => {
		const queryClient = new QueryClient();

		const { result } = renderHook(() => useHydratedWebsiteGenerationController(initialWebsite), {
			wrapper: createWrapper(queryClient),
		});

		expect(result.current.isLoading).toBe(false);
		expect(result.current.brief).toEqual(initialWebsite.brief);
		expect(mocks.queryFn).not.toHaveBeenCalled();
	});

	it("switches upload targets and closes without restoring an older website snapshot", () => {
		const queryClient = new QueryClient();
		const website = { ...initialWebsite, snapshot: editableSnapshot };
		useWebsiteGenerationStore.getState().recover({ snapshot: editableSnapshot, websiteId: website.id });

		const { result } = renderHook(() => useWebsiteEditor({ defaultLocale: "en", website }), {
			wrapper: createWrapper(queryClient),
		});

		act(() => result.current.openOverlay({ kind: "media", target: { pointer: "/image", sectionId: "first" } }));
		expect(result.current.disabled).toBe(false);
		act(() => result.current.openOverlay({ kind: "media", target: { pointer: "/image", sectionId: "second" } }));
		expect(result.current.mediaTarget?.sectionId).toBe("second");

		const newerSnapshot = {
			...editableSnapshot,
			brand: {
				...editableSnapshot.brand,
				corners: { ...editableSnapshot.brand.corners, style: "square" as const },
			},
		};

		act(() => useWebsiteGenerationStore.getState().recover({ snapshot: newerSnapshot, websiteId: website.id }));
		act(() => result.current.cancelDraft());
		expect(result.current.overlay).toBeNull();
		expect(useWebsiteGenerationStore.getState().snapshot).toBe(newerSnapshot);
	});

	it("unlocks the mounted editor after completion while persisted workflow metadata is stale", async () => {
		const queryClient = new QueryClient();

		const staleWebsite: WebsiteStateV1 = {
			...initialWebsite,
			snapshot: editableSnapshot,
			workflow: { kind: "generation", runId: "run-completed", state: "active" },
		};

		useWebsiteGenerationStore.getState().resumeWorkflow({
			kind: "generation",
			runId: "run-completed",
			snapshot: editableSnapshot,
			websiteId: staleWebsite.id,
		});

		const { result } = renderHook(() => useWebsiteEditor({ defaultLocale: "en", website: staleWebsite }), {
			wrapper: createWrapper(queryClient),
		});

		expect(result.current.disabled).toBe(true);

		act(() =>
			useWebsiteGenerationStore.getState().recover({ snapshot: editableSnapshot, websiteId: staleWebsite.id })
		);

		await waitFor(() => expect(result.current.disabled).toBe(false));
	});

	it("locks an unknown attached workflow without starting a replacement", async () => {
		const queryClient = new QueryClient();
		vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

		const blockedWebsite: WebsiteStateV1 = {
			...initialWebsite,
			snapshot: editableSnapshot,
			workflow: { kind: "unknown", runId: "run-unknown", state: "blocked" },
		};

		const { result } = renderHook(() => useHydratedWebsiteGenerationController(blockedWebsite), {
			wrapper: createWrapper(queryClient),
		});

		await waitFor(() =>
			expect(useWebsiteGenerationStore.getState().workflow).toMatchObject({
				kind: "unknown",
				phase: "failed",
				runId: "run-unknown",
			})
		);

		expect(result.current).toMatchObject({ blocked: true, phase: "failed" });
		expect(selectWebsiteEditorLocked(useWebsiteGenerationStore.getState())).toBe(true);
		expect(mocks.subscribeToWebsiteWorkflow).not.toHaveBeenCalled();

		await act(async () => {
			await result.current.generate(blockedWebsite.brief);
		});

		expect(mocks.generate).not.toHaveBeenCalled();
	});

	it("trims submitted generation input and attaches the returned workflow", async () => {
		const queryClient = new QueryClient();
		vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
		mocks.generate.mockResolvedValue({ websiteId: initialWebsite.id, workflowRunId: "run-generation" });

		const { result } = renderHook(() => useHydratedWebsiteGenerationController(null), {
			wrapper: createWrapper(queryClient),
		});

		await act(async () => {
			await result.current.generate({ location: " Toronto  ", name: "  Northstar  ", type: "  Design studio " });
		});

		expect(mocks.generate).toHaveBeenCalledWith({
			brief: {
				location: "Toronto",
				name: "Northstar",
				schemaVersion: 1,
				type: "Design studio",
			},
		});

		expect(useWebsiteGenerationStore.getState()).toMatchObject({
			websiteId: initialWebsite.id,
			workflow: { kind: "generation", phase: "streaming", runId: "run-generation" },
		});
	});

	it("starts a section addition from the authoritative snapshot", async () => {
		const queryClient = new QueryClient();
		vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
		mocks.addSection.mockResolvedValue({ websiteId: initialWebsite.id, workflowRunId: "run-addition" });

		const readyWebsite = {
			...initialWebsite,
			publication: { hasUnpublishedChanges: true, publishedAt: null },
			snapshot,
		};

		const pageId = snapshot.document.structure.pages[0]?.id;

		if (!pageId) {
			throw new Error("Expected a generated home page");
		}

		const { result } = renderHook(() => useHydratedWebsiteGenerationController(readyWebsite), {
			wrapper: createWrapper(queryClient),
		});

		await waitFor(() => expect(result.current.snapshot).toEqual(snapshot));

		await act(async () => {
			await result.current.addSection({ index: 1, pageId, pattern: "feature-grid" });
		});

		expect(mocks.addSection).toHaveBeenCalledWith({
			index: 1,
			pageId,
			pattern: "feature-grid",
			updatedAt: initialWebsite.updatedAt,
			websiteId: initialWebsite.id,
		});

		expect(useWebsiteGenerationStore.getState()).toMatchObject({
			workflow: {
				kind: "section-addition",
				phase: "streaming",
				runId: "run-addition",
				target: { index: 1, pageId },
			},
		});
	});

	it("commits a section edit to both the editor and query cache", async () => {
		const queryClient = new QueryClient();

		const readyWebsite = {
			...initialWebsite,
			publication: { hasUnpublishedChanges: true, publishedAt: null },
			snapshot: editableSnapshot,
		};

		const page = editableSnapshot.document.structure.pages[0];
		const section = page?.sections[0];

		if (!page || !section) {
			throw new Error("Expected an editable website section");
		}

		const updatedSnapshot = editWebsiteSnapshot({
			input: {
				operation: "move-down",
				pageId: page.id,
				sectionId: section.id,
			},
			snapshot: editableSnapshot,
		});

		const updatedWebsite = {
			...readyWebsite,
			snapshot: updatedSnapshot,
			updatedAt: "2026-08-15T12:00:00.000Z",
		};

		mocks.edit.mockResolvedValue(updatedWebsite);

		const { result } = renderHook(
			() => {
				const controller = useHydratedWebsiteGenerationController(readyWebsite);
				const editor = useWebsiteEditor({ defaultLocale: "en", website: controller.website });

				return { controller, editor };
			},
			{ wrapper: createWrapper(queryClient) }
		);

		await waitFor(() => expect(result.current.controller.snapshot).toEqual(editableSnapshot));

		await act(async () => {
			await result.current.editor.edit({
				operation: "move-down",
				pageId: page.id,
				sectionId: section.id,
			});
		});

		expect(mocks.edit).toHaveBeenCalledWith({
			edit: { operation: "move-down", pageId: page.id, sectionId: section.id },
			updatedAt: initialWebsite.updatedAt,
			websiteId: initialWebsite.id,
		});

		expect(useWebsiteGenerationStore.getState().snapshot).toEqual(updatedSnapshot);

		expect(queryClient.getQueryData(["websites", "get"])).toEqual(updatedWebsite);
	});

	it("rolls a failed section edit back to the authoritative snapshot", async () => {
		const queryClient = new QueryClient();
		vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
		mocks.edit.mockRejectedValue(new Error("conflict"));

		const readyWebsite = {
			...initialWebsite,
			publication: { hasUnpublishedChanges: false, publishedAt: "2026-08-14T12:00:00.000Z" },
			snapshot: editableSnapshot,
		};

		const page = editableSnapshot.document.structure.pages[0];
		const section = page?.sections[0];

		if (!page || !section) {
			throw new Error("Expected an editable website section");
		}

		const { result } = renderHook(
			() => {
				const controller = useHydratedWebsiteGenerationController(readyWebsite);
				const editor = useWebsiteEditor({ defaultLocale: "en", website: controller.website });

				return { controller, editor };
			},
			{ wrapper: createWrapper(queryClient) }
		);

		await waitFor(() => expect(result.current.controller.snapshot).toEqual(editableSnapshot));

		await act(async () => {
			await result.current.editor.edit({
				operation: "delete",
				pageId: page.id,
				sectionId: section.id,
			});
		});

		expect(useWebsiteGenerationStore.getState().snapshot).toEqual(editableSnapshot);
		expect(queryClient.getQueryData(["websites", "get"])).toEqual(readyWebsite);
		expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["websites", "get"] });
	});

	it("marks a brand edit as unpublished and queues publish before the server responds", async () => {
		const queryClient = new QueryClient();

		const readyWebsite = {
			...initialWebsite,
			publication: { hasUnpublishedChanges: false, publishedAt: "2026-08-14T12:00:00.000Z" },
			snapshot: editableSnapshot,
		};

		const brand = {
			...editableSnapshot.brand,
			colors: { ...editableSnapshot.brand.colors, primary: "#2457d6" },
		};

		const updatedSnapshot = { ...editableSnapshot, brand };

		const updatedWebsite = {
			...readyWebsite,
			publication: { ...readyWebsite.publication, hasUnpublishedChanges: true },
			snapshot: updatedSnapshot,
			updatedAt: "2026-08-15T13:00:00.000Z",
		};

		const publishedWebsite = {
			...updatedWebsite,
			publication: { hasUnpublishedChanges: false, publishedAt: "2026-08-15T13:00:01.000Z" },
			updatedAt: "2026-08-15T13:00:01.000Z",
		};

		const editResponse = Promise.withResolvers<WebsiteStateV1>();
		mocks.edit.mockReturnValue(editResponse.promise);
		mocks.publish.mockResolvedValue(publishedWebsite);

		const { result } = renderHook(
			() => {
				const controller = useHydratedWebsiteGenerationController(readyWebsite);
				const editor = useWebsiteEditor({ defaultLocale: "en", website: controller.website });

				return { controller, editor };
			},
			{ wrapper: createWrapper(queryClient) }
		);

		await waitFor(() => expect(result.current.controller.snapshot).toEqual(editableSnapshot));

		const editPromiseReference: MutableReference<Promise<void> | undefined | undefined> = { value: undefined };

		act(() => {
			result.current.editor.openOverlay({ kind: "customize" });

			result.current.editor.previewDraft({
				input: { brand, operation: "update-brand" },
				selection: null,
			});

			editPromiseReference.value = result.current.editor.commitDraft();
		});

		expect(result.current.editor.overlay).toBeNull();

		expect(queryClient.getQueryData(["websites", "get"])).toEqual({
			...readyWebsite,
			publication: { ...readyWebsite.publication, hasUnpublishedChanges: true },
			snapshot: updatedSnapshot,
		});

		await waitFor(() => expect(result.current.controller.website?.publication.hasUnpublishedChanges).toBe(true));

		const publishPromiseReference: MutableReference<Promise<void> | undefined | undefined> = { value: undefined };

		act(() => {
			publishPromiseReference.value = result.current.editor.publish();
		});

		expect(result.current.editor.publishing).toBe(true);
		expect(mocks.publish).not.toHaveBeenCalled();

		if (!editPromiseReference.value || !publishPromiseReference.value) {
			throw new Error("Expected edit and publish requests");
		}

		await act(async () => {
			editResponse.resolve(updatedWebsite);
			await editPromiseReference.value;
			await publishPromiseReference.value;
		});

		expect(mocks.edit).toHaveBeenCalledWith({
			edit: { brand, operation: "update-brand" },
			updatedAt: initialWebsite.updatedAt,
			websiteId: initialWebsite.id,
		});

		expect(useWebsiteGenerationStore.getState().snapshot).toEqual(updatedSnapshot);

		expect(mocks.publish).toHaveBeenCalledWith({
			updatedAt: updatedWebsite.updatedAt,
			websiteId: initialWebsite.id,
		});

		expect(queryClient.getQueryData(["websites", "get"])).toEqual(publishedWebsite);
	});

	it("publishes the current draft and replaces the cached website state", async () => {
		const queryClient = new QueryClient();

		const readyWebsite: WebsiteStateV1 = {
			...initialWebsite,
			publication: { hasUnpublishedChanges: true, publishedAt: null },
			snapshot: editableSnapshot,
		};

		const publishedWebsite: WebsiteStateV1 = {
			...readyWebsite,
			publication: { hasUnpublishedChanges: false, publishedAt: "2026-08-15T14:00:00.000Z" },
			updatedAt: "2026-08-15T14:00:00.000Z",
		};

		mocks.publish.mockResolvedValue(publishedWebsite);

		const { result } = renderHook(
			() => {
				const controller = useHydratedWebsiteGenerationController(readyWebsite);
				const editor = useWebsiteEditor({ defaultLocale: "en", website: controller.website });

				return { controller, editor };
			},
			{ wrapper: createWrapper(queryClient) }
		);

		await waitFor(() => expect(result.current.controller.snapshot).toEqual(editableSnapshot));

		await act(async () => {
			await result.current.editor.publish();
		});

		expect(mocks.publish).toHaveBeenCalledWith({
			updatedAt: readyWebsite.updatedAt,
			websiteId: initialWebsite.id,
		});

		expect(queryClient.getQueryData(["websites", "get"])).toEqual(publishedWebsite);
		expect(result.current.controller.website?.publication).toEqual(publishedWebsite.publication);
	});

	it("moves failed starts into the failure state", async () => {
		const queryClient = new QueryClient();
		vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
		mocks.generate.mockRejectedValue(new Error("offline"));

		const { result } = renderHook(() => useHydratedWebsiteGenerationController(null), {
			wrapper: createWrapper(queryClient),
		});

		await act(async () => {
			await result.current.generate({ location: "Toronto", name: "Northstar", type: "Design studio" });
		});

		expect(useWebsiteGenerationStore.getState().workflow).toMatchObject({
			kind: "generation",
			phase: "failed",
		});
	});

	it.each(["ended", "completed"])("refreshes Links and recovers the draft after a %s stream", async (completion) => {
		const queryClient = new QueryClient();
		queryClient.setQueryData(["linkPages", "get"], {});

		mocks.queryFn.mockResolvedValue(completedWebsite);

		const subscription = await renderActiveWorkflow(queryClient);

		await act(() =>
			completion === "ended"
				? subscription.onEnded()
				: subscription.onEnvelope({
						cursor: "1",
						event: { eventKey: "completed", snapshot, type: "completed", version: 1 },
					})
		);

		await waitFor(() =>
			expect(useWebsiteGenerationStore.getState()).toMatchObject({
				snapshot,
				websiteId: initialWebsite.id,
				workflow: { phase: "idle" },
			})
		);
		expect(queryClient.getQueryState(["linkPages", "get"])?.isInvalidated).toBe(true);
	});

	it("refreshes the saved revision after completion before unlocking the mounted editor", async () => {
		const queryClient = new QueryClient();
		const refresh = Promise.withResolvers<WebsiteStateV1>();
		mocks.queryFn.mockReturnValue(refresh.promise);

		const { result } = renderHook(
			() => {
				const controller = useHydratedWebsiteGenerationController(activeWebsite);
				const editor = useWebsiteEditor({ defaultLocale: "en", website: controller.website });

				return { controller, editor };
			},
			{ wrapper: createWrapper(queryClient) }
		);

		await waitFor(() => expect(mocks.subscribeToWebsiteWorkflow).toHaveBeenCalledOnce());
		const subscription = mocks.subscribeToWebsiteWorkflow.mock.calls[0]?.[0];
		act(() =>
			subscription.onEnvelope({
				cursor: "1",
				event: { eventKey: "completed", snapshot, type: "completed", version: 1 },
			})
		);
		await waitFor(() => expect(mocks.queryFn).toHaveBeenCalledOnce());
		expect(result.current.editor.disabled).toBe(true);
		expect(selectWebsiteEditorLocked(useWebsiteGenerationStore.getState())).toBe(true);
		expect(subscription.signal.aborted).toBe(true);
		await act(async () => refresh.resolve(completedWebsite));
		await waitFor(() => expect(result.current.editor.disabled).toBe(false));
		expect(result.current.controller.website).toEqual(completedWebsite);
		expect(selectWebsiteEditorLocked(useWebsiteGenerationStore.getState())).toBe(false);
		act(() => result.current.editor.openOverlay({ kind: "customize" }));
		expect(result.current.editor.overlay).toBe("customize");
	});

	it("unlocks both editing surfaces after a failed modification or invalid edit and permits saving", async () => {
		const queryClient = new QueryClient();
		const website = { ...completedWebsite, snapshot: editableSnapshot };
		mocks.edit.mockResolvedValue(website);
		useWebsiteGenerationStore.getState().startTemplateChange({
			baseSnapshot: editableSnapshot,
			snapshot,
			websiteId: website.id,
		});

		const { result } = renderHook(() => useWebsiteEditor({ defaultLocale: "en", website }), {
			wrapper: createWrapper(queryClient),
		});

		expect(result.current.disabled).toBe(true);
		act(() => useWebsiteGenerationStore.getState().failWorkflow());
		expect(selectWebsiteEditorLocked(useWebsiteGenerationStore.getState())).toBe(false);
		expect(result.current.disabled).toBe(false);
		act(() => result.current.openOverlay({ kind: "customize" }));
		expect(result.current.overlay).toBe("customize");
		mocks.edit.mockRejectedValueOnce(new Error("Rejected"));
		await act(async () => {
			await expect(
				result.current.edit(
					{ brand: editableSnapshot.brand, operation: "update-brand" },
					{ "not-a-uuid": { src: "https://example.com/a.mp4", type: "video" } }
				)
			).resolves.toBe(false);
		});
		expect(result.current.pending).toBeNull();
		await act(async () => {
			await result.current.edit({ brand: editableSnapshot.brand, operation: "update-brand" });
		});
		expect(mocks.edit).toHaveBeenCalledTimes(2);
	});

	it("blocks edit handlers as well as controls while the agent is busy", async () => {
		const queryClient = new QueryClient();
		const website = { ...completedWebsite, snapshot: editableSnapshot };
		useWebsiteGenerationStore.getState().recover({ snapshot: editableSnapshot, websiteId: website.id });

		const { rerender, result } = renderHook(
			({ agentLocked }) =>
				useWebsiteEditor({
					agentLocked,
					defaultLocale: "en",
					website,
				}),
			{ initialProps: { agentLocked: true }, wrapper: createWrapper(queryClient) }
		);

		expect(result.current.disabled).toBe(true);
		await act(async () => {
			result.current.openOverlay({ kind: "customize" });
			await result.current.edit({ brand: editableSnapshot.brand, operation: "update-brand" });
			await result.current.publish();
		});
		expect(result.current.overlay).toBeNull();
		expect(mocks.edit).not.toHaveBeenCalled();
		expect(mocks.publish).not.toHaveBeenCalled();
		rerender({ agentLocked: false });
		expect(result.current.disabled).toBe(false);
	});

	it("recovers website editing without waiting for the Links refresh", async () => {
		const queryClient = new QueryClient();
		const linksRefresh = Promise.withResolvers<void>();
		vi.spyOn(queryClient, "invalidateQueries").mockReturnValue(linksRefresh.promise);
		mocks.queryFn.mockResolvedValue(completedWebsite);
		const subscription = await renderActiveWorkflow(queryClient);
		await act(() => subscription.onEnded());
		expect(selectWebsiteEditorLocked(useWebsiteGenerationStore.getState())).toBe(false);
		linksRefresh.resolve();
	});

	it("offers reconnection if the completed draft cannot be refreshed", async () => {
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		mocks.queryFn.mockRejectedValue(new Error("offline"));
		const subscription = await renderActiveWorkflow(queryClient);
		act(() =>
			subscription.onEnvelope({
				cursor: "1",
				event: { eventKey: "completed", snapshot, type: "completed", version: 1 },
			})
		);
		await waitFor(() => expect(useWebsiteGenerationStore.getState().workflow.phase).toBe("disconnected"));
		expect(selectWebsiteEditorLocked(useWebsiteGenerationStore.getState())).toBe(true);
		mocks.queryFn.mockResolvedValue(completedWebsite);
		act(() => useWebsiteGenerationStore.getState().reconnect());
		await waitFor(() => expect(mocks.subscribeToWebsiteWorkflow).toHaveBeenCalledTimes(2));
		await act(() => mocks.subscribeToWebsiteWorkflow.mock.calls[1]?.[0].onEnded());
		await waitFor(() => expect(selectWebsiteEditorLocked(useWebsiteGenerationStore.getState())).toBe(false));
	});

	it("clears a disconnected client workflow when persistence has no attached run", async () => {
		const queryClient = new QueryClient();

		mocks.queryFn.mockRejectedValue(new Error("offline"));

		const subscription = await renderActiveWorkflow(queryClient);

		await act(() => subscription.onEnded());
		expect(useWebsiteGenerationStore.getState().workflow).toMatchObject({ phase: "disconnected" });

		act(() => queryClient.setQueryData(["websites", "get"], completedWebsite));

		await waitFor(() =>
			expect(useWebsiteGenerationStore.getState()).toMatchObject({
				snapshot,
				workflow: { phase: "idle" },
			})
		);
	});

	it("keeps a failed modification visible after the server released the website", async () => {
		const queryClient = new QueryClient();
		mocks.queryFn.mockResolvedValue(completedWebsite);

		const subscription = await renderActiveWorkflow(queryClient, {
			...completedWebsite,
			workflow: { kind: "section-addition", runId: "run-addition", state: "active" },
		});

		act(() =>
			subscription.onEnvelope({
				cursor: "0",
				event: { code: "SECTION_ADDITION_FAILED", eventKey: "failed", type: "failed", version: 1 },
			})
		);
		await act(() => subscription.onEnded());

		expect(useWebsiteGenerationStore.getState().workflow).toMatchObject({
			kind: "section-addition",
			phase: "failed",
		});
		expect(selectWebsiteEditorLocked(useWebsiteGenerationStore.getState())).toBe(false);
	});

	it("allows another template change after a failed one", async () => {
		const queryClient = new QueryClient();
		vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
		mocks.changeTemplate.mockResolvedValue({ websiteId: initialWebsite.id, workflowRunId: "run-template" });
		useWebsiteGenerationStore.setState({
			...initialWebsiteGenerationState,
			snapshot,
			websiteId: initialWebsite.id,
			workflow: {
				baseSnapshot: snapshot,
				cursor: null,
				kind: "template-change",
				phase: "failed",
				runId: null,
				subscriptionVersion: 0,
			},
		});

		const { result } = renderHook(() => useHydratedWebsiteGenerationController(completedWebsite), {
			wrapper: createWrapper(queryClient),
		});

		await waitFor(() => expect(result.current.snapshot).toEqual(snapshot));
		expect(useWebsiteGenerationStore.getState().workflow).toMatchObject({
			kind: "template-change",
			phase: "failed",
		});

		await act(async () => {
			await result.current.changeTemplate({ templateId: "another-template" });
		});

		expect(mocks.changeTemplate).toHaveBeenCalledWith({
			templateId: "another-template",
			updatedAt: completedWebsite.updatedAt,
			websiteId: completedWebsite.id,
		});
		expect(useWebsiteGenerationStore.getState().workflow).toMatchObject({
			kind: "template-change",
			phase: "streaming",
			runId: "run-template",
		});
	});

	it("marks an authoritative workflow failure as terminal", async () => {
		const queryClient = new QueryClient();

		mocks.queryFn.mockResolvedValue({
			...activeWebsite,
			workflow: { ...activeWebsite.workflow, state: "failed" },
		});

		const subscription = await renderActiveWorkflow(queryClient);

		await act(() => subscription.onEnded());
		expect(useWebsiteGenerationStore.getState().workflow).toMatchObject({ phase: "failed" });
	});
});

vi.mock("@/hooks/use-organization-permissions", () => ({
	useOrganizationPermissions: () => mockOrganizationPermissions(),
}));
