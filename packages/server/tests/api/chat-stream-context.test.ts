import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/ai/decisions", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/ai/decisions")>()),
	evaluateDecision: vi.fn(),
}));

import { dashboardSkills } from "../../src/ai/skills";
import type { DashboardChatUIMessage } from "../../src/ai/types";
import {
	describeSafeStreamError,
	hasPendingAssistantRequest,
	loadChatTurnContext,
	resolveDashboardRoute,
} from "../../src/api/chat-stream-context";

type Decision = NonNullable<Parameters<typeof resolveDashboardRoute>[0]["decision"]>;

const decision = (answers: Partial<Decision["answers"]> = {}): Decision => ({
	answers: {
		needsKnowledge: { probability: 0.2, type: "boolean" },
		route: { choice: "none", type: "choice" },
		tier: { choice: "full", type: "choice" },
		...answers,
	},
});

const resolve = (input: Partial<Parameters<typeof resolveDashboardRoute>[0]> = {}) =>
	resolveDashboardRoute({ decision: null, editorBound: false, hasImageAttachment: false, ...input });

const userMessage: DashboardChatUIMessage = { id: "user", parts: [{ text: "Hello", type: "text" }], role: "user" };

describe("pre-turn dashboard routing", () => {
	it("keeps today's behaviour when the decision is unavailable", () => {
		const route = resolve();
		expect(route).toEqual({
			instructions: null,
			modelTier: "full",
			needsKnowledge: false,
			routedSkill: null,
		});
		expect(loadChatTurnContext({ route, uiMessages: [userMessage] })).toBe("");
	});
	it("appends routed skill instructions once", () => {
		const library = dashboardSkills.find(({ name }) => name === "library");
		const route = resolve({ decision: decision({ route: { choice: "library", type: "choice" } }) });
		expect(route).toMatchObject({ routedSkill: "library" });
		expect(route.instructions).toContain("Routed domain instructions for this turn are already loaded");
		expect(route.instructions).toContain(library?.instructions);
		const context = loadChatTurnContext({ route, uiMessages: [userMessage] });
		expect(context.match(/Routed domain instructions/gu)).toHaveLength(1);
		expect(context).not.toContain("retrieveKnowledge before answering");
	});
	it("adds nothing for the none route", () => {
		expect(resolve({ decision: decision({ route: { choice: "none", type: "choice" } }) })).toMatchObject({
			instructions: null,
			routedSkill: null,
		});
	});
	it("downgrades only simple requests without editor bindings or images", () => {
		const simple = decision({ tier: { choice: "simple", type: "choice" } });
		expect(resolve({ decision: simple }).modelTier).toBe("simple");
		expect(resolve({ decision: simple, editorBound: true }).modelTier).toBe("full");
		expect(resolve({ decision: simple, hasImageAttachment: true }).modelTier).toBe("full");
		expect(resolve({ decision: decision() }).modelTier).toBe("full");
	});
	it("hints at indexed knowledge from the threshold only when no documents are attached", () => {
		expect(
			resolve({ decision: decision({ needsKnowledge: { probability: 0.69, type: "boolean" } }) })
		).toMatchObject({ needsKnowledge: false });
		const route = resolve({ decision: decision({ needsKnowledge: { probability: 0.7, type: "boolean" } }) });
		expect(route.needsKnowledge).toBe(true);
		expect(loadChatTurnContext({ route, uiMessages: [userMessage] })).toContain("retrieveKnowledge");

		const attached = loadChatTurnContext({
			route,
			uiMessages: [
				{
					...userMessage,
					parts: [
						{
							data: {
								fileId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d330",
								filename: "brief.pdf",
								mediaType: "application/pdf",
							},
							type: "data-attachment",
						},
					],
				},
			],
		});

		expect(attached).toContain("attached indexed document IDs");
		expect(attached).not.toContain("likely depends on the organization's indexed documents");
	});
});

describe("chat turn guards", () => {
	it("exposes expected tool input failures without leaking arbitrary errors", () => {
		const inputError = new Error("Invalid tool input");
		inputError.name = "AI_InvalidToolInputError";

		expect(describeSafeStreamError(new Error("wrapped", { cause: inputError }))).toBe("Invalid tool input");
		expect(describeSafeStreamError(new Error("private database failure"))).toBe("An error occurred.");
	});

	it("detects unresolved approval and question requests", () => {
		const approval: DashboardChatUIMessage["parts"][number] = {
			approval: { id: "run-1::tool-call" },
			input: {
				assetId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d330",
				edits: [],
				updatedAt: "2026-08-22T12:00:00.000Z",
			},
			state: "approval-requested",
			toolCallId: "tool-call",
			type: "tool-editLibraryDocument",
		};

		const question: DashboardChatUIMessage["parts"][number] = {
			input: { questions: [{ id: "tone", options: [{ id: "warm", title: "Warm" }], title: "Which tone?" }] },
			state: "input-available",
			toolCallId: "question-call",
			type: "tool-askUserQuestions",
		};

		expect(hasPendingAssistantRequest({ id: "a", parts: [approval], role: "assistant" })).toBe(true);
		expect(hasPendingAssistantRequest({ id: "b", parts: [question], role: "assistant" })).toBe(true);
		expect(
			hasPendingAssistantRequest({ id: "c", parts: [{ text: "Done", type: "text" }], role: "assistant" })
		).toBe(false);
		expect(hasPendingAssistantRequest(undefined)).toBe(false);
	});
});
