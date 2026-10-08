import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatMessage } from "@/components/chat/message/chat-message";
import { ChatMessageParts } from "@/components/chat/message/chat-message-parts";
import { OpenUIBlock } from "@/components/chat/openui/openui-block";
import type { DashboardChatUIMessage as BaseChatUIMessage } from "@starter/server";

import { invalidOpenUIPrograms } from "../../../../tools/testing/invalid-openui-programs";
import { mockOrganizationPermissions, organizationPermissionState } from "../mocks/organization-permissions";

const addToolApprovalResponse = vi.hoisted(() => vi.fn());

const sendMessage = vi.hoisted(() => vi.fn());

const chatSession: { busy: boolean; messages: Array<BaseChatUIMessage> } = vi.hoisted(() => ({
	busy: false,
	messages: [],
}));

vi.mock("@/components/chat/stores/chat-session-store", () => ({
	selectChatSessionBusy: () => chatSession.busy,
	useChatSession: <T,>(
		selector: (state: {
			actions: { addToolApprovalResponse: typeof addToolApprovalResponse; sendMessage: typeof sendMessage };
			messages: Array<BaseChatUIMessage>;
			status: "ready";
		}) => T
	) =>
		selector({
			actions: { addToolApprovalResponse, sendMessage },
			messages: chatSession.messages,
			status: "ready",
		}),
}));

vi.mock("thinking-orbs", () => ({
	ThinkingOrb: ({
		"aria-hidden": ariaHidden,
		"data-thinking-orb-state": state,
	}: {
		"aria-hidden"?: boolean;
		"data-thinking-orb-state"?: string;
	}) => <canvas aria-hidden={ariaHidden} data-thinking-orb-state={state} />,
}));

const firstToolPart: BaseChatUIMessage["parts"][number] = {
	input: { queryText: "revenue", topK: 8 },
	output: { sources: [] },
	state: "output-available",
	toolCallId: "retrieve-knowledge",
	type: "tool-retrieveKnowledge",
};

const secondToolPart: BaseChatUIMessage["parts"][number] = {
	input: { queryText: "expenses", topK: 5 },
	output: { sources: [] },
	state: "output-available",
	toolCallId: "retrieve-knowledge-2",
	type: "tool-retrieveKnowledge",
};

beforeEach(() => {
	addToolApprovalResponse.mockReset();
	sendMessage.mockReset();
	sendMessage.mockResolvedValue(undefined);
	chatSession.busy = false;
	chatSession.messages = [];
});

describe("ChatMessageParts", () => {
	it.each(["admin", "member"] as const)("blocks destructive approval for %s", async (role) => {
		organizationPermissionState.role = role;
		render(
			<ChatMessageParts
				isStreaming={false}
				isUser={false}
				messageId='permission-check'
				parts={[
					{
						approval: { id: "delete-approval" },
						input: {
							assetId: "550e8400-e29b-41d4-a716-446655440000",
							edits: [{ find: "Old", replace: "" }],
							updatedAt: "2026-08-22T12:00:00.000Z",
						},
						state: "approval-requested",
						toolCallId: "delete-call",
						type: "tool-editLibraryDocument",
					},
				]}
			/>
		);
		expect(screen.getByRole("button", { name: "approve" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "deny" }).hasAttribute("disabled")).toBe(role === "member");
		expect(addToolApprovalResponse).not.toHaveBeenCalled();
	});
	it("keeps interrupted assistant prose hidden after streaming stops", () => {
		const { container } = render(
			<ChatMessageParts
				isStreaming={false}
				isUser={false}
				messageId='interrupted'
				parts={[{ state: "streaming", text: "Maybe I should guess a schema", type: "text" }]}
			/>
		);

		expect(container.textContent).toBe("");
	});

	it("buffers prose until completion and omits tool-working text from history and copying", async () => {
		const user = userEvent.setup();

		const parts: BaseChatUIMessage["parts"] = [
			{ text: "Maybe I should guess the saveLinkPage schema.", type: "text" },
			firstToolPart,
			{ text: "Here is the final answer.", type: "text" },
		];

		const { rerender } = render(
			<ChatMessageParts isStreaming isUser={false} messageId='buffered' parts={parts} showThinking />
		);

		expect(screen.queryByText("Maybe I should guess the saveLinkPage schema.")).toBeNull();
		expect(screen.queryByText("Here is the final answer.")).toBeNull();
		rerender(<ChatMessage message={{ id: "buffered", parts, role: "assistant" }} />);
		expect(screen.queryByText("Maybe I should guess the saveLinkPage schema.")).toBeNull();
		expect(screen.getByText("Here is the final answer.")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "copyToClipboard" }));
		expect(await navigator.clipboard.readText()).toBe("Here is the final answer.");
	});

	it.each([false, true])(
		"hides reasoning and skill activity while preserving the answer (streaming: %s)",
		(isStreaming) => {
			const { container } = render(
				<ChatMessageParts
					isStreaming={isStreaming}
					isUser={false}
					messageId='private-reasoning'
					parts={[
						{
							state: isStreaming ? "streaming" : "done",
							text: "Internal database UUID reasoning",
							type: "reasoning",
						},
						{
							input: { name: "contacts" },
							output: "Internal instructions",
							state: "output-available",
							toolCallId: "load-contacts",
							toolName: "skill",
							type: "dynamic-tool",
						},
						{
							errorText: "Private error",
							input: {},
							state: "output-error",
							toolCallId: "read-contacts",
							toolName: "skill_read",
							type: "dynamic-tool",
						},
						{ text: "Added Anas to your contacts.", type: "text" },
					]}
				/>
			);

			expect(screen.queryByText("Added Anas to your contacts.") !== null).toBe(!isStreaming);
			expect(container.textContent).not.toMatch(/Internal|UUID|Private|skill|reasoning/u);
			expect(container.querySelector("details")).not.toBeInTheDocument();
		}
	);

	it("replaces technical tool errors with a useful status", () => {
		render(
			<ChatMessageParts
				isStreaming={false}
				isUser={false}
				messageId='tool-failure'
				parts={[
					{
						errorText: "SQL connection failed at private-host",
						input: { assetId: "550e8400-e29b-41d4-a716-446655440000" },
						state: "output-error",
						toolCallId: "get-library-asset",
						type: "tool-getLibraryAsset",
					},
				]}
			/>
		);
		expect(screen.getByText("error")).toBeInTheDocument();
		expect(screen.queryByText(/SQL|private-host/u)).not.toBeInTheDocument();
	});

	it("renders an indexed model attachment once", () => {
		render(
			<ChatMessageParts
				isStreaming={false}
				isUser
				messageId='user-message'
				parts={[
					{
						data: {
							fileId: "550e8400-e29b-41d4-a716-446655440000",
							filename: "agreement.pdf",
							mediaType: "application/pdf",
						},
						type: "data-attachment",
					},
					{
						filename: "agreement.pdf",
						mediaType: "application/pdf",
						type: "file",
						url: "https://example.com/agreement.pdf",
					},
				]}
			/>
		);

		expect(screen.getAllByText("agreement.pdf")).toHaveLength(1);
	});

	it("keeps timeline steps together across empty text parts", () => {
		const { container } = render(
			<ChatMessageParts
				isStreaming={false}
				isUser={false}
				messageId='assistant-message'
				parts={[firstToolPart, { text: " \n ", type: "text" }, secondToolPart]}
			/>
		);

		expect(container.children).toHaveLength(1);
		expect(container.firstElementChild?.children).toHaveLength(2);
	});

	it("maps active chat work to the matching thinking orb states", () => {
		const { container } = render(
			<ChatMessageParts
				isStreaming
				isUser={false}
				messageId='assistant-message'
				parts={[
					{
						state: "streaming",
						text: "Checking the available context",
						type: "reasoning",
					},
					{
						input: { query: "market reputation" },
						state: "input-available",
						toolCallId: "web-search",
						type: "tool-webSearch",
					},
					{
						input: { assetId: "550e8400-e29b-41d4-a716-446655440000" },
						state: "input-available",
						toolCallId: "get-library-asset",
						type: "tool-getLibraryAsset",
					},
				]}
			/>
		);

		expect(
			Array.from(container.querySelectorAll("[data-thinking-orb-state]")).map((orb) =>
				orb.getAttribute("data-thinking-orb-state")
			)
		).toEqual(["searching", "composing"]);

		expect(container.querySelectorAll("canvas[aria-hidden='true']")).toHaveLength(2);
	});

	it("uses the composing orb while awaiting the next assistant part", () => {
		const { container } = render(
			<ChatMessageParts isStreaming isUser={false} messageId='assistant-message' parts={[]} showThinking />
		);

		expect(container.querySelector("[data-thinking-orb-state='composing']")).toBeInTheDocument();
		expect(container.querySelector("[data-thinking-orb-state='working']")).not.toBeInTheDocument();
	});

	it("requires an explicit approval response before an action", async () => {
		const user = userEvent.setup();

		render(
			<ChatMessageParts
				isStreaming={false}
				isUser={false}
				messageId='assistant-message'
				parts={[
					{
						approval: { id: "approval-create-document" },
						input: { content: "# Notes", name: "Notes" },
						state: "approval-requested",
						toolCallId: "create-document",
						type: "tool-createLibraryDocument",
					},
				]}
			/>
		);

		expect(screen.getByText("summary.review")).toBeInTheDocument();
		expect(screen.queryByText('"content":', { exact: false })).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "deny" }));
		expect(addToolApprovalResponse).toHaveBeenCalledWith({ approved: false, id: "approval-create-document" });
		await user.click(screen.getByRole("button", { name: "approve" }));
		expect(addToolApprovalResponse).toHaveBeenCalledWith({ approved: true, id: "approval-create-document" });
	});

	it("responds to every pending approval at once", async () => {
		const user = userEvent.setup();
		organizationPermissionState.role = "owner";

		const parts = [
			{
				approval: { id: "approval-one" },
				input: { content: "# One", name: "One" },
				state: "approval-requested" as const,
				toolCallId: "create-one",
				type: "tool-createLibraryDocument" as const,
			},
			{
				approval: { id: "approval-two" },
				input: { content: "# Two", name: "Two" },
				state: "approval-requested" as const,
				toolCallId: "create-two",
				type: "tool-createLibraryDocument" as const,
			},
		];

		chatSession.messages = [{ id: "assistant-message", parts, role: "assistant" }];

		render(<ChatMessageParts isStreaming={false} isUser={false} messageId='assistant-message' parts={parts} />);

		expect(screen.getByRole("button", { name: "approveAll" })).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "denyAll" }));
		expect(addToolApprovalResponse).toHaveBeenCalledWith({ approved: false, id: "approval-one" });
		expect(addToolApprovalResponse).toHaveBeenCalledWith({ approved: false, id: "approval-two" });
	});
});

describe("ChatMessage", () => {
	it("does not reserve a copy action row after answered questions", () => {
		const answeredMessage: BaseChatUIMessage = {
			id: "answered-message",
			parts: [
				{ text: "Which business do you mean?", type: "text" },
				{
					input: { questions: [{ id: "business", title: "Which business do you mean?" }] },
					output: {
						answers: [
							{
								question: "Which business do you mean?",
								questionId: "business",
								selectedOptions: ["Durable"],
							},
						],
					},
					state: "output-available",
					toolCallId: "ask-user-questions",
					type: "tool-askUserQuestions",
				},
			],
			role: "assistant",
		};

		const { rerender } = render(<ChatMessage message={answeredMessage} />);

		expect(screen.queryByRole("button", { name: "copyToClipboard" })).not.toBeInTheDocument();

		rerender(
			<ChatMessage
				message={{
					id: "ordinary-message",
					parts: [{ text: "An ordinary answer.", type: "text" }],
					role: "assistant",
				}}
			/>
		);

		expect(screen.getByRole("button", { name: "copyToClipboard" })).toBeInTheDocument();
	});
});

describe("OpenUIBlock", () => {
	it("runs local state actions without another model turn", async () => {
		const user = userEvent.setup();

		render(
			<OpenUIBlock
				code={`root = Card([metric, update])
$revenue = "$10k"
metric = Metric("Revenue", $revenue, "", "neutral")
update = Button("Show forecast", Action([@Set($revenue, "$12k")]))`}
				complete
				isStreaming={false}
			/>
		);

		await user.click(screen.getByRole("button", { name: "Show forecast" }));
		expect(screen.getByText("$12k")).toBeInTheDocument();
		expect(sendMessage).not.toHaveBeenCalled();
	});

	it("continues the conversation from an OpenUI action", async () => {
		const user = userEvent.setup();

		render(
			<OpenUIBlock
				code={`root = Card([explain])
explain = Button("Explain", Action([@ToAssistant("Explain this metric")]), "secondary")`}
				complete
				isStreaming={false}
			/>
		);

		await user.click(screen.getByRole("button", { name: "Explain (Explain this metric)" }));
		expect(sendMessage).toHaveBeenCalledWith({ text: "Explain this metric" });
	});

	it("discloses and confirms an external URL before opening it", async () => {
		const user = userEvent.setup();
		const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
		const open = vi.spyOn(window, "open").mockImplementation(() => null);

		render(
			<OpenUIBlock
				code={`root = Card([billing])
billing = Button("Open billing", Action([@OpenUrl("https://attacker.example/phish")]))`}
				complete
				isStreaming={false}
			/>
		);

		const button = screen.getByRole("button", { name: "Open billing (attacker.example)" });
		await user.click(button);
		expect(confirm).toHaveBeenCalledWith("openuiConfirmExternal");
		expect(open).not.toHaveBeenCalled();

		confirm.mockReturnValue(true);
		await user.click(button);
		expect(open).toHaveBeenCalledWith("https://attacker.example/phish", "_blank", "noopener,noreferrer");
	});

	it("keeps local Set actions inside a Select domain", async () => {
		const user = userEvent.setup();

		render(
			<OpenUIBlock
				code={`$choice = "a"
root = Card([select, change])
a = SelectItem("a", "A")
b = SelectItem("b", "B")
select = Select("choice", [a, b], $choice, "Pick")
change = Button("Change", Action([@Set($choice, "b")]))`}
				complete
				isStreaming={false}
			/>
		);

		await user.click(screen.getByRole("button", { name: "Change" }));
		expect(screen.getByText("B")).toBeVisible();
		expect(sendMessage).not.toHaveBeenCalled();
	});

	it("latches an assistant action before busy state rerenders", () => {
		sendMessage.mockImplementation(() => new Promise(() => undefined));
		render(
			<OpenUIBlock
				code={`root = Card([explain])
explain = Button("Explain", Action([@ToAssistant("Explain this metric")]), "secondary")`}
				complete
				isStreaming={false}
			/>
		);

		const button = screen.getByRole("button", { name: "Explain (Explain this metric)" });
		fireEvent.click(button);
		fireEvent.click(button);
		expect(sendMessage).toHaveBeenCalledTimes(1);
	});

	it.each([
		'AreaChart(["A", "B"], [Series("Visitors", [10, 20])])',
		'ComposedChart(["A", "B"], [Series("Visitors", [10, 20])])',
		'RadarChart(["A", "B"], [Series("Visitors", [10, 20])])',
		'PieChart(["A", "B"], [10, 20], "donut")',
		'RadialChart(["A", "B"], [10, 20])',
	])("renders Spectrum charts through the OpenUI renderer: %s", async (chart) => {
		render(<OpenUIBlock code={`root = Card([${chart}])`} complete isStreaming={false} />);
		await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument(), { timeout: 5000 });
		expect(screen.getByRole("table").textContent).toContain("20");
	});
	it("renders a zero-value funnel stage without dropping supplied data", async () => {
		render(
			<OpenUIBlock
				code={`root = Card([chart])
chart = FunnelChart(["Visitors", "Paying"], [10, 0])`}
				complete
				isStreaming={false}
			/>
		);

		await waitFor(() => expect(screen.getByText("Paying")).toBeVisible());
		expect(screen.getByText("0")).toBeVisible();
	});

	it("keeps chart categories collision-proof and locale-independent", async () => {
		render(
			<OpenUIBlock
				code={`root = Card([line, bar])
date = Series("date", [10])
name = Series("name", [12])
latin = Series("I", [9])
dotless = Series("ı", [8])
line = LineChart(["2025-02-30"], [date, latin, dotless])
bar = BarChart(["Jan"], [name])`}
				complete
				isStreaming={false}
			/>
		);

		await waitFor(() => expect(screen.getByRole("rowheader", { name: "2025-02-30" })).toBeInTheDocument());
		expect(screen.getByRole("rowheader", { name: "Jan" })).toBeInTheDocument();

		for (const name of ["date", "I", "ı", "name"]) {
			expect(screen.getByRole("columnheader", { name })).toBeInTheDocument();
		}
	});

	it("shows a fallback when an assistant action cannot be submitted", async () => {
		const user = userEvent.setup();
		sendMessage.mockRejectedValueOnce(new Error("transport failed"));

		render(
			<OpenUIBlock
				code={`root = Card([explain])
explain = Button("Explain", Action([@ToAssistant("Explain this metric")]), "secondary")`}
				complete
				isStreaming={false}
			/>
		);

		await user.click(screen.getByRole("button", { name: "Explain (Explain this metric)" }));
		await waitFor(() => expect(screen.getByText("openuiError")).toBeVisible());
	});

	it("keeps controls disabled until the full assistant turn settles", async () => {
		const user = userEvent.setup();

		const parts = [
			{
				text: `\`\`\`openui-lang
root = Card([explain])
explain = Button("Explain")
\`\`\``,
				type: "text" as const,
			},
		];

		chatSession.busy = true;

		const { rerender } = render(
			<ChatMessageParts isStreaming={false} isUser={false} messageId='streaming-openui' parts={parts} />
		);

		expect(screen.getByRole("button", { name: "Explain" })).toBeDisabled();
		await user.click(screen.getByRole("button", { name: "Explain" }));
		expect(sendMessage).not.toHaveBeenCalled();

		chatSession.busy = false;
		rerender(<ChatMessageParts isStreaming={false} isUser={false} messageId='streaming-openui' parts={parts} />);
		expect(screen.getByRole("button", { name: "Explain" })).toBeEnabled();
	});

	it("fails closed when a settled OpenUI fence is incomplete", () => {
		render(
			<ChatMessageParts
				isStreaming={false}
				isUser={false}
				messageId='incomplete-openui'
				parts={[
					{
						text: `\`\`\`openui-lang
root = Card([explain])
explain = Button("Explain", Action([@ToAssistant("Explain this metric")]))`,
						type: "text",
					},
				]}
			/>
		);

		expect(screen.getByText("openuiError")).toBeVisible();
		expect(screen.queryByRole("button", { name: "Explain" })).not.toBeInTheDocument();
		expect(sendMessage).not.toHaveBeenCalled();
	});

	it("shows a fallback for a settled empty OpenUI fence", () => {
		render(
			<ChatMessageParts
				isStreaming={false}
				isUser={false}
				messageId='empty-openui'
				parts={[{ text: "```openui-lang\n```", type: "text" }]}
			/>
		);

		expect(screen.getByText("openuiError")).toBeVisible();
	});

	it("fails closed instead of exposing actions from a partially invalid program", async () => {
		render(
			<OpenUIBlock
				code={`root = Card([explain, invalid])
explain = Button("Explain", Action([@ToAssistant("Explain this metric")]))
invalid = UnsupportedWidget("nope")`}
				complete
				isStreaming={false}
			/>
		);

		await waitFor(() => expect(screen.getByText("openuiError")).toBeVisible());
		expect(screen.queryByRole("button", { name: "Explain" })).not.toBeInTheDocument();
		expect(sendMessage).not.toHaveBeenCalled();
	});

	it("shows a settled fallback for an invalid component program", async () => {
		render(<OpenUIBlock code='root = UnsupportedWidget("nope")' complete isStreaming={false} />);

		await waitFor(() => expect(screen.getByText("openuiError")).toBeVisible());
	});

	it.each(invalidOpenUIPrograms)("fails closed for %s", async (_description, code) => {
		render(<OpenUIBlock code={code} complete isStreaming={false} />);

		await waitFor(() => expect(screen.getByText("openuiError")).toBeVisible());
		expect(screen.queryByRole("button")).not.toBeInTheDocument();
	});
});

vi.mock("@/hooks/use-organization-permissions", () => ({
	useOrganizationPermissions: () => mockOrganizationPermissions(),
}));
