import type { UIMessageChunk } from "ai";
import { describe, expect, it } from "vitest";

import { narrowMastraUIStream } from "../../src/api/chat-stream-narrow";

const collect = async (chunks: Array<UIMessageChunk>) => {
	const narrowed = narrowMastraUIStream(
		new ReadableStream({
			start: (controller) => {
				chunks.forEach((chunk) => controller.enqueue(chunk));
				controller.close();
			},
		})
	);

	const types = new Array<string>();

	for await (const chunk of narrowed) {
		types.push("toolCallId" in chunk ? `${chunk.type}:${chunk.toolCallId}` : chunk.type);
	}

	return types;
};

describe("narrowMastraUIStream", () => {
	it("passes read tools through immediately and drops data chunks", async () => {
		expect(
			await collect([
				{ data: { value: 1 }, type: "data-om-buffering" },
				{ toolCallId: "read", toolName: "inspectWebsite", type: "tool-input-start" },
				{ input: {}, toolCallId: "read", toolName: "inspectWebsite", type: "tool-input-available" },
				{ output: {}, toolCallId: "read", type: "tool-output-available" },
			])
		).toEqual(["tool-input-start:read", "tool-input-available:read", "tool-output-available:read"]);
	});

	it("drops a mutation tool call whose step ends without approval or output", async () => {
		expect(
			await collect([
				{ type: "start-step" },
				{ toolCallId: "stale", toolName: "composeWebsiteSection", type: "tool-input-start" },
				{ inputTextDelta: "{}", toolCallId: "stale", type: "tool-input-delta" },
				{ input: {}, toolCallId: "stale", toolName: "composeWebsiteSection", type: "tool-input-available" },
				{ type: "finish-step" },
				{ type: "start-step" },
				{ toolCallId: "live", toolName: "composeWebsiteSection", type: "tool-input-start" },
				{ input: {}, toolCallId: "live", toolName: "composeWebsiteSection", type: "tool-input-available" },
				{ approvalId: "run::live", toolCallId: "live", type: "tool-approval-request" },
			])
		).toEqual([
			"start-step",
			"finish-step",
			"start-step",
			"tool-input-start:live",
			"tool-input-available:live",
			"tool-approval-request:live",
		]);
	});

	it("keeps a pending question input", async () => {
		expect(
			await collect([
				{ type: "start-step" },
				{
					input: { questions: [] },
					toolCallId: "ask",
					toolName: "askUserQuestions",
					type: "tool-input-available",
				},
				{ type: "finish-step" },
			])
		).toEqual(["start-step", "tool-input-available:ask", "finish-step"]);
	});

	it("releases a held mutation when it executes without approval", async () => {
		expect(
			await collect([
				{ input: {}, toolCallId: "auto", toolName: "composeWebsiteSection", type: "tool-input-available" },
				{ output: {}, toolCallId: "auto", type: "tool-output-available" },
			])
		).toEqual(["tool-input-available:auto", "tool-output-available:auto"]);
	});
});
