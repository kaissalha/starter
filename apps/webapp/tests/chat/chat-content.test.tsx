import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockOrganizationPermissions, organizationPermissionState } from "../mocks/organization-permissions";

const chatState = vi.hoisted(() => ({ awaitingApproval: false }));

vi.mock("@/components/chat/stores/chat-session-store", () => ({
	selectChatSessionAwaitingApproval: (state: typeof chatState) => state.awaitingApproval,
	useChatSession: <T,>(selector: (state: typeof chatState) => T) => selector(chatState),
}));

vi.mock("@/components/chat/chat-input/chat-composer", () => ({
	ChatComposer: () => <div data-testid='chat-composer' />,
}));

vi.mock("@/components/chat/message/chat-message-list", () => ({
	ChatMessageList: () => <div data-testid='chat-messages' />,
}));

import { ChatContent } from "@/components/chat/chat-content";

describe("ChatContent", () => {
	it("keeps history visible while removing the composer after a member downgrade", () => {
		const { rerender } = render(<ChatContent />);
		expect(screen.getByTestId("chat-composer")).toBeInTheDocument();
		organizationPermissionState.role = "member";
		rerender(<ChatContent />);
		expect(screen.queryByTestId("chat-composer")).not.toBeInTheDocument();
		expect(screen.getByTestId("chat-messages")).toBeInTheDocument();
	});
	beforeEach(() => {
		chatState.awaitingApproval = false;
	});

	it("removes the ordinary composer while a manual approval is pending", () => {
		const { rerender } = render(<ChatContent />);

		expect(screen.getByTestId("chat-composer")).toBeInTheDocument();

		chatState.awaitingApproval = true;
		rerender(<ChatContent />);

		expect(screen.queryByTestId("chat-composer")).not.toBeInTheDocument();
		expect(screen.getByTestId("chat-messages")).toBeInTheDocument();
	});
});

vi.mock("@/hooks/use-organization-permissions", () => ({
	useOrganizationPermissions: () => mockOrganizationPermissions(),
}));
