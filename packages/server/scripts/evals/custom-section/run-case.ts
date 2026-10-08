import { noopObserve } from "@mastra/core/tools";
import type { Schema } from "ai";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

import { resolveLocalizedPageSlug } from "@starter/infinite-website/editing";

import { dashboardChatAgent } from "../../../src/ai/agent";
import { editWebsiteTools } from "../../../src/ai/tools/edit-website";
import { createDashboardChatRequestContext, type DashboardChatUIMessage } from "../../../src/ai/types";
import { websiteAuthoringProcessor } from "../../../src/ai/website-authoring-processor";
import {
	composeWebsiteSectionProviderInputSchema,
	composeWebsiteSectionToolContract,
} from "../../../src/ai/website-contracts";
import { loadChatTurnContext, resolveDashboardRoute } from "../../../src/api/chat-stream-context";
import { categoriesFor, type EvalCase } from "./corpus";
import { readSeededWebsite, seedWebsite } from "./in-memory-website";
import { computeStaticMetrics, jsonRecordSchema } from "./metrics";
import { estimateCostUsd, getPricing } from "./pricing";
import { closeBrowser, renderAndCheck } from "./render-checks";

export { closeBrowser };

export const authoringModelId = "openai/gpt-6-luna";

const toolArgumentsSchema = jsonRecordSchema.or(z.unknown().transform(() => ({})));

const failureText = z
	.union([
		z.instanceof(Error).transform(({ message }) => message),
		z.string(),
		z.unknown().transform(() => "unknown failure"),
	])
	.transform((text) => text.slice(0, 1500));

const suspendedToolSchema = z.looseObject({ toolName: z.string() });

const toolFailureSchema = z.looseObject({ error: z.unknown().optional() });

const authoringToolNames = new Set(["buildWebsite", "composeWebsiteSection"]);

type ProcessorTrace = {
	args: z.infer<typeof toolArgumentsSchema>;
	reason: string | null;
	rejected: boolean;
	tool: string;
};

const traces = new Map<string, Array<ProcessorTrace>>();

const originalProcessOutputStep = websiteAuthoringProcessor.processOutputStep?.bind(websiteAuthoringProcessor);

websiteAuthoringProcessor.processOutputStep = async (input) => {
	const chatId = z.string().safeParse(input.requestContext?.get("chatId")).data;
	const calls = (input.toolCalls ?? []).filter(({ toolName }) => authoringToolNames.has(toolName));

	if (!originalProcessOutputStep) {
		return input.messages;
	}

	if (!chatId || calls.length === 0) {
		return originalProcessOutputStep(input);
	}

	const entries = calls.map<ProcessorTrace>(({ args, toolName }) => ({
		args: toolArgumentsSchema.parse(args),
		reason: null,
		rejected: false,
		tool: toolName,
	}));

	traces.set(chatId, [...(traces.get(chatId) ?? []), ...entries]);

	try {
		return await originalProcessOutputStep({
			...input,
			abort: (reason, options) => {
				for (const entry of entries) {
					entry.rejected = true;
					entry.reason = reason ?? null;
				}

				return input.abort(reason, options);
			},
		});
	} finally {
		calls.forEach(({ args }, index) => {
			const entry = entries[index];

			if (entry) {
				entry.args = toolArgumentsSchema.parse(args);
			}
		});
	}
};

const isValid = async <Input>(schema: Schema, input: Input) => (await schema.validate?.(input))?.success === true;

const userMessage = (text: string): DashboardChatUIMessage => ({
	id: crypto.randomUUID(),
	parts: [{ text, type: "text" }],
	role: "user",
});

const prepareWebsite = (evalCase: EvalCase) => {
	const organizationId = `eval-${evalCase.id}-${crypto.randomUUID()}`;

	const store = seedWebsite({
		organizationId,
		removeCategories: categoriesFor(evalCase.intent),
		templateId: evalCase.templateId,
	});

	const { document } = store.snapshot;
	const home = document.structure.pages.find((page) => page.home) ?? document.structure.pages[0];

	if (!home) {
		throw new Error("Template has no page");
	}

	const insertionIndex = Math.floor(home.sections.length / 2);

	const websiteEditor = {
		locale: evalCase.locale,
		pageId: home.id,
		pageSlug: resolveLocalizedPageSlug({
			content: document.content,
			defaultLocale: document.defaultLocale,
			locale: evalCase.locale,
			pageId: home.id,
		}),
		sectionId: home.sections[insertionIndex - 1]?.id,
		websiteId: store.id,
	};

	const route = resolveDashboardRoute({
		decision: {
			answers: {
				needsKnowledge: { probability: 0, type: "boolean" },
				route: { choice: "website-compose", type: "choice" },
				tier: { choice: "full", type: "choice" },
			},
		},
		editorBound: true,
		hasImageAttachment: false,
	});

	const requestContext = createDashboardChatRequestContext({
		chatId: organizationId,
		currentUser: { name: "Eval User" },
		locale: evalCase.locale,
		modelTier: "full",
		organizationId,
		routedReference: route.routedReference,
		routedSkill: route.routedSkill,
		userId: "eval-user",
		websiteEditor,
	});

	return { insertionIndex, organizationId, requestContext, route, websiteEditor };
};

type Preparation = ReturnType<typeof prepareWebsite>;

const converse = async ({ preparation, text }: { preparation: Preparation; text: string }) => {
	const turn = userMessage(text);

	const context = loadChatTurnContext({
		editor: { websiteEditor: preparation.websiteEditor },
		route: preparation.route,
		uiMessages: [turn],
	});

	try {
		const stream = await dashboardChatAgent.stream([turn], {
			context: [{ content: context, role: "system" }],
			requestContext: preparation.requestContext,
		});

		return { failure: null, output: await stream.getFullOutput() };
	} catch (error) {
		return { failure: `agent: ${failureText.parse(error)}`, output: null };
	}
};

type Turn = Awaited<ReturnType<typeof converse>>;

const collectToolFailures = (turns: Array<Turn>) =>
	turns.flatMap(({ output }) =>
		(output?.steps ?? []).flatMap(({ toolResults }) =>
			toolResults.flatMap(({ payload }) =>
				payload.isError || toolFailureSchema.safeParse(payload.result).data?.error
					? [`${payload.toolName}: ${failureText.parse(JSON.stringify(payload.result))}`]
					: []
			)
		)
	);

const sumUsage = (turns: Array<Turn>) => ({
	cachedInputTokens: turns.reduce((sum, { output }) => sum + (output?.totalUsage.cachedInputTokens ?? 0), 0),
	inputTokens: turns.reduce((sum, { output }) => sum + (output?.totalUsage.inputTokens ?? 0), 0),
	outputTokens: turns.reduce((sum, { output }) => sum + (output?.totalUsage.outputTokens ?? 0), 0),
});

const materialize = async ({
	accepted,
	preparation,
}: {
	accepted: ProcessorTrace | undefined;
	preparation: Preparation;
}) => {
	if (!accepted) {
		return { error: null, section: null };
	}

	try {
		const input = composeWebsiteSectionProviderInputSchema.safeParse(accepted.args);

		if (!input.success) {
			throw new Error("Accepted draft failed provider validation");
		}

		const homeSections = () =>
			readSeededWebsite(preparation.organizationId).snapshot.document.structure.pages.find(({ home }) => home)
				?.sections ?? [];

		const existingIds = new Set(homeSections().map(({ id }) => id));
		await editWebsiteTools.composeWebsiteSection.execute?.(input.data, {
			observe: noopObserve,
			requestContext: preparation.requestContext,
		});
		const sections = homeSections();
		const index = sections.findIndex(({ id }) => !existingIds.has(id));
		const section = sections[index];

		return { error: null, section: section ? { id: section.id, index } : null };
	} catch (error) {
		return { error: failureText.parse(error), section: null };
	}
};

const renderSection = async ({
	caseDir,
	evalCase,
	organizationId,
	sectionId,
}: {
	caseDir: string;
	evalCase: EvalCase;
	organizationId: string;
	sectionId: string;
}) => {
	try {
		return {
			error: null,
			render: await renderAndCheck({
				locale: evalCase.locale,
				outDir: caseDir,
				sectionId,
				snapshot: readSeededWebsite(organizationId).snapshot,
			}),
		};
	} catch (error) {
		return { error: failureText.parse(error), render: null };
	}
};

const statusOf = ({
	attempts,
	materialized,
	suspendedTools,
}: {
	attempts: number;
	materialized: boolean;
	suspendedTools: Array<string | null>;
}) => {
	if (materialized) {
		return "composed";
	}

	if (attempts > 0) {
		return "invalid";
	}

	return suspendedTools.includes("addWebsiteSection") ? "catalog" : "no-compose";
};

export const runCase = async ({ evalCase, runDir }: { evalCase: EvalCase; runDir: string }) => {
	const caseDir = path.join(runDir, "cases", evalCase.id);
	mkdirSync(caseDir, { recursive: true });
	const preparation = prepareWebsite(evalCase);
	const { insertionIndex, organizationId } = preparation;
	const startedAt = performance.now();
	const turns = [await converse({ preparation, text: evalCase.request })];

	const composeTraceOf = () =>
		(traces.get(organizationId) ?? []).filter(({ tool }) => tool === "composeWebsiteSection");

	const clarified = composeTraceOf().length === 0;

	if (clarified) {
		turns.push(
			await converse({ preparation, text: `${evalCase.request}. decide the details yourself, no questions` })
		);
	}

	const latencyMs = Math.round(performance.now() - startedAt);

	const processorTrace = traces.get(organizationId) ?? [];
	const composeTrace = composeTraceOf();

	const validations = await Promise.all(
		composeTrace.map(async (entry) => ({
			entry,
			valid: await isValid(composeWebsiteSectionToolContract.inputSchema, entry.args),
		}))
	);

	const accepted = validations.findLast(({ entry, valid }) => valid && !entry.rejected)?.entry;
	const first = validations[0];
	const composed = await materialize({ accepted, preparation });

	const rendered = composed.section
		? await renderSection({ caseDir, evalCase, organizationId, sectionId: composed.section.id })
		: { error: null, render: null };

	const usage = sumUsage(turns);
	const failures = [...turns.flatMap(({ failure }) => (failure ? [failure] : [])), ...collectToolFailures(turns)];
	const steps = turns.flatMap(({ output }) => output?.steps ?? []);

	const result = {
		composeAttempts: composeTrace.length,
		copySplit: process.env.WEBSITE_AUTHORING_COPY_SPLIT === "1",
		costUsd: estimateCostUsd({ pricing: await getPricing(authoringModelId), usage }),
		executionError: composed.error,
		failures,
		finalText: turns
			.map(({ output }) => output?.text ?? "")
			.join("\n---\n")
			.slice(0, 800),
		finalValid: composed.section !== null,
		firstAttemptValid: first ? first.valid && !first.entry.rejected : null,
		firstSchemaValid: first ? first.valid : null,
		firstTurnComposed: !clarified,
		id: evalCase.id,
		intent: evalCase.intent,
		latencyMs,
		locale: evalCase.locale,
		metrics: accepted ? computeStaticMetrics({ args: accepted.args, traits: evalCase.traits }) : null,
		placement: composed.section
			? {
					expected: insertionIndex,
					followedSelection: composed.section.index === insertionIndex,
					inserted: composed.section.index,
				}
			: null,
		processorRejections: composeTrace.flatMap(({ reason }) => (reason ? [reason.slice(0, 500)] : [])),
		processorReplays: composeTrace.filter(({ rejected }) => rejected).length,
		render: rendered.render,
		renderError: rendered.error,
		request: evalCase.request,
		status: statusOf({
			attempts: composeTrace.length,
			materialized: composed.section !== null,
			suspendedTools: turns.map(
				({ output }) => suspendedToolSchema.safeParse(output?.suspendPayload).data?.toolName ?? null
			),
		}),
		stepCount: steps.length,
		templateId: evalCase.templateId,
		tokens: {
			cachedInput: usage.cachedInputTokens,
			input: usage.inputTokens,
			output: usage.outputTokens,
		},
		tools: steps.flatMap(({ toolCalls }) => toolCalls.map(({ payload }) => payload.toolName)),
		turns: turns.map(({ output }) => ({
			error: output?.error?.message ?? null,
			finishReason: output?.finishReason ?? null,
			stepFinishReasons: output?.steps.map((step) => step.finishReason ?? "unknown") ?? [],
			suspendedTool: suspendedToolSchema.safeParse(output?.suspendPayload).data?.toolName ?? null,
			tripwire: output?.tripwire?.reason ?? null,
		})),
	};

	writeFileSync(
		path.join(caseDir, "case.json"),
		JSON.stringify({ ...result, acceptedArguments: accepted?.args ?? null, trace: processorTrace }, null, 2)
	);

	return result;
};

export type CaseResult = Awaited<ReturnType<typeof runCase>>;
