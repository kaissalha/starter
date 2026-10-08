import type { MastraDBMessage } from "@mastra/core/agent";
import { z } from "zod";

import { isDashboardMutationToolName } from "./tools";
import type { AppContext } from "./types";

const skillArgumentsSchema = z.compile(z.looseObject({ name: z.string() }));

const skillReadArgumentsSchema = z.compile(
	z.looseObject({
		endLine: z.number().optional(),
		path: z.literal("SKILL.md"),
		skillName: z.string(),
		startLine: z.number().optional(),
	})
);

const referenceArgumentsSchema = z.compile(z.looseObject({ path: z.string(), skillName: z.literal("website") }));

const skillFailureSchema = z.compile(z.string().regex(/^(?:Skill|File) ".*" not found/u));

const failureSchema = z.compile(z.looseObject({ error: z.literal(true) }));

type Invocation = Extract<MastraDBMessage["content"]["parts"][number], { type: "tool-invocation" }>["toolInvocation"];

export type DashboardRoute = Pick<AppContext, "routedReference" | "routedSkill">;

const getRoutedActivation = (route: DashboardRoute | undefined) => ({
	references:
		route?.routedSkill === "website" && route.routedReference
			? [`references/website-${route.routedReference}.md`]
			: [],
	skills: route?.routedSkill ? [route.routedSkill] : [],
});

const getLoadedSkill = ({ args, toolName }: Invocation) => {
	if (toolName === "skill") {
		return skillArgumentsSchema.safeParse(args).data?.name;
	}

	if (toolName !== "skill_read") {
		return undefined;
	}

	const parsed = skillReadArgumentsSchema.safeParse(args);

	return parsed.success && parsed.data.endLine === undefined && (parsed.data.startLine ?? 1) === 1
		? parsed.data.skillName
		: undefined;
};

const getBlogActiveTools = ({
	called,
	enabled,
	inspected,
}: {
	called: Array<string>;
	enabled: boolean;
	inspected: boolean;
}) => {
	if (!enabled) {
		return [];
	}

	const active = [
		"listBlogPosts",
		"getBlogPost",
		"getBlogPostGenerationStatus",
		...["createBlogPost", "generateNewBlogPost"].filter((name) => !called.includes(name)),
	];

	const mutations = [
		"updateBlogPost",
		"deleteBlogPost",
		"publishBlogPost",
		"unpublishBlogPost",
		"generateBlogPost",
		"translateBlogPost",
		"cancelBlogPostGeneration",
	];

	if (inspected && !called.some((name) => mutations.includes(name))) {
		active.push(...mutations);
	}

	return active;
};

const filterQuestionTools = (active: Array<string>, calls: Array<Invocation>) => {
	const questionCalls = calls.filter(({ toolName }) => toolName === "askUserQuestions");

	if (questionCalls.some(({ state }) => state !== "result" && state !== "output-error")) {
		return [];
	}

	const limitReached = new Set(questionCalls.map(({ toolCallId }) => toolCallId)).size >= 2;

	return [...new Set(active)].filter((name) => name !== "askUserQuestions" || !limitReached);
};

const getContactReadTools = (completed: Array<Invocation>) =>
	Object.entries({
		getContact: ["listContactMessages"],
		listContactMessages: ["getContactMessage", "triageContactMessage"],
	})
		.filter(([dependency]) => completed.some(({ toolName }) => toolName === dependency))
		.flatMap(([, toolNames]) => toolNames);

const analyticsReadTools = (skills: ReadonlySet<string>) =>
	skills.has("analytics")
		? [
				"getAnalyticsOverview",
				"getAnalyticsBreakdown",
				"getAnalyticsRealtime",
				"getAnalyticsLive",
				"getAnalyticsWebVitals",
			]
		: [];

const domainMutationTools = {
	listDomainDnsRecords: ["saveDomainDnsRecord", "deleteDomainDnsRecord"],
	listDomains: [
		"connectDomain",
		"changeDomainMethod",
		"disconnectDomain",
		"setPrimaryDomain",
		"updateWebsiteSubdomain",
		"setDomainAutoRenew",
	],
	quoteDomain: ["purchaseDomain"],
};

const domainActiveTools = ({ read, skills }: { read: (name: string) => boolean; skills: ReadonlySet<string> }) =>
	skills.has("domains")
		? [
				"listDomains",
				"listDomainDnsRecords",
				"verifyDomain",
				"suggestDomains",
				"checkDomainAvailability",
				"getDomainPrices",
				"quoteDomain",
				...Object.entries(domainMutationTools).flatMap(([dependency, toolNames]) =>
					read(dependency) ? toolNames : []
				),
			]
		: [];

const notificationActiveTools = ({ read, skills }: { read: (name: string) => boolean; skills: ReadonlySet<string> }) =>
	skills.has("notifications")
		? ["getNotificationSettings", ...(read("getNotificationSettings") ? ["updateNotificationSetting"] : [])]
		: [];

const libraryMutationTools = [
	"createLibraryDocument",
	"editLibraryDocument",
	"generateLibraryImage",
	"generateLibraryLogo",
];

const libraryActiveTools = ({
	calls,
	read,
	skills,
}: {
	calls: Array<Invocation>;
	read: (name: string) => boolean;
	skills: ReadonlySet<string>;
}) => {
	if (!skills.has("library")) {
		return [];
	}

	const readTools = ["listLibraryAssets", "getLibraryAsset"];

	if (calls.some(({ toolName }) => libraryMutationTools.includes(toolName))) {
		return readTools;
	}

	return [
		...readTools,
		"createLibraryDocument",
		"generateLibraryImage",
		"generateLibraryLogo",
		...(read("getLibraryAsset") ? ["editLibraryDocument"] : []),
	];
};

const brandLogoActiveTools = ({ calls, skills }: { calls: Array<Invocation>; skills: ReadonlySet<string> }) =>
	["website", "links", "library"].some((name) => skills.has(name)) &&
	!calls.some(({ toolName }) => toolName === "setBrandLogo")
		? ["setBrandLogo"]
		: [];

const seoActiveTools = (skills: ReadonlySet<string>) =>
	skills.has("seo")
		? ["getSeoOverview", "getSearchConsoleOverview", "getGeoOverview", "exploreSeoPrompt", "refreshGeoQuestion"]
		: [];

const inspectArgumentsSchema = z.compile(
	z.looseObject({ index: z.number().optional(), page: z.string().optional(), scope: z.string() })
);

export const getComposeBlockers = (completedThisTurn: Array<Invocation>) => {
	const reads = completedThisTurn.flatMap(({ args, toolName }) => {
		const parsed = toolName === "inspectWebsite" ? inspectArgumentsSchema.safeParse(args) : undefined;

		return parsed?.success ? [parsed.data] : [];
	});

	const referenced = reads.filter(({ scope }) => scope === "reference");

	const matched = reads.some(
		(context) =>
			context.scope === "context" &&
			referenced.some(({ index, page }) => index === context.index && page === context.page)
	);

	return [
		...(referenced.length === 0
			? ['inspectWebsite scope "reference" for this request (page, index, recommend)']
			: []),
		...(matched
			? []
			: [
					'inspectWebsite scope "context" for the same page and index (theme colors, fonts, neighbouring sections)',
				]),
	];
};

const composeActiveTools = (completedThisTurn: Array<Invocation>) =>
	getComposeBlockers(completedThisTurn).length === 0 ? ["composeWebsiteSection"] : [];

export const getDashboardActiveTools = (
	messages: Array<MastraDBMessage>,
	approvalContinuation?: boolean,
	route?: DashboardRoute
) => {
	const routed = getRoutedActivation(route);

	const turnStart = Math.max(
		0,
		messages.findLastIndex(({ role }) => role === "user")
	);

	const callsByMessage = messages.map(({ content }) =>
		content.parts.flatMap((part) => (part.type === "tool-invocation" ? [part.toolInvocation] : []))
	);

	const calls = callsByMessage.slice(turnStart).flat();
	const currentCalls = new Set(calls);

	const completed = callsByMessage
		.flat()
		.filter(
			(call) =>
				call.state === "result" &&
				!call.isError &&
				!failureSchema.safeParse(call.result).success &&
				!(["skill", "skill_read"].includes(call.toolName) && skillFailureSchema.safeParse(call.result).success)
		);

	const completedThisTurn = completed.filter((call) => currentCalls.has(call));

	const skills = new Set([
		...routed.skills,
		...completed.flatMap((call) => {
			const name = getLoadedSkill(call);

			return name ? [name] : [];
		}),
	]);

	const references = [
		...routed.references,
		...completedThisTurn.flatMap(({ args, toolName }) => {
			if (toolName !== "skill_read") {
				return [];
			}

			const parsed = referenceArgumentsSchema.safeParse(args);

			return parsed.success ? [parsed.data.path] : [];
		}),
	];

	const read = (name: string) => completedThisTurn.some(({ toolName }) => toolName === name);

	const active = [
		"skill",
		"askUserQuestions",
		"retrieveKnowledge",
		"webSearch",
		"getDocument",
		"listDocuments",
		"inspectTable",
		...analyticsReadTools(skills),
		...seoActiveTools(skills),
		...domainActiveTools({ read, skills }),
		...notificationActiveTools({ read, skills }),
	];

	if (["website", "links"].some((name) => skills.has(name))) {
		active.push("getBrand", "listBrandOptions");
	}

	if (["website", "links", "blog"].some((name) => skills.has(name))) {
		active.push("listUploadedMedia", "searchStockImages", "findStockImage", "selectStockImage");
	}

	if (skills.has("website")) {
		active.push("skill_read", "inspectWebsite", "getWebsiteStatus", "listWebsiteTemplates");
	}

	if (skills.has("links")) {
		active.push("getLinkPage");
	}

	const attempted = (names: Array<string>, invocations = calls) => {
		const toolNames = new Set(names);

		return invocations.some(({ toolName }) => toolNames.has(toolName));
	};

	if (!attempted(["updateBrand", "publishBrand"]) && read("getBrand")) {
		active.push("recommendBrandAppearance", "updateBrand", "publishBrand");
	}

	if (
		skills.has("links") &&
		read("getLinkPage") &&
		!attempted(["editLinkPage", "publishLinkPage", "changeLinkPageTheme"])
	) {
		active.push("recommendLinkPageTheme", "editLinkPage", "publishLinkPage", "changeLinkPageTheme");
	}

	active.push(
		...brandLogoActiveTools({ calls, skills }),
		...libraryActiveTools({ calls, read, skills }),
		...getBlogActiveTools({
			called: calls.map(({ toolName }) => toolName),
			enabled: skills.has("blog"),
			inspected: read("getBlogPost"),
		})
	);
	const contactActivation = completed.find((call) => getLoadedSkill(call) === "contacts");

	if (skills.has("contacts")) {
		const contactCalls = contactActivation ? calls.slice(calls.indexOf(contactActivation) + 1) : calls;
		active.push(
			"getContactInquirySummary",
			"listContacts",
			"getContact",
			...getContactReadTools(completedThisTurn)
		);

		if (!attempted(["createContact"], contactCalls)) {
			active.push("createContact");
		}

		if (read("getContact") && !attempted(["updateContact", "deleteContact"], contactCalls)) {
			active.push("updateContact", "deleteContact");
		}
	}

	if (
		skills.has("website") &&
		read("inspectWebsite") &&
		!calls.some(
			({ toolName }) =>
				isDashboardMutationToolName(toolName) &&
				![
					"createContact",
					"updateContact",
					"deleteContact",
					"editLinkPage",
					"publishLinkPage",
					"changeLinkPageTheme",
					...libraryMutationTools,
					"updateNotificationSetting",
					...Object.values(domainMutationTools).flat(),
				].includes(toolName)
		)
	) {
		if (references.includes("references/website-edit.md")) {
			active.push("editWebsite", "publishWebsite", "changeWebsiteTemplate", "generateWebsiteLayout");
		}

		if (references.includes("references/website-catalog.md")) {
			active.push("addWebsiteSection");
		}

		if (references.includes("references/website-compose.md")) {
			active.push("addWebsiteSection", ...composeActiveTools(completedThisTurn));
		}

		if (references.includes("references/website-modify.md")) {
			active.push("buildWebsite");
		}
	}

	if (
		skills.has("website") &&
		read("getWebsiteStatus") &&
		!attempted(["generateWebsite", "cancelWebsiteWorkflow", "previewWebsiteTemplate"])
	) {
		active.push("generateWebsite", "cancelWebsiteWorkflow", "previewWebsiteTemplate");
	}

	if (approvalContinuation) {
		active.push(
			...calls.flatMap(({ state, toolName }) =>
				isDashboardMutationToolName(toolName) && state !== "result" && state !== "output-error"
					? [toolName]
					: []
			)
		);
	}

	return filterQuestionTools(active, calls);
};
