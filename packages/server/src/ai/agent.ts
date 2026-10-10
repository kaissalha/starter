import { Agent, type MastraDBMessage } from "@mastra/core/agent";
import { Classifier } from "@mastra/core/classifier";
import {
	createClassifierScorer,
	createScorer,
	type ScorerRunInputForAgent,
	type ScorerRunOutputForAgent,
} from "@mastra/core/evals";
import { RequestContext } from "@mastra/core/request-context";
import { z } from "zod";

import { requireOrganizationPermission } from "../services/permissions";
import { hasOrganizationPermission } from "../utils/permissions";
import { decisionModel } from "./decisions";
import { createDashboardWorkingMemoryProcessor, dashboardChatMemory } from "./memory";
import { models } from "./models";
import {
	dashboardChatCurrentUserPrompt,
	dashboardChatSystemPrompt,
	dashboardClaimedActionInstructions,
	dashboardEmbeddedInstructionsInstructions,
	dashboardGroundedClaimsInstructions,
	dashboardLocaleMatchInstructions,
	dashboardResponseRelevanceInstructions,
} from "./prompts";
import { dashboardSkills } from "./skills";
import { dashboardChatTools, isDashboardMutationToolName } from "./tools";
import { appContextSchema } from "./types";

const failedToolResultSchema = z.compile(z.looseObject({ error: z.literal(true) }));

const localeContextSchema = z.compile(z.looseObject({ locale: z.string().min(1) }));

type AgentScorerRun = { input?: ScorerRunInputForAgent; output: ScorerRunOutputForAgent; requestContext?: unknown };

const textOf = (messages: Array<MastraDBMessage>) =>
	messages
		.flatMap(({ content }) => content.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])))
		.join("\n");

const runTexts = ({ input, output }: AgentScorerRun) => ({
	request: textOf(
		[...(input?.rememberedMessages ?? []), ...(input?.inputMessages ?? [])]
			.filter(({ role }) => role === "user")
			.slice(-1)
	),
	response: textOf(output.filter(({ role }) => role === "assistant")),
});

const successfulToolResults = ({ output }: AgentScorerRun) =>
	output.flatMap(({ content }) =>
		content.parts.flatMap((part) =>
			part.type === "tool-invocation" &&
			part.toolInvocation.state === "result" &&
			!part.toolInvocation.isError &&
			!failedToolResultSchema.safeParse(part.toolInvocation.result).success
				? [
						{
							result: JSON.stringify(part.toolInvocation.result ?? null),
							toolName: part.toolInvocation.toolName,
						},
					]
				: []
		)
	);

export const dashboardScorers = {
	accurateActionClaims: createClassifierScorer({
		classifier: new Classifier({
			id: "dashboard-accurate-action-claims",
			model: decisionModel,
			questions: {
				accurateActionClaims: { instructions: dashboardClaimedActionInstructions, type: "boolean" },
			},
		}),
		id: "dashboard-accurate-action-claims",
		question: "accurateActionClaims",
		state: ({ run }) => ({
			executedTools: successfulToolResults(run).map(({ toolName }) => toolName),
			response: runTexts(run).response,
		}),
		type: "agent",
	}),
	answeredInUserLocale: createClassifierScorer({
		classifier: new Classifier({
			id: "dashboard-answered-in-user-locale",
			model: decisionModel,
			questions: {
				locale: {
					criteria: {
						matches: "The response prose is written in the language of the locale",
						mismatch: "The response prose is written in a different language than the locale",
						unclear: "The response has no natural-language prose to judge",
					},
					instructions: dashboardLocaleMatchInstructions,
					type: "choice",
				},
			},
		}),
		id: "dashboard-answered-in-user-locale",
		question: "locale",
		scores: { matches: 1, mismatch: 0, unclear: 0.5 },
		state: ({ run }) => ({
			...runTexts(run),
			locale:
				localeContextSchema.safeParse(
					run.requestContext instanceof RequestContext ? run.requestContext.all : run.requestContext
				).data?.locale ?? null,
		}),
		type: "agent",
	}),
	grounded: createClassifierScorer({
		classifier: new Classifier({
			id: "dashboard-grounded-claims",
			model: decisionModel,
			questions: {
				grounded: { instructions: dashboardGroundedClaimsInstructions, type: "boolean" },
			},
		}),
		id: "dashboard-grounded-claims",
		question: "grounded",
		state: ({ run }) => {
			const evidence = successfulToolResults(run);

			return {
				...runTexts(run),
				evidenceIncomplete: evidence.length > 4 || evidence.some(({ result }) => result.length > 5000),
				toolOutputs: evidence
					.slice(-4)
					.map(({ result, toolName }) => ({ result: result.slice(0, 5000), toolName })),
			};
		},
		type: "agent",
	}),
	ignoredEmbeddedInstructions: createClassifierScorer({
		classifier: new Classifier({
			id: "dashboard-ignored-embedded-instructions",
			model: decisionModel,
			questions: {
				ignoredEmbeddedInstructions: {
					instructions: dashboardEmbeddedInstructionsInstructions,
					type: "boolean",
				},
			},
		}),
		id: "dashboard-ignored-embedded-instructions",
		question: "ignoredEmbeddedInstructions",
		state: ({ run }) => ({
			...runTexts(run),
			toolOutputs: successfulToolResults(run).map(({ result }) => result.slice(0, 2000)),
		}),
		type: "agent",
	}),
	noToolErrors: createScorer<string, Array<MastraDBMessage>>({
		description: "Detect native and normalized tool execution errors.",
		id: "dashboard-no-tool-errors",
	}).generateScore(({ run }) =>
		run.output.some(({ content }) =>
			content.parts.some(
				(part) =>
					part.type === "tool-invocation" &&
					(part.toolInvocation.state === "output-error" ||
						part.toolInvocation.isError === true ||
						failedToolResultSchema.safeParse(part.toolInvocation.result).success)
			)
		)
			? 0
			: 1
	),
	responseRelevance: createClassifierScorer({
		classifier: new Classifier({
			id: "dashboard-response-relevance",
			model: decisionModel,
			questions: {
				relevance: {
					criteria: [
						"Unrelated or misses the request",
						"Partially addresses the request",
						"Directly addresses the request",
					],
					instructions: dashboardResponseRelevanceInstructions,
					type: "score",
				},
			},
		}),
		id: "dashboard-response-relevance",
		question: "relevance",
		state: ({ run }) => runTexts(run),
		type: "agent",
	}),
};

const readOnlyToolNames = Object.keys(dashboardChatTools).filter((name) => !isDashboardMutationToolName(name));

export const dashboardChatAgent = new Agent({
	defaultOptions: {
		maxSteps: 20,
		prepareStep: async ({ requestContext }) => {
			const context = appContextSchema.parse(requestContext?.all);
			const role = await requireOrganizationPermission({ ...context, permission: "read" });

			return hasOrganizationPermission({ permission: "write", role }) ? {} : { activeTools: readOnlyToolNames };
		},
		toolCallConcurrency: { limit: 6, strategy: "called" },
	},
	description: "Organization-scoped dashboard assistant for knowledge and library work.",
	id: "dashboard-chat-agent",
	inputProcessors: async () => [await createDashboardWorkingMemoryProcessor()],
	instructions: ({ requestContext }) =>
		[dashboardChatSystemPrompt, dashboardChatCurrentUserPrompt(requestContext.get("currentUser"))]
			.filter(Boolean)
			.join("\n\n"),
	memory: dashboardChatMemory,
	model: ({ requestContext }) => (requestContext.get("useVisionModel") ? models.vision.model : models.chat.model),
	name: "Dashboard Chat Agent",
	requestContextSchema: appContextSchema,
	scorers: Object.fromEntries(
		Object.entries(dashboardScorers).map(([name, scorer]) => [
			name,
			{ sampling: { rate: name === "noToolErrors" ? 1 : 0.1, type: "ratio" as const }, scorer },
		])
	),
	skills: dashboardSkills,
	tools: dashboardChatTools,
});
