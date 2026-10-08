import { describe, expect, it } from "vitest";

import {
	selectChatSessionAwaitingApproval,
	selectChatSessionBusy,
	type ChatSessionState,
} from "@/components/chat/stores/chat-session-store";

const stateWith = ({
	messages = [],
	status = "ready",
}: Partial<Pick<ChatSessionState, "messages" | "status">>): ChatSessionState => ({
	actions: undefined,
	error: undefined,
	messages,
	status,
});

describe("chat session state", () => {
	it("distinguishes manual approvals that replace the ordinary composer", () => {
		const approvalPart = {
			approval: { id: "approval-id" },
			input: {
				remove: ["section-root"],
				revision: "2026-08-22T12:00:00.000Z",
				section: "s0",
			},
			state: "approval-requested" as const,
			toolCallId: "edit-call",
			type: "tool-buildWebsite" as const,
		};

		const approvalMessage = {
			id: "approval-message",
			parts: [approvalPart],
			role: "assistant" as const,
		};

		expect(selectChatSessionAwaitingApproval(stateWith({ messages: [approvalMessage] }))).toBe(true);

		expect(
			selectChatSessionAwaitingApproval(
				stateWith({
					messages: [
						{
							...approvalMessage,
							parts: [{ ...approvalPart, approval: { id: "approval-id", isAutomatic: true } }],
						},
					],
				})
			)
		).toBe(false);
	});

	it("stays busy through streaming and pending client continuations", () => {
		expect(selectChatSessionBusy(stateWith({ status: "streaming" }))).toBe(true);

		expect(
			selectChatSessionBusy(
				stateWith({
					messages: [
						{
							id: "approval-message",
							parts: [
								{
									approval: { id: "approval-id" },
									input: {
										remove: ["section-root"],
										revision: "2026-08-22T12:00:00.000Z",
										section: "s0",
									},
									state: "approval-requested",
									toolCallId: "edit-call",
									type: "tool-buildWebsite",
								},
							],
							role: "assistant",
						},
					],
				})
			)
		).toBe(true);

		expect(
			selectChatSessionBusy(
				stateWith({
					messages: [
						{
							id: "question-message",
							parts: [
								{
									input: { questions: [{ freeText: true, id: "tone", title: "Which tone?" }] },
									state: "input-available",
									toolCallId: "question-call",
									type: "tool-askUserQuestions",
								},
							],
							role: "assistant",
						},
					],
				})
			)
		).toBe(true);
	});

	it("is ready when no response or work is pending", () => {
		expect(selectChatSessionBusy(stateWith({}))).toBe(false);
	});
});
