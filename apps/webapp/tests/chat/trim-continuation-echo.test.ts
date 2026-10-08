import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import type { DashboardChatUIMessage as BaseChatUIMessage } from "@starter/server";

import { shouldSendChatContinuation } from "../../src/components/chat/stores/should-send-chat-continuation";
import { trimContinuationEcho } from "../../src/components/chat/stores/trim-continuation-echo";

const toolPart: Extract<BaseChatUIMessage["parts"][number], { type: "tool-askUserQuestions" }> = {
	input: { questions: [{ id: "q1", title: "Which one?" }] },
	output: { answers: [{ question: "Which one?", questionId: "q1", selectedOptions: ["A"] }] },
	state: "output-available",
	toolCallId: "call_1",
	type: "tool-askUserQuestions",
};

const userMessage: BaseChatUIMessage = {
	id: "user-1",
	parts: [{ text: "How can I improve my business", type: "text" }],
	role: "user",
};

const originalAssistant: BaseChatUIMessage = {
	id: "assistant-1",
	parts: [{ type: "step-start" }, { state: "done", text: "Let me ask a question.", type: "text" }, toolPart],
	role: "assistant",
};

describe("trimContinuationEcho", () => {
	it("merges a continuation into the persisted assistant message", () => {
		const continuation: BaseChatUIMessage = {
			id: "assistant-2",
			parts: [...originalAssistant.parts, { state: "done", text: "Great, here is the plan.", type: "text" }],
			role: "assistant",
		};

		const result = trimContinuationEcho([userMessage, originalAssistant, continuation]);

		expect(result).toHaveLength(2);
		expect(result[1]).toEqual({ ...continuation, id: originalAssistant.id });
	});

	it("drops a pure echo that has not streamed any new parts yet", () => {
		const pureEcho: BaseChatUIMessage = {
			id: "assistant-2",
			parts: [...originalAssistant.parts],
			role: "assistant",
		};

		const result = trimContinuationEcho([userMessage, originalAssistant, pureEcho]);

		expect(result).toHaveLength(2);
		expect(result[1]).toBe(originalAssistant);
	});

	it("keeps the persisted id through chained continuations", () => {
		const firstContinuation: BaseChatUIMessage = {
			id: "assistant-2",
			parts: [...originalAssistant.parts, { state: "done", text: "First continuation.", type: "text" }],
			role: "assistant",
		};

		const firstResult = trimContinuationEcho([userMessage, originalAssistant, firstContinuation]);
		const mergedAssistant = firstResult.at(-1)!;

		const secondContinuation: BaseChatUIMessage = {
			id: "assistant-3",
			parts: [...mergedAssistant.parts, { state: "done", text: "Second continuation.", type: "text" }],
			role: "assistant",
		};

		const secondResult = trimContinuationEcho([...firstResult, secondContinuation]);

		expect(secondResult).toHaveLength(2);
		expect(secondResult.at(-1)?.id).toBe(originalAssistant.id);
		expect(secondResult.at(-1)?.parts).toEqual(secondContinuation.parts);
	});

	it("replaces an approved turn whose local copy diverged from the resumed server message", () => {
		const inspectPart: BaseChatUIMessage["parts"][number] = {
			input: { scope: "page" },
			output: { scope: "page" },
			state: "output-available",
			toolCallId: "inspect-call",
			toolName: "getLibraryAsset",
			type: "dynamic-tool",
		};

		const pendingCompose: BaseChatUIMessage["parts"][number] = {
			approval: { approved: true, id: "run::compose-call" },
			input: {},
			state: "approval-responded",
			toolCallId: "compose-call",
			toolName: "editLibraryDocument",
			type: "dynamic-tool",
		};

		const staleRetry: BaseChatUIMessage["parts"][number] = {
			input: {},
			state: "input-available",
			toolCallId: "retried-call",
			toolName: "editLibraryDocument",
			type: "dynamic-tool",
		};

		const local: BaseChatUIMessage = {
			id: "assistant-1",
			parts: [inspectPart, staleRetry, pendingCompose],
			role: "assistant",
		};

		const resumed: BaseChatUIMessage = {
			id: "assistant-2",
			parts: [
				inspectPart,
				{
					input: {},
					output: { added: true },
					state: "output-available",
					toolCallId: "compose-call",
					toolName: "editLibraryDocument",
					type: "dynamic-tool",
				},
				{ state: "done", text: "Added the calculator.", type: "text" },
			],
			role: "assistant",
		};

		const result = trimContinuationEcho([userMessage, local, resumed]);

		expect(result).toHaveLength(2);
		expect(result[1]).toEqual({ ...resumed, id: local.id });
	});

	it("leaves consecutive assistant messages without an echoed prefix untouched", () => {
		const unrelated: BaseChatUIMessage = {
			id: "assistant-2",
			parts: [
				{ state: "done", text: "Different opening.", type: "text" },
				{ state: "done", text: "More content.", type: "text" },
				{ state: "done", text: "Even more.", type: "text" },
				{ state: "done", text: "And more.", type: "text" },
			],
			role: "assistant",
		};

		const messages = [userMessage, originalAssistant, unrelated];

		expect(trimContinuationEcho(messages)).toBe(messages);
	});

	it("ignores conversations that do not end in two assistant messages", () => {
		const messages = [userMessage, originalAssistant];

		expect(trimContinuationEcho(messages)).toBe(messages);
	});
});

describe("shouldSendChatContinuation", () => {
	it("continues after a client-side question is answered", () => {
		expect(shouldSendChatContinuation({ messages: [originalAssistant] })).toBe(true);
	});

	it("does not replay a completed server-side tool", () => {
		const message: UIMessage = {
			id: "assistant-brand",
			parts: [
				{ type: "step-start" },
				{
					input: {},
					output: { success: true },
					state: "output-available",
					toolCallId: "brand-call",
					toolName: "updateBrand",
					type: "dynamic-tool",
				},
			],
			role: "assistant",
		};

		expect(shouldSendChatContinuation({ messages: [message] })).toBe(false);
	});
});
