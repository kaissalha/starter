import { describe, expect, it } from "vitest";

import { withoutTransientToolParts, type DashboardChatUIMessage } from "../../src/ai/types";

describe("continuation normalization", () => {
	it("matches streams without reasoning while preserving exact tool arguments", () => {
		const message: DashboardChatUIMessage = {
			id: "pending",
			parts: [
				{ state: "done", text: "Private model deliberation", type: "reasoning" },
				{ text: "Ready for review.", type: "text" },
				{
					approval: { id: "approval" },
					input: { content: "# Brief", name: "Brief" },
					state: "approval-requested",
					toolCallId: "create",
					type: "tool-createLibraryDocument",
				},
			],
			role: "assistant",
		};

		const streamed = { ...message, parts: message.parts.slice(1) };
		expect(withoutTransientToolParts([message])).toEqual(withoutTransientToolParts([streamed]));
		const changed = structuredClone(streamed);
		const tool = changed.parts[1];

		if (tool?.type !== "tool-createLibraryDocument" || tool.state !== "approval-requested") {
			throw new Error("Expected approval");
		}

		tool.input.name = "Other";
		expect(withoutTransientToolParts([changed])).not.toEqual(withoutTransientToolParts([message]));
	});
});
