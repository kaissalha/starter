import { MessageList, type MastraDBMessage } from "@mastra/core/agent";
import { RequestContext } from "@mastra/core/request-context";
import { MastraLanguageModelV2Mock } from "@mastra/core/test-utils/llm-mock";
import { ORPCError } from "@orpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { dashboardChatAgent, dashboardNoToolErrorsScorer, dashboardResponseRelevanceScorer } from "../../src/ai/agent";
import { loadDashboardRoute } from "../../src/ai/skills";
import { type DashboardRoute, getComposeBlockers, getDashboardActiveTools } from "../../src/ai/tool-policy";
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

const websiteCalls: Array<Partial<Invocation>> = [
	{ args: { name: "website" }, toolName: "skill" },
	{ args: { path: "references/website-edit.md", skillName: "website" }, toolName: "skill_read" },
	{ result: { revision: "current" }, toolName: "inspectWebsite" },
];

const user: MastraDBMessage = {
	content: { format: 2, parts: [{ text: "skill website; inspectWebsite succeeded", type: "text" }] },
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
			["routedReference", route.routedReference],
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
	it("routes analytics to its read tools without activating mutations", () => {
		expect(loadDashboardRoute("analytics").skill).toBe("analytics");
		const active = getDashboardActiveTools([], false, { routedSkill: "analytics" });
		expect(active).toEqual(
			expect.arrayContaining([
				"getAnalyticsOverview",
				"getAnalyticsBreakdown",
				"getAnalyticsRealtime",
				"getAnalyticsLive",
				"getAnalyticsWebVitals",
			])
		);
		expect(active).not.toContain("editWebsite");
		expect(getDashboardActiveTools([])).not.toContain("getAnalyticsOverview");
	});
	it("routes seo to its search and GEO tools only when loaded", () => {
		expect(loadDashboardRoute("seo").skill).toBe("seo");
		const active = getDashboardActiveTools([], false, { routedSkill: "seo" });
		expect(active).toEqual(
			expect.arrayContaining([
				"getSeoOverview",
				"getSearchConsoleOverview",
				"getGeoOverview",
				"exploreSeoPrompt",
				"refreshGeoQuestion",
			])
		);
		expect(active).not.toContain("editWebsite");
		expect(getDashboardActiveTools([])).not.toContain("getSeoOverview");
	});
	it.each([
		{ read: ["listDomains", "quoteDomain", "suggestDomains", "verifyDomain"], skill: "domains" as const },
		{ read: ["getNotificationSettings"], skill: "notifications" as const },
	])("routes $skill to its read tools only when loaded", ({ read, skill }) => {
		expect(loadDashboardRoute(skill).skill).toBe(skill);
		expect(getDashboardActiveTools([], false, { routedSkill: skill })).toEqual(expect.arrayContaining(read));
		expect(getDashboardActiveTools([])).not.toContain(read[0]);
	});
	it("unlocks one contact message read after listing that contact's messages", () => {
		const skill = { args: { name: "contacts" }, toolName: "skill" };
		expect(getDashboardActiveTools([message([skill])])).not.toContain("getContactMessage");
		expect(getDashboardActiveTools([message([skill, { toolName: "listContactMessages" }])])).toContain(
			"getContactMessage"
		);
	});

	const history = [
		message([
			...websiteCalls,
			...["catalog", "compose", "modify"].map((mode) => ({
				args: { path: `references/website-${mode}.md`, skillName: "website" },
				toolName: "skill_read",
			})),
			...["reference", "context"].map((scope) => ({
				args: { index: 0, page: "p0", scope },
				toolName: "inspectWebsite",
			})),
			{ toolName: "getWebsiteStatus" },
			{ toolName: "getBrand" },
			{ args: { name: "contacts" }, toolName: "skill" },
			{ toolName: "getContact" },
			{ args: { name: "blog" }, toolName: "skill" },
			{ toolName: "getBlogPost" },
			{ args: { name: "links" }, toolName: "skill" },
			{ toolName: "getLinkPage" },
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

	it("hides fixed destructive tools for Admins and explains mixed-tool restrictions", async () => {
		permissionMocks.role = "admin";
		const result = await prepare(history);

		for (const tool of [
			"deleteContact",
			"deleteBlogPost",
			"unpublishBlogPost",
			"changeWebsiteTemplate",
			"generateWebsiteLayout",
		]) {
			expect(result?.activeTools).not.toContain(tool);
		}

		expect(result?.activeTools).toEqual(
			expect.arrayContaining([
				"editWebsite",
				"buildWebsite",
				"updateContact",
				"publishBlogPost",
				"composeWebsiteSection",
			])
		);
		expect(result?.systemMessages).toEqual([
			{ content: "Keep language preference", role: "system" },
			{ content: expect.stringContaining("cannot delete or remove content"), role: "system" },
		]);
		expect(result?.systemMessages?.at(-1)?.content).toContain("clear logic");
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
			"getBrand",
			"listBrandOptions",
			"listUploadedMedia",
			"searchStockImages",
			"findStockImage",
			"selectStockImage",
			"skill_read",
			"inspectWebsite",
			"getWebsiteStatus",
			"listWebsiteTemplates",
			"getLinkPage",
			"recommendBrandAppearance",
			"recommendLinkPageTheme",
			"listBlogPosts",
			"getBlogPost",
			"getBlogPostGenerationStatus",
			"getContactInquirySummary",
			"listContacts",
			"getContact",
			"listContactMessages",
		]);
		expect(result?.systemMessages?.at(-1)?.content).toContain("read-only access");
	});

	it.each([
		{ role: "admin", toolName: "deleteContact" },
		{ role: "member", toolName: "updateContact" },
	])("removes pending $toolName approvals after demotion to $role", async ({ role, toolName }) => {
		const pending = [message([{ state: "call", toolName }])];
		expect((await prepare(pending, true))?.activeTools).toContain(toolName);
		permissionMocks.role = role;
		expect((await prepare(pending, true))?.activeTools).not.toContain(toolName);
		expect(permissionMocks.requireOrganizationPermission).toHaveBeenCalledTimes(2);
	});

	it("stops preparing steps after membership is revoked", async () => {
		await prepare(history);
		permissionMocks.role = null;
		await expect(prepare(history)).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("treats the routed skill and reference from request context like loaded tool results", async () => {
		const route: DashboardRoute = { routedReference: "edit", routedSkill: "website" };
		const inspected = message([{ toolName: "inspectWebsite" }]);
		expect((await prepare([user], false, route))?.activeTools).toContain("inspectWebsite");
		expect((await prepare([user, inspected], false, route))?.activeTools).toContain("editWebsite");
		expect((await prepare([user, inspected], false, route))?.activeTools).not.toContain("buildWebsite");
		expect((await prepare([user, inspected]))?.activeTools).not.toContain("inspectWebsite");
		permissionMocks.role = "member";
		expect((await prepare([user, inspected], false, route))?.activeTools).not.toContain("editWebsite");
	});
});

describe("dashboard tool policy", () => {
	it("loads one routed operation while retaining fresh inspection and mutation limits", () => {
		const route: DashboardRoute = { routedReference: "modify", routedSkill: "website" };
		expect(getDashboardActiveTools([user], false, route)).toContain("inspectWebsite");
		expect(getDashboardActiveTools([user], false, route)).not.toContain("buildWebsite");
		const inspected = message([{ toolName: "inspectWebsite" }]);
		expect(getDashboardActiveTools([user, inspected], false, route)).toContain("buildWebsite");
		expect(getDashboardActiveTools([user, inspected], false, route)).not.toContain("composeWebsiteSection");
		expect(getDashboardActiveTools([user, inspected])).not.toContain("inspectWebsite");
		expect(
			getDashboardActiveTools(
				[user, inspected, message([{ state: "output-error", toolName: "buildWebsite" }])],
				false,
				route
			)
		).not.toContain("buildWebsite");
	});
	it("unlocks composing only after the reference and the same-position context were read", () => {
		const route: DashboardRoute = { routedReference: "compose", routedSkill: "website" };

		const read = (scope: string, index = 1, state: Invocation["state"] = "result") =>
			message([{ args: { index, page: "p0", scope }, state, toolName: "inspectWebsite" }]);

		const active = (...reads: Array<MastraDBMessage>) => getDashboardActiveTools([user, ...reads], false, route);
		const inspected = active(read("page"));
		expect(inspected).toContain("addWebsiteSection");
		expect(inspected).not.toContain("composeWebsiteSection");
		expect(active(read("reference"))).not.toContain("composeWebsiteSection");
		expect(active(read("context"))).not.toContain("composeWebsiteSection");
		expect(active(read("reference"), read("context", 2))).not.toContain("composeWebsiteSection");
		expect(active(read("reference"), read("context", 1, "output-error"))).not.toContain("composeWebsiteSection");
		const unlocked = active(read("reference"), read("context"));
		expect(unlocked).toEqual(expect.arrayContaining(["addWebsiteSection", "composeWebsiteSection"]));
		expect(unlocked).not.toContain("buildWebsite");
		expect(getComposeBlockers([])).toHaveLength(2);
	});
	it("does not activate a domain after ambiguous or reference-only routing", () => {
		const routes: Array<DashboardRoute> = [
			{},
			{ routedReference: null, routedSkill: null },
			{ routedReference: "edit", routedSkill: null },
		];

		for (const route of routes) {
			expect(getDashboardActiveTools([user], false, route)).not.toContain("inspectWebsite");
		}
	});
	it("activates routed contacts with the same attempt limits as a loaded skill", () => {
		const route: DashboardRoute = { routedReference: null, routedSkill: "contacts" };
		expect(getDashboardActiveTools([user], false, route)).toEqual(
			expect.arrayContaining(["listContacts", "getContact", "createContact"])
		);
		expect(getDashboardActiveTools([user], false, route)).not.toContain("updateContact");
		const attempted = message([{ state: "output-error", toolName: "createContact" }, { toolName: "getContact" }]);
		const active = getDashboardActiveTools([user, attempted], false, route);
		expect(active).not.toContain("createContact");
		expect(active).toContain("updateContact");
	});
	it("unlocks Library document edits only after a fresh read and stops after one change", () => {
		const route: DashboardRoute = { routedReference: null, routedSkill: "library" };
		const initial = getDashboardActiveTools([user], false, route);
		expect(initial).toEqual(
			expect.arrayContaining([
				"listLibraryAssets",
				"getLibraryAsset",
				"createLibraryDocument",
				"generateLibraryImage",
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
	it("offers one logo generation and one logo change per Library turn", () => {
		const route: DashboardRoute = { routedReference: null, routedSkill: "library" };
		expect(getDashboardActiveTools([user], false, route)).toEqual(
			expect.arrayContaining(["generateLibraryLogo", "setBrandLogo"])
		);
		const generated = message([{ toolName: "generateLibraryLogo" }]);
		const afterGeneration = getDashboardActiveTools([user, generated], false, route);
		expect(afterGeneration).not.toContain("generateLibraryLogo");
		expect(afterGeneration).toContain("setBrandLogo");
		const applied = message([{ toolName: "generateLibraryLogo" }, { toolName: "setBrandLogo" }]);
		expect(getDashboardActiveTools([user, applied], false, route)).not.toContain("setBrandLogo");
		expect(getDashboardActiveTools([user], false, {})).not.toContain("setBrandLogo");
	});
	it("requires current Brand and Links reads for recommendations and native theme mutations", () => {
		const route: DashboardRoute = { routedReference: null, routedSkill: "links" };
		expect(getDashboardActiveTools([user], false, route)).not.toContain("changeLinkPageTheme");
		const inspected = message([{ toolName: "getLinkPage" }, { toolName: "getBrand" }]);
		const active = getDashboardActiveTools([user, inspected], false, route);
		expect(active).toEqual(
			expect.arrayContaining(["recommendBrandAppearance", "recommendLinkPageTheme", "changeLinkPageTheme"])
		);
		expect(
			getDashboardActiveTools(
				[user, inspected, message([{ state: "output-error", toolName: "changeLinkPageTheme" }])],
				false,
				route
			)
		).not.toContain("editLinkPage");
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
		{ domain: "contacts", read: "listContacts", unrelated: "getLinkPage" },
		{ domain: "blog", read: "listBlogPosts", unrelated: "getLinkPage" },
		{ domain: "links", read: "getLinkPage", unrelated: "inspectWebsite" },
		{ domain: "website", read: "inspectWebsite", unrelated: "listContacts" },
	])("reuses $domain instructions until they leave context", ({ domain, read, unrelated }) => {
		const history = [message([{ args: { name: domain }, toolName: "skill" }]), user];
		expect(getDashboardActiveTools(history)).toContain(read);
		expect(getDashboardActiveTools(history)).not.toContain(unrelated);
		expect(getDashboardActiveTools(history.slice(1))).not.toContain(read);
	});
	it("reuses complete main-file reads but not failed skill loads", () => {
		const skill = { args: { path: "SKILL.md", skillName: "contacts" }, toolName: "skill_read" };
		expect(getDashboardActiveTools([message([skill]), user])).toContain("listContacts");

		for (const failure of [
			{ state: "call" as const },
			{ isError: true },
			{ result: { error: true } },
			{ result: 'File "SKILL.md" not found in skill "contacts".' },
		]) {
			expect(getDashboardActiveTools([message([{ ...skill, ...failure }]), user])).not.toContain("listContacts");
		}
	});
	it.each([
		{ domain: "contacts", read: "getContact", write: "updateContact" },
		{ domain: "blog", read: "getBlogPost", write: "updateBlogPost" },
		{ domain: "blog", read: "getBlogPost", write: "publishBlogPost" },
		{ domain: "contacts", read: "getContact", write: "deleteContact" },
		{ domain: "domains", read: "listDomains", write: "connectDomain" },
		{ domain: "domains", read: "quoteDomain", write: "purchaseDomain" },
		{ domain: "domains", read: "listDomainDnsRecords", write: "deleteDomainDnsRecord" },
		{ domain: "notifications", read: "getNotificationSettings", write: "updateNotificationSetting" },
		{ domain: "links", read: "getLinkPage", write: "editLinkPage" },
		{ domain: "links", read: "getLinkPage", write: "publishLinkPage" },
		{ domain: "website", read: "getBrand", write: "updateBrand" },
	])("requires a fresh $read for $write even with retained instructions", ({ domain, read, write }) => {
		const history = [message([{ args: { name: domain }, toolName: "skill" }, { toolName: read }]), user];
		expect(getDashboardActiveTools(history)).not.toContain(write);
		expect(getDashboardActiveTools([...history, message([{ isError: true, toolName: read }])])).not.toContain(
			write
		);
		expect(getDashboardActiveTools([...history, message([{ toolName: read }])])).toContain(write);
	});
	it("requires this turn's website operation reference and inspection without reloading the main skill", () => {
		const history = [message(websiteCalls), user];
		expect(getDashboardActiveTools(history)).toContain("inspectWebsite");
		expect(getDashboardActiveTools([...history, message([{ toolName: "inspectWebsite" }])])).not.toContain(
			"editWebsite"
		);
		expect(getDashboardActiveTools([...history, message(websiteCalls.slice(1, 2))])).not.toContain("editWebsite");
		expect(getDashboardActiveTools([...history, message(websiteCalls.slice(1))])).toContain("editWebsite");
	});
	it("resets contact attempts on a new user turn but not when reloading retained instructions", () => {
		const skill = { args: { name: "contacts" }, toolName: "skill" };
		const history = [message([skill, { toolName: "createContact" }]), user];
		expect(getDashboardActiveTools(history)).toContain("createContact");

		for (const state of ["call", "result", "output-error"] as const) {
			const current = [...history, message([{ state, toolName: "createContact" }, skill])];
			expect(getDashboardActiveTools(current)).not.toContain("createContact");
			expect(getDashboardActiveTools(current, true).includes("createContact")).toBe(state === "call");
		}
	});
	it("recognizes a complete main skill read and only offers reference reading for Website", () => {
		const read = { args: { path: "SKILL.md", skillName: "contacts" }, toolName: "skill_read" };
		expect(getDashboardActiveTools([])).not.toContain("skill_read");
		expect(getDashboardActiveTools([message([read])])).toContain("createContact");
		expect(getDashboardActiveTools([message([read])])).not.toContain("skill_read");
		expect(getDashboardActiveTools([message([{ args: { name: "website" }, toolName: "skill" }])])).toContain(
			"skill_read"
		);

		for (const args of [
			{ ...read.args, startLine: 2 },
			{ ...read.args, endLine: 3 },
			{ ...read.args, path: "references/contacts.md" },
		]) {
			expect(getDashboardActiveTools([message([{ ...read, args }])])).not.toContain("createContact");
		}

		for (const result of ['File "SKILL.md" not found in skill "contacts".', 'Skill "contacts" not found.']) {
			expect(getDashboardActiveTools([message([{ ...read, result }])])).not.toContain("createContact");
		}

		const attempted = message([read, { state: "output-error", toolName: "createContact" }, read]);
		expect(getDashboardActiveTools([attempted])).not.toContain("createContact");
	});

	it("allows contact creation after a pre-activation rejection without reopening attempted writes", () => {
		const skill = { args: { name: "contacts" }, toolName: "skill" };

		const unavailable = {
			errorText: 'Tool "createContact" not found.',
			state: "output-error" as const,
			toolName: "createContact",
		};

		const activated = [unavailable, skill];
		expect(getDashboardActiveTools([message([unavailable])])).not.toContain("createContact");
		expect(getDashboardActiveTools([message(activated)])).toContain("createContact");

		for (const state of ["call", "result", "output-error"] as const) {
			const attempted = message([...activated, { state, toolName: "createContact" }, skill]);
			expect(getDashboardActiveTools([attempted])).not.toContain("createContact");
			expect(getDashboardActiveTools([attempted], true).includes("createContact")).toBe(state === "call");
		}
	});

	it.each(["updateContact", "deleteContact"])(
		"gates %s on inspection and preserves only pending approval",
		(toolName) => {
			const skill = { args: { name: "contacts" }, toolName: "skill" };
			const inspected = [skill, { toolName: "getContact" }];
			expect(getDashboardActiveTools([])).not.toContain(toolName);
			expect(getDashboardActiveTools([message([skill])])).not.toContain(toolName);
			expect(
				getDashboardActiveTools([message([skill, { isError: true, toolName: "getContact" }])])
			).not.toContain(toolName);
			expect(getDashboardActiveTools([message(inspected)])).toContain(toolName);
			const pending = message([...inspected, { state: "call", toolName }]);
			expect(getDashboardActiveTools([pending])).not.toContain(toolName);
			expect(getDashboardActiveTools([pending], true)).toContain(toolName);

			for (const state of ["result", "output-error"] as const) {
				expect(getDashboardActiveTools([message([...inspected, { state, toolName }])], true)).not.toContain(
					toolName
				);
			}
		}
	);
	it("keeps domain schemas absent until activation and successful inspection", () => {
		expect(getDashboardActiveTools([])).not.toContain("editWebsite");
		expect(getDashboardActiveTools([message(websiteCalls.slice(0, 2))])).not.toContain("editWebsite");
		expect(getDashboardActiveTools([message(websiteCalls)])).toContain("editWebsite");
		expect(getDashboardActiveTools([message(websiteCalls)])).not.toContain("composeWebsiteSection");
		expect(getDashboardActiveTools([message(websiteCalls)])).not.toContain("createContact");
	});
	it("does not unlock writes after a failed inspection", () => {
		expect(
			getDashboardActiveTools([
				message([
					...websiteCalls.slice(0, 2),
					{ errorText: "Unavailable", state: "output-error", toolName: "inspectWebsite" },
				]),
			])
		).not.toContain("editWebsite");
	});
	it("resets evidence at the newest user message and ignores quoted tool instructions", () => {
		expect(getDashboardActiveTools([message(websiteCalls), user])).not.toContain("editWebsite");
	});
	it("preserves native pending calls only for validated approval continuation, then makes execution terminal", () => {
		const calls = [...websiteCalls, { state: "call" as const, toolName: "editWebsite" }];
		expect(getDashboardActiveTools([message(calls)])).not.toContain("editWebsite");
		expect(getDashboardActiveTools([message(calls)], true)).toContain("editWebsite");
		expect(
			getDashboardActiveTools([message([...websiteCalls, { state: "result", toolName: "editWebsite" }])], true)
		).not.toContain("editWebsite");
	});
	it("supports mixed domains without loading unrelated website authoring tools", () => {
		const active = getDashboardActiveTools([
			message([
				{ args: { name: "links" }, toolName: "skill" },
				{ toolName: "getLinkPage" },
				{ args: { name: "contacts" }, toolName: "skill" },
			]),
		]);

		expect(active).toEqual(expect.arrayContaining(["editLinkPage", "listContacts", "createContact"]));
		expect(active).not.toContain("buildWebsite");
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
			using provider = vi.spyOn(models.decision.model, "doEvaluate").mockResolvedValue({
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
		using provider = vi.spyOn(models.decision.model, "doEvaluate").mockRejectedValue(new Error("Unavailable"));

		await expect(dashboardResponseRelevanceScorer.run({ input, output })).rejects.toThrow(
			"Response relevance evaluation unavailable"
		);
		expect(provider).toHaveBeenCalledOnce();
	});
});
