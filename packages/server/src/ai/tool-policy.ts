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

const skillFailureSchema = z.compile(z.string().regex(/^(?:Skill|File) ".*" not found/u));

const failureSchema = z.compile(z.looseObject({ error: z.literal(true) }));

type Invocation = Extract<MastraDBMessage["content"]["parts"][number], { type: "tool-invocation" }>["toolInvocation"];

export type DashboardRoute = Pick<AppContext, "routedSkill">;

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

const filterQuestionTools = (active: Array<string>, calls: Array<Invocation>) => {
	const questionCalls = calls.filter(({ toolName }) => toolName === "askUserQuestions");

	if (questionCalls.some(({ state }) => state !== "result" && state !== "output-error")) {
		return [];
	}

	const limitReached = new Set(questionCalls.map(({ toolCallId }) => toolCallId)).size >= 2;

	return [...new Set(active)].filter((name) => name !== "askUserQuestions" || !limitReached);
};

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

export const getDashboardActiveTools = (
	messages: Array<MastraDBMessage>,
	approvalContinuation?: boolean,
	route?: DashboardRoute
) => {
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
		...(route?.routedSkill ? [route.routedSkill] : []),
		...completed.flatMap((call) => {
			const name = getLoadedSkill(call);

			return name ? [name] : [];
		}),
	]);

	const read = (name: string) => completedThisTurn.some(({ toolName }) => toolName === name);

	const active = [
		"skill",
		"addNumbers",
		"askUserQuestions",
		"retrieveKnowledge",
		"webSearch",
		"getDocument",
		"listDocuments",
		"inspectTable",
		...notificationActiveTools({ read, skills }),
		...libraryActiveTools({ calls, read, skills }),
	];

	if (skills.has("library")) {
		active.push("listUploadedMedia");
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
