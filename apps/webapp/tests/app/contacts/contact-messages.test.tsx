import { useState } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ContactMessages } from "@/app/[locale]/dashboard/contacts/contact-messages";

import { mockOrganizationPermissions, organizationPermissionState } from "../../mocks/organization-permissions";

const messages = [
	{
		createdAt: "2026-09-18T12:00:00Z",
		id: "message-1",
		message: "Can I book tomorrow?",
		senderName: "Ada",
		senderPhone: null,
		spamFlag: false,
		triageCategory: null,
		triagedAt: null,
		triageUrgency: null,
	},
	{
		createdAt: "2026-09-17T12:00:00Z",
		id: "message-2",
		message: "BUY NOW",
		senderName: "Bot",
		senderPhone: null,
		spamFlag: true,
		triageCategory: "other",
		triagedAt: "2026-09-17T12:00:05Z",
		triageUrgency: "routine",
	},
];

const { triage } = vi.hoisted(() => ({
	triage: vi.fn<
		(input: {
			contactId: string;
			messageId: string;
		}) => Promise<{ category: string; status: string; urgency: string }>
	>(),
}));

vi.mock("@/lib/api-client", () => ({
	apiClient: {
		contacts: {
			message: {
				key: () => ["message"],
				queryOptions: ({ enabled, input }: { enabled: boolean; input: { messageId: string } }) => ({
					enabled,
					queryFn: async () => messages.find((message) => message.id === input.messageId),
					queryKey: ["message", input.messageId],
				}),
			},
			messages: {
				infiniteOptions: () => ({
					getNextPageParam: () => undefined,
					initialPageParam: null,
					queryFn: async () => ({ data: messages, meta: { cursor: null } }),
					queryKey: ["messages"],
				}),
				key: () => ["messages"],
			},
			triage: { mutationOptions: () => ({ mutationFn: triage }) },
		},
	},
}));

vi.mock("@/hooks/use-organization-permissions", () => ({
	useOrganizationPermissions: () => mockOrganizationPermissions(),
}));

const renderMessages = () => {
	const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });

	const TestMessages = () => {
		const [messageId, setMessageId] = useState<string | null>(null);

		return <ContactMessages contactId='contact-1' messageId={messageId} onMessageChange={setMessageId} />;
	};

	render(
		<NextIntlClientProvider locale='en' messages={{}} timeZone='UTC'>
			<QueryClientProvider client={client}>
				<TestMessages />
			</QueryClientProvider>
		</NextIntlClientProvider>
	);

	return userEvent.setup();
};

beforeEach(() => {
	triage.mockReset();
});

describe("contact messages", () => {
	it("opens a message drawer and shows persisted triage badges", async () => {
		const user = renderMessages();
		await user.click(await screen.findByRole("button", { name: /BUY NOW/ }));
		const drawer = await screen.findByRole("dialog", { name: "Bot" });
		expect(drawer).toHaveAttribute("data-slot", "drawer-popup");
		expect(within(drawer).getByText("BUY NOW")).toBeVisible();
		const badges = within(drawer).getByRole("list", { name: "triageBadges" });
		expect(badges).toHaveTextContent("spamFlag");
		expect(badges).toHaveTextContent("triageCategories.other");
		expect(badges).toHaveTextContent("triageUrgencies.routine");
		expect(within(drawer).queryByRole("button", { name: "triageAction" })).not.toBeInTheDocument();
		await user.click(within(drawer).getByRole("button", { name: "close" }));
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "Bot" })).not.toBeInTheDocument());
	});
	it("requests a suggestion only after opening a message and clicking the action", async () => {
		triage.mockResolvedValue({ category: "booking", status: "suggested", urgency: "timeSensitive" });
		const user = renderMessages();
		await user.click(await screen.findByRole("button", { name: /Can I book tomorrow/ }));
		const dialog = await screen.findByRole("dialog");
		expect(triage).not.toHaveBeenCalled();
		await user.click(within(dialog).getByRole("button", { name: "triageAction" }));
		await waitFor(() =>
			expect(triage).toHaveBeenCalledWith({ contactId: "contact-1", messageId: "message-1" }, expect.anything())
		);
		expect(within(dialog).getByText("Can I book tomorrow?")).toBeVisible();
	});
	it("hides the triage action from read-only members", async () => {
		organizationPermissionState.role = "member";
		const user = renderMessages();
		await user.click(await screen.findByRole("button", { name: /Can I book tomorrow/ }));
		const dialog = await screen.findByRole("dialog");
		expect(within(dialog).getByText("Can I book tomorrow?")).toBeVisible();
		expect(within(dialog).queryByRole("button", { name: "triageAction" })).not.toBeInTheDocument();
	});
	it.each(["unavailable", "error"])("keeps a retry and the original text after %s", async (status) => {
		if (status === "error") {
			triage.mockRejectedValue(new Error("Unavailable"));
		} else {
			triage.mockResolvedValue({ category: "unknown", status, urgency: "unknown" });
		}

		const user = renderMessages();
		await user.click(await screen.findByRole("button", { name: /Can I book tomorrow/ }));
		const dialog = await screen.findByRole("dialog");
		await user.click(within(dialog).getByRole("button", { name: "triageAction" }));
		expect(await within(dialog).findByText("triageUnavailable")).toBeVisible();
		expect(within(dialog).getByText("Can I book tomorrow?")).toBeVisible();
		expect(within(dialog).getByRole("button", { name: "triageAction" })).toBeEnabled();
	});
});
