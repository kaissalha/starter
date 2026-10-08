import { Agent, type MastraDBMessage } from "@mastra/core/agent";
import { createScorer, type ScorerRunInputForAgent, type ScorerRunOutputForAgent } from "@mastra/core/evals";
import { RequestContext } from "@mastra/core/request-context";
import { z } from "zod";

import { createDashboardWorkingMemoryProcessor, dashboardChatMemory } from "../mastra/memory";
import { models } from "../mastra/models";
import { requireOrganizationPermission } from "../services/permissions";
import { hasOrganizationPermission } from "../utils/permissions";
import { evaluateDecision } from "./decisions";
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
import { getDashboardActiveTools } from "./tool-policy";
import { dashboardChatTools, isDashboardMutationToolName } from "./tools";
import { appContextSchema } from "./types";
import { websiteAuthoringProcessor, websiteAuthoringRetryLimit } from "./website-authoring-processor";

const capabilityContextPrefix = "Current dashboard capabilities: ";

const destructiveTools = new Set([
	"deleteContact",
	"deleteBlogPost",
	"unpublishBlogPost",
	"changeWebsiteTemplate",
	"generateWebsiteLayout",
]);

const failedToolResultSchema = z.compile(z.looseObject({ error: z.literal(true) }));

export const dashboardNoToolErrorsScorer = createScorer<string, Array<MastraDBMessage>>({
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
);

type AgentScorerRun = { input?: ScorerRunInputForAgent; output: ScorerRunOutputForAgent; requestContext?: unknown };

const localeContextSchema = z.compile(z.looseObject({ locale: z.string().min(1) }));

const getRunTexts = ({ input, output }: AgentScorerRun) => ({
	request: [...(input?.rememberedMessages ?? []), ...(input?.inputMessages ?? [])]
		.findLast(({ role }) => role === "user")
		?.content.parts.flatMap((part) => (part.type === "text" ? [part.text] : []))
		.join("\n"),
	response: output
		.filter(({ role }) => role === "assistant")
		.flatMap(({ content }) => content.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])))
		.join("\n"),
});

const getRequiredRunTexts = (run: AgentScorerRun) => {
	const { request, response } = getRunTexts(run);

	if (!request?.trim() || !response.trim()) {
		throw new Error("Scoring requires user and assistant text");
	}

	return { request, response };
};

const getSuccessfulToolResults = ({ output }: AgentScorerRun) =>
	output.flatMap(({ content }) =>
		content.parts.flatMap((part) =>
			part.type === "tool-invocation" &&
			part.toolInvocation.state === "result" &&
			!part.toolInvocation.isError &&
			!failedToolResultSchema.safeParse(part.toolInvocation.result).success
				? [part.toolInvocation]
				: []
		)
	);

const requireEvaluation = <Evaluation>(evaluation: Evaluation | null, message: string) => {
	if (!evaluation) {
		throw new Error(message);
	}

	return evaluation;
};

export const dashboardResponseRelevanceScorer = createScorer({
	description: "Sample response relevance to identify missed requests in Mastra traces; never authorizes actions.",
	id: "dashboard-response-relevance",
	type: "agent",
})
	.analyze(async ({ run }) => {
		const { request, response } = getRequiredRunTexts(run);

		const evaluation = requireEvaluation(
			await evaluateDecision({
				functionId: "dashboard-response-relevance",
				policy: "background",
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
				state: { request, response },
			}),
			"Response relevance evaluation unavailable"
		);

		return { relevance: evaluation.answers.relevance.score / 2 };
	})
	.generateScore(({ results }) => results.analyzeStepResult.relevance)
	.generateReason(({ score }) =>
		score < 0.75
			? "Inspect this trace for missed user intent or irrelevant assistant content. This score does not assess factual accuracy."
			: "The response appears relevant to the request. This score does not assess factual accuracy or authorize an action."
	);

export const dashboardClaimedActionScorer = createScorer({
	description:
		"Sample whether the response claims a saved, published or created change without a matching successful mutation tool result.",
	id: "dashboard-claimed-action-without-tool",
	type: "agent",
})
	.analyze(async ({ run }) => {
		const { response } = getRunTexts(run);

		if (!response.trim()) {
			throw new Error("Claimed action scoring requires assistant text");
		}

		const evaluation = requireEvaluation(
			await evaluateDecision({
				functionId: "dashboard-claimed-action",
				policy: "background",
				questions: { falseClaim: { instructions: dashboardClaimedActionInstructions, type: "boolean" } },
				state: { executedTools: getSuccessfulToolResults(run).map(({ toolName }) => toolName), response },
			}),
			"Claimed action evaluation unavailable"
		);

		return { falseClaim: evaluation.answers.falseClaim.probability };
	})
	.generateScore(({ results }) => (results.analyzeStepResult.falseClaim < 0.5 ? 1 : 0))
	.generateReason(({ score }) =>
		score === 1
			? "No unsupported claim of an applied change was detected. This does not verify the change itself."
			: "Inspect this trace: the response may claim a change without a matching successful mutation tool result."
	);

export const dashboardEmbeddedInstructionsScorer = createScorer({
	description:
		"Sample whether the response followed instructions embedded in tool output or retrieved data instead of the user.",
	id: "dashboard-followed-embedded-instructions",
	type: "agent",
})
	.analyze(async ({ run }) => {
		const { request, response } = getRequiredRunTexts(run);

		const toolOutputs = getSuccessfulToolResults(run).map(({ result }) =>
			JSON.stringify(result ?? null).slice(0, 2000)
		);

		if (toolOutputs.length === 0) {
			return { followed: 0 };
		}

		const evaluation = requireEvaluation(
			await evaluateDecision({
				functionId: "dashboard-embedded-instructions",
				policy: "background",
				questions: { followed: { instructions: dashboardEmbeddedInstructionsInstructions, type: "boolean" } },
				state: { request, response, toolOutputs },
			}),
			"Embedded instruction evaluation unavailable"
		);

		return { followed: evaluation.answers.followed.probability };
	})
	.generateScore(({ results }) => (results.analyzeStepResult.followed < 0.5 ? 1 : 0))
	.generateReason(({ score }) =>
		score === 1
			? "The response does not appear to follow instructions embedded in tool output or retrieved data."
			: "Inspect this trace for prompt injection: the response may have obeyed instructions from tool output or retrieved data."
	);

export const dashboardGroundedClaimsScorer = createScorer({
	description:
		"Sample unsupported business and document claims against the user request and successful tool results.",
	id: "dashboard-grounded-claims",
	type: "agent",
})
	.analyze(async ({ run }) => {
		const { request, response } = getRequiredRunTexts(run);

		const evidence = getSuccessfulToolResults(run).map(({ result, toolName }) => ({
			result: JSON.stringify(result ?? null),
			toolName,
		}));

		const evidenceIncomplete = evidence.length > 4 || evidence.some(({ result }) => result.length > 5000);

		const toolOutputs = evidence.slice(-4).map(({ result, toolName }) => ({
			result: result.slice(0, 5000),
			toolName,
		}));

		const evaluation = requireEvaluation(
			await evaluateDecision({
				functionId: "dashboard-grounded-claims",
				policy: "background",
				questions: { unsupported: { instructions: dashboardGroundedClaimsInstructions, type: "boolean" } },
				state: { evidenceIncomplete, request, response, toolOutputs },
			}),
			"Grounded claims evaluation unavailable"
		);

		return { unsupported: evaluation.answers.unsupported.probability };
	})
	.generateScore(({ results }) => (results.analyzeStepResult.unsupported < 0.8 ? 1 : 0))
	.generateReason(({ score }) =>
		score === 1
			? "No clear unsupported business or document claim was detected; this score does not prove factual accuracy."
			: "Inspect this trace for a claim unsupported by the request or successful tool results."
	);

const localeScores = { matches: 1, mismatch: 0, unclear: 0.5 };

export const dashboardLocaleScorer = createScorer({
	description: "Sample whether the response is written in the language of the user's locale.",
	id: "dashboard-answered-in-user-locale",
	type: "agent",
})
	.analyze(async ({ run }) => {
		const locale = localeContextSchema.safeParse(
			run.requestContext instanceof RequestContext ? run.requestContext.all : run.requestContext
		).data?.locale;

		if (!locale) {
			throw new Error("Locale scoring requires the request locale");
		}

		const { request, response } = getRequiredRunTexts(run);

		const evaluation = requireEvaluation(
			await evaluateDecision({
				functionId: "dashboard-locale-match",
				policy: "background",
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
				state: { locale, request, response },
			}),
			"Locale evaluation unavailable"
		);

		return { choice: evaluation.answers.locale.choice };
	})
	.generateScore(({ results }) => localeScores[results.analyzeStepResult.choice])
	.generateReason(({ results }) =>
		results.analyzeStepResult.choice === "mismatch"
			? "Inspect this trace: the response language does not match the user's locale."
			: `Response language judged as ${results.analyzeStepResult.choice} for the user's locale.`
	);

export const dashboardChatAgent = new Agent({
	defaultOptions: {
		maxSteps: 20,
		prepareStep: async ({ messages, requestContext, systemMessages }) => {
			const context = appContextSchema.parse(requestContext?.all);
			const role = await requireOrganizationPermission({ ...context, permission: "read" });
			const canWrite = hasOrganizationPermission({ permission: "write", role });
			const canDelete = hasOrganizationPermission({ permission: "delete", role });

			const activeTools = getDashboardActiveTools(messages, context.approvalContinuation === true, {
				routedReference: context.routedReference,
				routedSkill: context.routedSkill,
			}).filter(
				(name) => (canDelete || !destructiveTools.has(name)) && (canWrite || !isDashboardMutationToolName(name))
			);

			const restrictions = [
				canDelete &&
					"The user may perform all changes, including deletions, after required reads and approvals.",
				canWrite &&
					!canDelete &&
					"The user may read, create, update, and publish, but cannot delete or remove content, unpublish, replace templates, regenerate layouts, or clear logic. editWebsite and buildWebsite allow only non-destructive edits.",
				!canWrite && "The user has read-only access. Do not request approval or attempt any modification.",
			]
				.filter(Boolean)
				.join(" ");

			return {
				activeTools,
				systemMessages: [
					...systemMessages.filter(
						(message) => !(message.role === "system" && message.content.startsWith(capabilityContextPrefix))
					),
					{
						content: `${capabilityContextPrefix}${activeTools.join(", ")}. ${restrictions} Availability also depends on the skill's fresh-read requirements. composeWebsiteSection stays unavailable until this turn has read inspectWebsite scope "reference" and scope "context" for the same page and index. An available editing tool does not authorize every edit. Approval never overrides permissions. If access prevents a requested change, briefly explain that their current role does not allow that change and an owner can help. Do not expose tool names, IDs, or internal access checks to the user. Never claim a change is prepared or saved without the corresponding tool result.`,
						role: "system",
					},
				],
			};
		},
		toolCallConcurrency: { limit: 6, strategy: "called" },
	},
	description: "Organization-scoped dashboard assistant for knowledge, Brand, Links, and website work.",
	id: "dashboard-chat-agent",
	inputProcessors: async () => [await createDashboardWorkingMemoryProcessor()],
	instructions: ({ requestContext }) =>
		[dashboardChatSystemPrompt, dashboardChatCurrentUserPrompt(requestContext.get("currentUser"))]
			.filter(Boolean)
			.join("\n\n"),
	maxProcessorRetries: websiteAuthoringRetryLimit,
	memory: dashboardChatMemory,
	model: ({ requestContext }) => {
		if (requestContext.get("useVisionModel")) {
			return models.vision.model;
		}

		return requestContext.get("modelTier") === "simple" &&
			!requestContext.get("websiteEditor") &&
			!requestContext.get("approvalContinuation")
			? [{ model: models.cheapFast.model, providerOptions: models.cheapFast.providerOptions }]
			: models.websiteAuthoring.model;
	},
	name: "Dashboard Chat Agent",
	outputProcessors: [websiteAuthoringProcessor],
	requestContextSchema: appContextSchema,
	scorers: {
		answeredInUserLocale: { sampling: { rate: 0.1, type: "ratio" }, scorer: dashboardLocaleScorer },
		claimedActionWithoutTool: { sampling: { rate: 0.1, type: "ratio" }, scorer: dashboardClaimedActionScorer },
		followedEmbeddedInstructions: {
			sampling: { rate: 0.1, type: "ratio" },
			scorer: dashboardEmbeddedInstructionsScorer,
		},
		groundedClaims: { sampling: { rate: 0.1, type: "ratio" }, scorer: dashboardGroundedClaimsScorer },
		noToolErrors: { sampling: { rate: 1, type: "ratio" }, scorer: dashboardNoToolErrorsScorer },
		responseRelevance: { sampling: { rate: 0.1, type: "ratio" }, scorer: dashboardResponseRelevanceScorer },
	},
	skills: dashboardSkills,
	tools: dashboardChatTools,
});
