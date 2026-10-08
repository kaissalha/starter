import { describe, expect, it } from "vitest";

import { chatGenUIPromptLibrary } from "@starter/genui/library";
import openuiChatSpec from "@starter/server/openui-chat.spec.json" with { type: "json" };

describe("chat GenUI library", () => {
	it("matches the generated spec the server prompt is built from", () => {
		expect(chatGenUIPromptLibrary.toSpec()).toEqual(openuiChatSpec);
	});
});
