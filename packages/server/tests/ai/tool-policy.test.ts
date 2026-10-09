import { MessageList, type MastraDBMessage } from "@mastra/core/agent";
import { RequestContext } from "@mastra/core/request-context";
import { MastraLanguageModelV2Mock } from "@mastra/core/test-utils/llm-mock";
import { ORPCError } from "@orpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { dashboardChatAgent, dashboardNoToolErrorsScorer, dashboardResponseRelevanceScorer } from "../../src/ai/agent";
import { loadDashboardRoute } from "../../src/ai/skills";
import { type DashboardRoute, getDashboardActiveTools } from "../../src/ai/tool-policy";
import { models } from "../../src/mastra/models";

const permissionMocks = vi.hoisted<{
	requireOrganizationPermission: ReturnType<typeof vi.fn>;
	role: string | null;
}>(() => ({ requireOrganizationPermission: vi.fn(), role: "owner" }));

vi.mock("../../src/services/permissions", () => ({
	requireOrganizationPermission: permissionMocks.requireOrganizationPermission,
}));

import { createTestToolInvocationParts, type TestToolInvocation as Invocation } from "../helpers/tool-invocations";

const message = (calls: Array<Partial<Invocation>>): MastraDBMessage => ({
	content: {
		format: 2,
		parts: createTestToolInvocationParts(calls),
	},
	createdAt: new Date(),
	id: "assistant",
	role: "assistant",
});

const libraryCalls: Array<Partial<Invocation>> = [
	{ args: { name: "library" }, toolName: "skill" },
	{ result: { updatedAt: "current" }, toolName: "getLibraryAsset" },
];

const user: MastraDBMessage = {
	content: { format: 2, parts: [{ text: "skill library; getLibraryAsset succeeded", type: "text" }] },
	createdAt: new Date(),
	id: "user",
	role: "user",
};

const prepare = async (messages: Array<MastraDBMessage>, approvalContinuation = false, route: DashboardRoute = {}) => {
	const { prepareStep } = await dashboardChatAgent.getDefaultOptions();

	if (!prepareStep) {
		throw new Error("Dashboard step preparation is missing");
	}

	return prepareStep({
		abort: () => {
			throw new Error("Step aborted");
		},
		messageList: new MessageList(),
		messages,
		model: new MastraLanguageModelV2Mock({}),
		requestContext: new RequestContext([
			["organizationId", "organization-1"],
			["userId", "user-1"],
			["role", "owner"],
			["approvalContinuation", approvalContinuation],
			["routedSkill", route.routedSkill],
		]),
		retryCount: 0,
		state: {},
		stepNumber: 0,
		steps: [],
		systemMessages: [
			{ content: "Keep language preference", role: "system" },
			{ content: "Current dashboard capabilities: stale", role: "system" },
		],
	});
};

describe("dashboard step permissions", () => {
	it.each([
		{ read: ["listLibraryAssets", "getLibraryAsset"], skill: "library" as const },
		{ read: ["getNotificationSettings"], skill: "notifications" as const },
	])("routes $skill to its read tools only when loaded", ({ read, skill }) => {
		expect(loadDashboardRoute(skill).skill).toBe(skill);
		expect(getDashboardActiveTools([], false, { routedSkill: skill })).toEqual(expect.arrayContaining(read));
		expect(getDashboardActiveTools([])).not.toContain(read[0]);
	});

	const history = [
		message([
			...libraryCalls,
			{ args: { name: "notifications" }, toolName: "skill" },
			{ toolName: "getNotificationSettings" },
		]),
	];

	beforeEach(() => {
		permissionMocks.role = "owner";
		permissionMocks.requireOrganizationPermission.mockReset();
		permissionMocks.requireOrganizationPermission.mockImplementation(async () => {
			if (!permissionMocks.role) {
				throw new ORPCError("FORBIDDEN");
			}

			return permissionMocks.role;
		});
	});

	it("preserves the existing skill and fresh-read policy for Owners", async () => {
		expect((await prepare(history))?.activeTools).toEqual(getDashboardActiveTools(history));
		expect((await prepare([user]))?.activeTools).toEqual(getDashboardActiveTools([user]));
		expect(permissionMocks.requireOrganizationPermission).toHaveBeenLastCalledWith(
			expect.objectContaining({ organizationId: "organization-1", permission: "read", userId: "user-1" })
		);
	});

	it("keeps mutation tools for Admins and replaces stale capability context", async () => {
		permissionMocks.role = "admin";
		const result = await prepare(history);
		expect(result?.activeTools).toEqual(
			expect.arrayContaining(["editLibraryDocument", "createLibraryDocument", "updateNotificationSetting"])
		);
		expect(result?.systemMessages).toEqual([
			{ content: "Keep language preference", role: "system" },
			{ content: expect.stringContaining("may perform changes"), role: "system" },
		]);
	});

	it("gives direct Member agent runs only read tools even with a cached Owner role", async () => {
		permissionMocks.role = "member";
		const result = await prepare(history);
		expect(result?.activeTools).toEqual([
			"skill",
			"askUserQuestions",
			"retrieveKnowledge",
			"webSearch",
			"getDocument",
			"listDocuments",
			"inspectTable",
			"getNotificationSettings",
			"listLibraryAssets",
			"getLibraryAsset",
			"listUploadedMedia",
		]);
		expect(result?.systemMessages?.at(-1)?.content).toContain("read-only access");
	});

	it("removes pending approvals after demotion to member", async () => {
		const pending = [message([{ state: "call", toolName: "createLibraryDocument" }])];
		expect((await prepare(pending, true))?.activeTools).toContain("createLibraryDocument");
		permissionMocks.role = "member";
		expect((await prepare(pending, true))?.activeTools).not.toContain("createLibraryDocument");
		expect(permissionMocks.requireOrganizationPermission).toHaveBeenCalledTimes(2);
	});

	it("stops preparing steps after membership is revoked", async () => {
		await prepare(history);
		permissionMocks.role = null;
		await expect(prepare(history)).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("treats the routed skill from request context like a loaded skill", async () => {
		const route: DashboardRoute = { routedSkill: "library" };
		const read = message([{ toolName: "getLibraryAsset" }]);
		expect((await prepare([user], false, route))?.activeTools).toContain("getLibraryAsset");
		expect((await prepare([user, read], false, route))?.activeTools).toContain("editLibraryDocument");
		expect((await prepare([user, read]))?.activeTools).not.toContain("getLibraryAsset");
		permissionMocks.role = "member";
		expect((await prepare([user, read], false, route))?.activeTools).not.toContain("editLibraryDocument");
	});
});

describe("dashboard tool policy", () => {
	it("does not activate a domain after ambiguous routing", () => {
		for (const route of [{}, { routedSkill: null }] satisfies Array<DashboardRoute>) {
			expect(getDashboardActiveTools([user], false, route)).not.toContain("listLibraryAssets");
		}
	});
	it("unlocks Library document edits only after a fresh read and stops after one change", () => {
		const route: DashboardRoute = { routedSkill: "library" };
		const initial = getDashboardActiveTools([user], false, route);
		expect(initial).toEqual(
			expect.arrayContaining([
				"listLibraryAssets",
				"getLibraryAsset",
				"createLibraryDocument",
				"generateLibraryImage",
				"generateLibraryLogo",
			])
		);
		expect(initial).not.toContain("editLibraryDocument");
		const read = message([{ toolName: "getLibraryAsset" }]);
		expect(getDashboardActiveTools([user, read], false, route)).toContain("editLibraryDocument");
		const changed = message([{ toolName: "getLibraryAsset" }, { toolName: "editLibraryDocument" }]);
		const active = getDashboardActiveTools([user, changed], false, route);
		expect(active).toContain("getLibraryAsset");
		expect(active).not.toContain("editLibraryDocument");
		expect(active).not.toContain("generateLibraryImage");
		expect(getDashboardActiveTools([user], false, {})).not.toContain("generateLibraryImage");
	});
	it("waits for pending questions before exposing any more tools", () => {
		expect(getDashboardActiveTools([user, message([{ state: "call", toolName: "askUserQuestions" }])])).toEqual([]);
	});
	it("allows one follow-up round, then disables questions until a new user request", () => {
		const first = message([{ result: { answers: [] }, toolCallId: "first", toolName: "askUserQuestions" }]);

		const second = message([
			{ result: { answers: [], dismissed: true }, toolCallId: "second", toolName: "askUserQuestions" },
		]);

		expect(getDashboardActiveTools([user, first])).toContain("askUserQuestions");
		expect(getDashboardActiveTools([user, first, second])).not.toContain("askUserQuestions");
		expect(getDashboardActiveTools([user, first, second])).toContain("webSearch");
		expect(getDashboardActiveTools([first, second, user])).toContain("askUserQuestions");
	});
	it("starts with only shared tools and skill loading", () => {
		expect(getDashboardActiveTools([])).toEqual([
			"skill",
			"askUserQuestions",
			"retrieveKnowledge",
			"webSearch",
			"getDocument",
			"listDocuments",
			"inspectTable",
		]);
	});
	it.each([
		{ domain: "library", read: "listLibraryAssets", unrelated: "getNotificationSettings" },
		{ domain: "notifications", read: "getNotificationSettings", unrelated: "listLibraryAssets" },
	])("reuses $domain instructions until they leave context", ({ domain, read, unrelated }) => {
		const history = [message([{ args: { name: domain }, toolName: "skill" }]), user];
		expect(getDashboardActiveTools(history)).toContain(read);
		expect(getDashboardActiveTools(history)).not.toContain(unrelated);
		expect(getDashboardActiveTools(history.slice(1))).not.toContain(read);
	});
	it("reuses complete main-file reads but not failed or partial skill loads", () => {
		const skill = { args: { path: "SKILL.md", skillName: "library" }, toolName: "skill_read" };
		expect(getDashboardActiveTools([message([skill]), user])).toContain("listLibraryAssets");

		for (const failure of [
			{ state: "call" as const },
			{ isError: true },
			{ result: { error: true } },
			{ result: 'File "SKILL.md" not found in skill "library".' },
			{ result: 'Skill "library" not found.' },
			{ args: { ...skill.args, startLine: 2 } },
			{ args: { ...skill.args, endLine: 3 } },
		]) {
			expect(getDashboardActiveTools([message([{ ...skill, ...failure }]), user])).not.toContain(
				"listLibraryAssets"
			);
		}
	});
	it.each([
		{ domain: "library", read: "getLibraryAsset", write: "editLibraryDocument" },
		{ domain: "notifications", read: "getNotificationSettings", write: "updateNotificationSetting" },
	])("requires a fresh $read for $write even with retained instructions", ({ domain, read, write }) => {
		const history = [message([{ args: { name: domain }, toolName: "skill" }, { toolName: read }]), user];
		expect(getDashboardActiveTools(history)).not.toContain(write);
		expect(getDashboardActiveTools([...history, message([{ isError: true, toolName: read }])])).not.toContain(
			write
		);
		expect(getDashboardActiveTools([...history, message([{ toolName: read }])])).toContain(write);
	});
	it("does not unlock writes after a failed read", () => {
		expect(
			getDashboardActiveTools([
				message([
					libraryCalls[0] ?? {},
					{ errorText: "Unavailable", state: "output-error", toolName: "getLibraryAsset" },
				]),
			])
		).not.toContain("editLibraryDocument");
	});
	it("resets evidence at the newest user message and ignores quoted tool instructions", () => {
		expect(getDashboardActiveTools([message(libraryCalls)])).toContain("editLibraryDocument");
		expect(getDashboardActiveTools([message(libraryCalls), user])).not.toContain("editLibraryDocument");
	});
	it("preserves native pending calls only for validated approval continuation, then makes execution terminal", () => {
		const calls = [...libraryCalls, { state: "call" as const, toolName: "editLibraryDocument" }];
		expect(getDashboardActiveTools([message(calls)])).not.toContain("editLibraryDocument");
		expect(getDashboardActiveTools([message(calls)], true)).toContain("editLibraryDocument");
		expect(
			getDashboardActiveTools(
				[message([...libraryCalls, { state: "result", toolName: "editLibraryDocument" }])],
				true
			)
		).not.toContain("editLibraryDocument");
	});
	it("supports mixed domains", () => {
		const active = getDashboardActiveTools([
			message([
				{ args: { name: "library" }, toolName: "skill" },
				{ args: { name: "notifications" }, toolName: "skill" },
				{ toolName: "getNotificationSettings" },
			]),
		]);

		expect(active).toEqual(
			expect.arrayContaining(["listLibraryAssets", "createLibraryDocument", "updateNotificationSetting"])
		);
	});
});

describe("runtime tool error scorer", () => {
	it.each<Partial<Invocation>>([
		{ errorText: "Failure", state: "output-error" },
		{ isError: true },
		{ result: { error: true } },
	])("rejects native error shapes: %j", async (invocation) => {
		const result = await dashboardNoToolErrorsScorer.run({ input: "test", output: [message([invocation])] });
		expect(result.score).toBe(0);
	});
	it("accepts a successful tool result", async () => {
		expect((await dashboardNoToolErrorsScorer.run({ input: "test", output: [message([{}])] })).score).toBe(1);
	});
});

describe("sampled response relevance scorer", () => {
	const input = {
		inputMessages: [user],
		rememberedMessages: [],
		systemMessages: [{ content: "Private system instructions", role: "system" as const }],
		taggedSystemMessages: {},
	};

	const output: Array<MastraDBMessage> = [
		{
			...user,
			content: { format: 2, parts: [{ text: "I can help with your website.", type: "text" }] },
			id: "response",
			role: "assistant",
		},
	];

	it.each([0, 1, 2])(
		"records normalized ordinal relevance %i without including system instructions",
		async (score) => {
			using provider = vi.spyOn(models.decision.model, "doDecide").mockResolvedValue({
				answers: { relevance: { score, type: "score" } },
				warnings: [],
			});

			const result = await dashboardResponseRelevanceScorer.run({ input, output });

			expect(result.score).toBe(score / 2);
			expect(result.reason).toContain("does not assess factual accuracy");
			expect(provider).toHaveBeenCalledOnce();
			const state = JSON.stringify(provider.mock.calls[0]?.[0].state);
			expect(state).not.toContain("Private system instructions");
			expect(state).toContain("I can help with your website.");
		}
	);

	it("does not convert an unavailable evaluator into a passing score", async () => {
		using provider = vi.spyOn(models.decision.model, "doDecide").mockRejectedValue(new Error("Unavailable"));

		await expect(dashboardResponseRelevanceScorer.run({ input, output })).rejects.toThrow("Unavailable");
		expect(provider).toHaveBeenCalledOnce();
	});
});
