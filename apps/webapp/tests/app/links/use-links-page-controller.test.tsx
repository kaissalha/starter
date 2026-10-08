import { useState, type ReactNode } from "react";

import { ORPCError } from "@orpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, renderHook, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LinksPage } from "@/app/[locale]/dashboard/links/links-page";
import { useLinksPageController } from "@/app/[locale]/dashboard/links/use-links-page-controller";
import {
	createDefaultLinkPageDocument,
	defaultLinkPageBrand,
	defaultLinkPageSectionAppearance,
	type LinkPageLink,
	type LinkPageState,
} from "@starter/infinite-links";
import { blockOperations } from "@starter/infinite-links/editing";
import type { DashboardChatUIMessage } from "@starter/server";
import { SidebarProvider } from "@starter/ui/components/sidebar";

import { mockOrganizationPermissions, organizationPermissionState } from "../../mocks/organization-permissions";

const mocks = vi.hoisted(() => {
	const chatMessages: Array<DashboardChatUIMessage> = [];

	return {
		chatMessages,
		download: vi.fn(),
		publish: vi.fn(),
		query: vi.fn(),
		save: vi.fn(),
	};
});

vi.mock("@ai-sdk/react", () => ({
	useChat: () => ({ messages: mocks.chatMessages, status: "ready" }),
}));

vi.mock("@/lib/api-client", () => ({
	apiClient: {
		brands: {
			get: { key: () => ["brands", "get"] },
			setLogo: { mutationOptions: () => ({ mutationFn: async () => null }) },
		},
		linkPages: {
			agentChat: {
				queryOptions: () => ({
					queryFn: async () => ({ chatId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d", messages: [] }),
					queryKey: ["linkPages", "agentChat"],
				}),
			},
			get: {
				key: () => ["linkPages", "get"],
				queryKey: () => ["linkPages", "get"],
				queryOptions: () => ({ queryFn: mocks.query, queryKey: ["linkPages", "get"] }),
			},
		},
		notifications: {
			counts: {
				queryOptions: () => ({ queryFn: async () => ({ unseen: 0 }), queryKey: ["notifications", "counts"] }),
			},
		},
		websites: {
			get: {
				queryOptions: () => ({
					queryFn: async () => ({ id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d339" }),
					queryKey: ["websites", "get"],
				}),
			},
		},
	},
	client: { linkPages: { publish: mocks.publish, save: mocks.save } },
}));

vi.mock("@starter/ui/components/scroll-area", () => ({
	ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const initialState: LinkPageState = {
	document: createDefaultLinkPageDocument({ name: "Northstar" }),
	id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d",
	inheritedBrand: defaultLinkPageBrand,
	publication: { hasUnpublishedChanges: false, publishedAt: "2026-09-02T12:00:00.000Z" },
	updatedAt: "2026-09-02T12:00:00.000Z",
};

const createLink = (id: string): LinkPageLink => ({
	appearance: defaultLinkPageSectionAppearance,
	enabled: true,
	id,
	kind: "link",
	label: { en: id },
	layout: "classic",
	url: "https://example.com",
});

const clients = new Set<QueryClient>();

afterEach(() => {
	cleanup();

	for (const client of clients) {
		client.clear();
	}

	clients.clear();
});

vi.mock("@/utils/download-content", () => ({ downloadContent: mocks.download }));

const createWrapper = (queryClient: QueryClient) => {
	clients.add(queryClient);

	const LinksControllerTestProvider = ({ children }: { children: ReactNode }) => {
		useState(() => queryClient.setQueryData(["linkPages", "get"], initialState));

		return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
	};

	LinksControllerTestProvider.displayName = "LinksControllerTestProvider";

	return LinksControllerTestProvider;
};

describe("links page draft persistence", () => {
	it("adopts agent changes without saving the older local document", async () => {
		const changed = {
			...initialState,
			document: {
				...initialState.document,
				profile: { ...initialState.document.profile, title: { en: "Agent update" } },
			},
			updatedAt: "2026-09-12T00:00:00.000Z",
		};

		mocks.query.mockResolvedValue(changed);

		const { result } = renderHook(() => useLinksPageController({ initialState }), {
			wrapper: createWrapper(new QueryClient()),
		});

		act(() => result.current.setView({ kind: "agent" }));
		await act(async () => {
			expect(await result.current.refresh()).toBe(true);
		});
		expect(result.current.document).toEqual(changed.document);
		expect(result.current.state.updatedAt).toBe(changed.updatedAt);
		expect(result.current.dirty).toBe(false);
		expect(mocks.save).not.toHaveBeenCalled();
	});

	it("keeps member direct navigation in preview and never saves on mount", async () => {
		organizationPermissionState.role = "member";

		const { result } = renderHook(() => useLinksPageController({ initialState }), {
			wrapper: createWrapper(new QueryClient()),
		});

		expect(result.current.mode).toBe("preview");
		act(() => {
			result.current.setMode("edit");
			result.current.updateProfile({ title: { en: "Blocked edit" } });
		});
		await act(async () => {
			await result.current.publish();
		});
		expect(result.current.mode).toBe("preview");
		expect(mocks.save).not.toHaveBeenCalled();
		expect(mocks.publish).not.toHaveBeenCalled();
	});
	it("prevents admin removals while allowing additions", async () => {
		organizationPermissionState.role = "admin";
		const document = { ...initialState.document, blocks: [createLink("0a6955fc-7c92-4c54-a88f-d7b4a73d889a")] };

		const { result } = renderHook(() => useLinksPageController({ initialState: { ...initialState, document } }), {
			wrapper: createWrapper(new QueryClient()),
		});

		act(() => result.current.removeBlock({ id: document.blocks[0]!.id }));
		expect(result.current.document.blocks).toHaveLength(1);
		expect(mocks.save).not.toHaveBeenCalled();
	});
	beforeEach(() => {
		mocks.download.mockReset();
		mocks.publish.mockReset();
		mocks.query.mockReset();
		mocks.save.mockReset().mockImplementation(async ({ document }) => ({
			...initialState,
			document,
			publication: { ...initialState.publication, hasUnpublishedChanges: true },
			updatedAt: "2026-09-02T12:00:01.000Z",
		}));
	});

	it("keeps the newest queued edit after a failed save and retries it without reloading", async () => {
		const request = Promise.withResolvers<LinkPageState>();
		mocks.save.mockReturnValueOnce(request.promise).mockImplementation(async ({ document }) => ({
			...initialState,
			document,
			updatedAt: "2026-09-02T12:00:02.000Z",
		}));

		const { result } = renderHook(() => useLinksPageController({ initialState }), {
			wrapper: createWrapper(new QueryClient()),
		});

		act(() => result.current.updateProfile({ title: { en: "First snapshot" } }));
		await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce(), { timeout: 3000 });
		act(() => result.current.updateProfile({ title: { en: "Newest unsaved edit" } }));
		await act(async () => {
			request.reject(new Error("Offline"));
			await expect(request.promise).rejects.toThrow("Offline");
		});
		expect(result.current.document.profile.title.en).toBe("Newest unsaved edit");
		expect(result.current.error).toBe("request");
		expect(result.current.dirty).toBe(true);
		expect(mocks.save).toHaveBeenCalledOnce();
		expect(mocks.query).not.toHaveBeenCalled();
		await act(async () => result.current.retrySave());
		expect(mocks.save).toHaveBeenLastCalledWith({
			document: result.current.document,
			updatedAt: initialState.updatedAt,
		});
		expect(result.current.error).toBeNull();
		expect(result.current.dirty).toBe(false);
	});

	it("requires the latest revision after conflict and retains a downloadable local copy", async () => {
		mocks.save.mockRejectedValueOnce(new ORPCError("CONFLICT"));

		const latest = {
			...initialState,
			document: {
				...initialState.document,
				profile: { ...initialState.document.profile, title: { en: "Teammate version" } },
			},
			updatedAt: "2026-09-02T12:00:05.000Z",
		};

		mocks.query.mockResolvedValueOnce(latest);

		const { result } = renderHook(() => useLinksPageController({ initialState }), {
			wrapper: createWrapper(new QueryClient()),
		});

		act(() => result.current.updateProfile({ title: { en: "Local version" } }));
		await waitFor(() => expect(result.current.error).toBe("conflict"), { timeout: 3000 });
		await act(async () => result.current.retrySave());
		expect(mocks.save).toHaveBeenCalledOnce();
		await act(async () => result.current.refresh());
		expect(result.current.document).toEqual(latest.document);
		expect(result.current.hasRecovery).toBe(true);
		act(() => result.current.downloadDraft());
		expect(mocks.download).toHaveBeenCalledWith(
			expect.objectContaining({ content: expect.stringContaining('"en": "Local version"') })
		);
		mocks.save.mockImplementation(async ({ document }) => ({ ...latest, document }));
		act(() => result.current.updateProfile({ title: { en: "Merged version" } }));
		await waitFor(() => expect(result.current.dirty).toBe(false), { timeout: 3000 });
		expect(mocks.save).toHaveBeenLastCalledWith({
			document: result.current.document,
			updatedAt: latest.updatedAt,
		});
	});

	it("keeps a pending queue across remounts and adopts its eventual save", async () => {
		const queryClient = new QueryClient();
		const wrapper = createWrapper(queryClient);
		const request = Promise.withResolvers<LinkPageState>();
		mocks.save.mockReturnValueOnce(request.promise);
		const editor = renderHook(() => useLinksPageController({ initialState }), { wrapper });
		act(() => editor.result.current.updateProfile({ title: { en: "Retained draft" } }));
		await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce(), { timeout: 3000 });
		editor.unmount();
		const recovered = renderHook(() => useLinksPageController({ initialState }), { wrapper });
		expect(recovered.result.current.document.profile.title.en).toBe("Retained draft");
		await act(async () => {
			request.resolve({ ...initialState, document: recovered.result.current.document });
			await request.promise;
		});
		expect(recovered.result.current.saving).toBe(false);
		expect(recovered.result.current.dirty).toBe(false);
		expect(mocks.save).toHaveBeenCalledOnce();
	});

	it("stops queued saves and ignores late cache writes after an organization cache reset", async () => {
		const queryClient = new QueryClient();
		const request = Promise.withResolvers<LinkPageState>();
		mocks.save.mockReturnValueOnce(request.promise);

		const editor = renderHook(() => useLinksPageController({ initialState }), {
			wrapper: createWrapper(queryClient),
		});

		act(() => editor.result.current.updateProfile({ title: { en: "Previous organization" } }));
		await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce(), { timeout: 3000 });
		act(() => editor.result.current.updateProfile({ title: { en: "Queued previous organization" } }));
		editor.unmount();
		queryClient.getQueryCache().clear();
		await act(async () => {
			request.resolve({ ...initialState, document: editor.result.current.document });
			await request.promise;
		});
		expect(mocks.save).toHaveBeenCalledOnce();
		expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
		expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true);
	});

	it("saves a valid edit as an unpublished draft after the autosave delay", async () => {
		const queryClient = new QueryClient();
		const updatedAt = "2026-09-02T12:00:01.000Z";

		const { result } = renderHook(() => useLinksPageController({ initialState }), {
			wrapper: createWrapper(queryClient),
		});

		act(() => result.current.updateProfile({ title: { en: "Updated draft" } }));

		await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce(), { timeout: 3000 });

		expect(mocks.save).toHaveBeenCalledWith({
			document: result.current.document,
			updatedAt: initialState.updatedAt,
		});
		await waitFor(() => expect(result.current.dirty).toBe(false));
		expect(result.current.state).toMatchObject({
			publication: { hasUnpublishedChanges: true },
			updatedAt,
		});
		expect(queryClient.getQueryData<LinkPageState>(["linkPages", "get"])?.document.profile.title.en).toBe(
			"Updated draft"
		);
	});

	it("prevents a refresh while the draft save is pending", async () => {
		const queryClient = new QueryClient();
		const saveRequest = Promise.withResolvers<LinkPageState>();

		mocks.save.mockReturnValue(saveRequest.promise);

		const { result } = renderHook(() => useLinksPageController({ initialState }), {
			wrapper: createWrapper(queryClient),
		});

		act(() => result.current.updateProfile({ title: { en: "Durable draft" } }));

		await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce(), { timeout: 3000 });

		const pendingUnload = new Event("beforeunload", { cancelable: true });

		window.dispatchEvent(pendingUnload);

		expect(pendingUnload.defaultPrevented).toBe(true);

		await act(async () => {
			saveRequest.resolve({
				...initialState,
				document: result.current.document,
				publication: { ...initialState.publication, hasUnpublishedChanges: true },
				updatedAt: "2026-09-02T12:00:01.000Z",
			});
			await saveRequest.promise;
		});

		const savedUnload = new Event("beforeunload", { cancelable: true });

		window.dispatchEvent(savedUnload);

		expect(savedUnload.defaultPrevented).toBe(false);
	});

	it("coalesces rapid edits and persists the latest draft", async () => {
		const queryClient = new QueryClient();
		const firstSave = Promise.withResolvers<LinkPageState>();
		const latestSave = Promise.withResolvers<LinkPageState>();

		mocks.save.mockReturnValueOnce(firstSave.promise).mockReturnValueOnce(latestSave.promise);

		const { result } = renderHook(() => useLinksPageController({ initialState }), {
			wrapper: createWrapper(queryClient),
		});

		act(() => result.current.updateProfile({ title: { en: "First edit" } }));

		await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce(), { timeout: 3000 });

		act(() => result.current.updateProfile({ title: { en: "Latest edit" } }));

		expect(mocks.save).toHaveBeenCalledOnce();

		const firstDocument = mocks.save.mock.calls[0]?.[0].document;

		if (!firstDocument) {
			throw new Error("Expected the first draft document");
		}

		await act(async () => {
			firstSave.resolve({
				...initialState,
				document: firstDocument,
				publication: { ...initialState.publication, hasUnpublishedChanges: true },
				updatedAt: "2026-09-02T12:00:01.000Z",
			});
			await firstSave.promise;
		});

		await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2), { timeout: 3000 });

		const latestDocument = mocks.save.mock.calls[1]?.[0].document;

		expect(latestDocument?.profile.title.en).toBe("Latest edit");
		expect(mocks.save.mock.calls[1]?.[0].updatedAt).toBe("2026-09-02T12:00:01.000Z");

		if (!latestDocument) {
			throw new Error("Expected the latest draft document");
		}

		await act(async () => {
			latestSave.resolve({
				...initialState,
				document: latestDocument,
				publication: { ...initialState.publication, hasUnpublishedChanges: true },
				updatedAt: "2026-09-02T12:00:02.000Z",
			});
			await latestSave.promise;
		});

		expect(result.current.dirty).toBe(false);
		expect(result.current.state.document.profile.title.en).toBe("Latest edit");
	});

	it("sends one save for a burst of edits", async () => {
		const { result } = renderHook(() => useLinksPageController({ initialState }), {
			wrapper: createWrapper(new QueryClient()),
		});

		for (const title of ["One", "Two", "Three"]) {
			act(() => result.current.updateProfile({ title: { en: title } }));
		}

		expect(mocks.save).not.toHaveBeenCalled();
		await waitFor(() => expect(result.current.dirty).toBe(false), { timeout: 3000 });
		expect(mocks.save).toHaveBeenCalledOnce();
		expect(mocks.save.mock.lastCall?.[0].document.profile.title.en).toBe("Three");
	});

	it("retries a failed request automatically", async () => {
		mocks.save.mockRejectedValueOnce(new Error("Offline"));

		const { result } = renderHook(() => useLinksPageController({ initialState }), {
			wrapper: createWrapper(new QueryClient()),
		});

		act(() => result.current.updateProfile({ title: { en: "Retried" } }));
		await waitFor(() => expect(result.current.error).toBe("request"), { timeout: 3000 });
		await waitFor(() => expect(result.current.dirty).toBe(false), { timeout: 3000 });
		expect(mocks.save).toHaveBeenCalledTimes(2);
		expect(result.current.error).toBeNull();
	});

	it("does not retry a conflict", async () => {
		mocks.save.mockRejectedValueOnce(new ORPCError("CONFLICT"));

		const { result } = renderHook(() => useLinksPageController({ initialState }), {
			wrapper: createWrapper(new QueryClient()),
		});

		act(() => result.current.updateProfile({ title: { en: "Conflicted" } }));
		await waitFor(() => expect(result.current.error).toBe("conflict"), { timeout: 3000 });
		await act(() => new Promise((resolve) => setTimeout(resolve, 1500)));
		expect(mocks.save).toHaveBeenCalledOnce();
		expect(result.current.error).toBe("conflict");
	});

	it("flushes the latest draft before publishing it", async () => {
		const queryClient = new QueryClient();
		const draftUpdatedAt = "2026-09-02T12:00:01.000Z";

		mocks.publish.mockImplementation(async () => ({
			...initialState,
			document: {
				...initialState.document,
				profile: { ...initialState.document.profile, title: { en: "Live" } },
			},
			publication: { hasUnpublishedChanges: false, publishedAt: "2026-09-02T12:00:02.000Z" },
			updatedAt: "2026-09-02T12:00:02.000Z",
		}));

		const { result } = renderHook(() => useLinksPageController({ initialState }), {
			wrapper: createWrapper(queryClient),
		});

		act(() => result.current.updateProfile({ title: { en: "Live" } }));

		await act(async () => result.current.publish());

		expect(mocks.save).toHaveBeenCalledTimes(1);
		expect(mocks.publish).toHaveBeenCalledWith({ updatedAt: draftUpdatedAt });
		expect(mocks.save.mock.invocationCallOrder[0]).toBeLessThan(mocks.publish.mock.invocationCallOrder[0] ?? 0);
		expect(result.current.state.publication.hasUnpublishedChanges).toBe(false);
	});

	it("keeps an edit made while publishing", async () => {
		const request = Promise.withResolvers<LinkPageState>();
		mocks.publish.mockReturnValue(request.promise);

		const { result } = renderHook(() => useLinksPageController({ initialState }), {
			wrapper: createWrapper(new QueryClient()),
		});

		act(() => result.current.updateProfile({ title: { en: "Live" } }));
		const publishing = act(() => result.current.publish());
		await waitFor(() => expect(mocks.publish).toHaveBeenCalledOnce());
		act(() => result.current.updateProfile({ title: { en: "Edited during publish" } }));
		request.resolve({
			...initialState,
			document: {
				...initialState.document,
				profile: { ...initialState.document.profile, title: { en: "Live" } },
			},
			updatedAt: "2026-09-02T12:00:02.000Z",
		});
		await publishing;
		expect(result.current.document.profile.title.en).toBe("Edited during publish");
		await waitFor(
			() => expect(mocks.save.mock.lastCall?.[0].document.profile.title.en).toBe("Edited during publish"),
			{ timeout: 3000 }
		);
	});

	it("cancels an incomplete block before it is saved", () => {
		const { result } = renderHook(() => useLinksPageController({ initialState }), {
			wrapper: createWrapper(new QueryClient()),
		});

		act(() => result.current.addBlock({ kind: "video" }));

		expect(result.current.valid).toBe(false);
		expect(result.current.view.kind).toBe("block");

		act(() => result.current.cancelView());

		expect(result.current.document.blocks).toEqual([]);
		expect(result.current.valid).toBe(true);
		expect(mocks.save).not.toHaveBeenCalled();
	});
});

describe("links block ordering", () => {
	it("adds blocks to the selected page section", () => {
		const document = createDefaultLinkPageDocument({ name: "Northstar" });
		const block = createLink("018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d");

		const next = blockOperations.add(document, block, 0, "header");

		expect(next.blocks).toEqual([block]);
		expect(next.headerBlockIds).toEqual([block.id]);
	});

	it("moves blocks only within their header or body section", () => {
		const document = createDefaultLinkPageDocument({ name: "Northstar" });
		const headerOne = createLink("018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d");
		const bodyOne = createLink("018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32e");
		const headerTwo = createLink("018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32f");
		const bodyTwo = createLink("018ff7c2-1f7c-7b28-b6c1-3f2e60b5d330");
		document.blocks = [headerOne, bodyOne, headerTwo, bodyTwo];
		document.headerBlockIds = [headerOne.id, headerTwo.id];

		expect(blockOperations.move(document, bodyOne.id, -1)).toBe(document);
		expect(blockOperations.move(document, headerTwo.id, 1)).toBe(document);

		const moved = blockOperations.move(document, headerOne.id, 1);

		const movedHeaderIds = moved.blocks
			.filter((block) => moved.headerBlockIds.includes(block.id))
			.map((block) => block.id);

		const movedBodyIds = moved.blocks
			.filter((block) => !moved.headerBlockIds.includes(block.id))
			.map((block) => block.id);

		expect(movedHeaderIds).toEqual([headerTwo.id, headerOne.id]);
		expect(movedBodyIds).toEqual([bodyOne.id, bodyTwo.id]);
	});
});

describe("links preview controls", () => {
	it("refreshes the preview after an Agent edit while the Agent tab stays open", async () => {
		mocks.chatMessages = [];
		mocks.save.mockReset();
		const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
		queryClient.setQueryData(["linkPages", "get"], initialState);

		const changed = {
			...initialState,
			document: {
				...initialState.document,
				profile: { ...initialState.document.profile, title: { en: "Updated by Agent" } },
			},
			updatedAt: "2026-09-12T00:00:00.000Z",
		};

		mocks.query.mockResolvedValue(changed);

		const page = (
			<SidebarProvider purpose='navigation'>
				<QueryClientProvider client={queryClient}>
					<LinksPage />
				</QueryClientProvider>
			</SidebarProvider>
		);

		const view = render(page, { wrapper: NuqsTestingAdapter });
		fireEvent.click(view.getByRole("tab", { name: "agent" }));
		await view.findByRole("textbox", { name: "writePrompt" });
		mocks.chatMessages = [
			{
				id: "agent-edit",
				parts: [
					{
						input: {
							edits: [{ operation: "update-profile", title: { en: "Updated by Agent" } }],
							updatedAt: "2026-09-02T12:00:00.000Z",
						},
						output: { hasUnpublishedChanges: true, updatedAt: changed.updatedAt },
						state: "output-available",
						toolCallId: "edit-1",
						type: "tool-editLinkPage",
					},
				],
				role: "assistant",
			},
		];
		view.rerender(
			<SidebarProvider purpose='navigation'>
				<QueryClientProvider client={queryClient}>
					<LinksPage />
				</QueryClientProvider>
			</SidebarProvider>
		);
		await waitFor(() =>
			expect(view.container.querySelector("[data-links-profile]")).toHaveTextContent("Updated by Agent")
		);
		expect(view.getByRole("tab", { name: "agent" })).toHaveAttribute("aria-selected", "true");
		expect(mocks.save).not.toHaveBeenCalled();
		mocks.chatMessages = [];
	});

	it("selects a single toolbar by tap and preserves desktop hover", async () => {
		const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
		const block = createLink("018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d");

		const state = {
			...initialState,
			document: blockOperations.add(initialState.document, block, 0, "page"),
		};

		queryClient.setQueryData(["linkPages", "get"], state);

		const { container } = render(
			<SidebarProvider purpose='navigation'>
				<QueryClientProvider client={queryClient}>
					<LinksPage />
				</QueryClientProvider>
			</SidebarProvider>,
			{ wrapper: NuqsTestingAdapter }
		);

		const frame = container.querySelector<HTMLElement>("[data-links-viewport]");
		const corridor = container.querySelector<HTMLElement>("[data-links-toolbar-corridor]");

		const blockContent = container.querySelector<HTMLElement>(
			`[data-links-block-id="${block.id}"] [data-links-block-content]`
		);

		if (!frame || !corridor || !blockContent) {
			throw new Error("Expected the link preview controls");
		}

		expect(frame).not.toContainElement(corridor);
		expect(corridor.parentElement).toHaveClass("start-full", "hidden", "md:[@media(pointer:fine)]:block");
		expect(corridor.querySelector('[role="toolbar"]')).not.toBeInTheDocument();

		const profile = container.querySelector<HTMLElement>("[data-links-profile]");

		if (!profile) {
			throw new Error("Expected the profile");
		}

		const touchToolbars = () => container.querySelectorAll('[data-links-touch-toolbar] [role="toolbar"]');
		expect(touchToolbars()).toHaveLength(0);
		fireEvent.pointerMove(blockContent, { pointerType: "touch" });
		expect(touchToolbars()).toHaveLength(0);
		fireEvent.click(blockContent);
		expect(touchToolbars()).toHaveLength(1);
		expect(touchToolbars()[0]?.querySelector('[aria-label="moveUp"]')).toBeInTheDocument();
		expect(blockContent.parentElement?.querySelector('[role="toolbar"]')).not.toBeInTheDocument();
		fireEvent.pointerLeave(blockContent, { pointerType: "touch" });
		expect(touchToolbars()).toHaveLength(1);
		fireEvent.click(profile);
		expect(touchToolbars()).toHaveLength(1);
		expect(touchToolbars()[0]?.querySelector('[aria-label="moveUp"]')).not.toBeInTheDocument();
		fireEvent.click(frame);
		expect(touchToolbars()).toHaveLength(0);

		const media = window.matchMedia("");
		await vi.mocked(window.matchMedia).withImplementation(
			(query) => ({ ...media, matches: query === "(min-width: 768px) and (pointer: fine)", media: query }),
			async () => {
				fireEvent.pointerMove(blockContent, { pointerType: "mouse" });
			}
		);

		await waitFor(() => expect(corridor.querySelector('[role="toolbar"]')).toBeInTheDocument());
	});
});

vi.mock("@/hooks/use-organization-permissions", () => ({
	useOrganizationPermissions: () => mockOrganizationPermissions(),
}));

vi.mock("@/app/[locale]/dashboard/components/editor/use-website-languages", () => ({
	useWebsiteLanguages: () => ({ enabled: false }),
}));

vi.mock("@/app/[locale]/dashboard/components/editor/website-settings-modal", () => ({
	WebsiteSettingsModal: () => null,
}));
