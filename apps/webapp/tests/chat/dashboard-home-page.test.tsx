import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { StoreApi } from "zustand/vanilla";

import {
	DashboardHomePage,
	DashboardNewHomePage,
} from "@/app/[locale]/dashboard/(home)/components/dashboard-home-page";
import type { ChatSessionRuntimeConfig } from "@/components/chat/stores/chat-session-runtime";
import type { ChatSessionState } from "@/components/chat/stores/chat-session-store";

import { mockOrganizationPermissions } from "../mocks/organization-permissions";

vi.mock("@/app/[locale]/dashboard/(home)/components/dashboard-history", () => ({ DashboardHistory: () => null }));

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("@/i18n/navigation", () => ({ useRouter: () => navigation }));

vi.mock("@/lib/api-client", () => ({
	apiClient: { chats: { list: { key: () => ["chats"] } } },
}));

vi.mock("@/components/chat/stores/chat-session-runtime", () => ({
	ChatSessionRuntime: ({
		chatId,
		onChatCreated,
		store,
	}: ChatSessionRuntimeConfig & { store: StoreApi<ChatSessionState> }) => (
		<button
			onClick={() => {
				store.setState({
					messages: [{ id: "message", parts: [{ text: "Hello", type: "text" }], role: "user" }],
				});
				onChatCreated?.(chatId);
			}}
			type='button'
		>
			Create {chatId}
		</button>
	),
}));

vi.mock("@/components/chat/chat-history-button", () => ({ ChatHistoryButton: () => null }));

vi.mock("@/components/chat/chat-new-chat-button", () => ({
	ChatNewChatButton: ({ onClick }: { onClick: () => void }) => (
		<button onClick={onClick} type='button'>
			New chat
		</button>
	),
}));

vi.mock("@/components/chat/chat-content", () => ({ ChatContent: () => null }));

vi.mock("@/components/chat/chat-input/chat-composer", () => ({ ChatComposer: () => null }));

vi.mock("@/app/[locale]/dashboard/components/layout/header/header", () => ({
	Header: ({ actions }: { actions: ReactNode }) => actions,
}));

vi.mock("@starter/ui/components/sidebar", () => ({ SidebarTrigger: () => null }));

describe("DashboardNewHomePage", () => {
	it("returns to dashboard home from an existing chat", async () => {
		const user = userEvent.setup();
		render(
			<QueryClientProvider client={new QueryClient()}>
				<DashboardHomePage
					chatId='existing-chat'
					greeting='Hello'
					initialMessages={[{ id: "message", parts: [{ text: "Hello", type: "text" }], role: "user" }]}
				/>
			</QueryClientProvider>
		);

		await user.click(screen.getByRole("button", { name: "New chat" }));

		expect(navigation.push).toHaveBeenCalledWith("/dashboard");
	});

	it("resets a chat started on the home page before returning to dashboard home", async () => {
		const user = userEvent.setup();
		render(
			<QueryClientProvider client={new QueryClient()}>
				<DashboardNewHomePage greeting='Hello' />
			</QueryClientProvider>
		);
		const runtime = screen.getByRole("button", { name: /^Create / });
		await user.click(runtime);
		await user.click(screen.getByRole("button", { name: "New chat" }));

		expect(navigation.push).toHaveBeenCalledWith("/dashboard");
		expect(screen.getByRole("button", { name: /^Create / }).textContent).not.toBe(runtime.textContent);
		expect(screen.queryByRole("button", { name: "New chat" })).not.toBeInTheDocument();
	});

	it.each(["/dashboard", "/ar/dashboard"])(
		"records the created chat at %s without navigating away from its runtime",
		async (pathname) => {
			window.history.replaceState(null, "", `${pathname}?source=test#composer`);
			const queryClient = new QueryClient();
			const invalidate = vi.spyOn(queryClient, "invalidateQueries");
			const user = userEvent.setup();
			render(
				<QueryClientProvider client={queryClient}>
					<DashboardNewHomePage greeting='Hello' />
				</QueryClientProvider>
			);
			const runtime = screen.getByRole("button", { name: /^Create / });
			const chatId = runtime.textContent?.replace("Create ", "");
			const historyLength = window.history.length;

			await user.click(runtime);

			expect(window.location.pathname).toBe(pathname);
			expect(new URLSearchParams(window.location.search).get("chatId")).toBe(chatId);
			expect(new URLSearchParams(window.location.search).get("source")).toBe("test");
			expect(window.location.hash).toBe("#composer");
			expect(window.history.length).toBe(historyLength);
			expect(navigation.replace).not.toHaveBeenCalled();
			expect(navigation.push).not.toHaveBeenCalled();
			expect(screen.getByRole("button", { name: /^Create / })).toBe(runtime);
			expect(invalidate).toHaveBeenCalledWith({ queryKey: ["chats"] });
		}
	);
});

vi.mock("@/hooks/use-organization-permissions", () => ({
	useOrganizationPermissions: () => mockOrganizationPermissions(),
}));
