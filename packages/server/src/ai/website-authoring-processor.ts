import type { MastraDBMessage } from "@mastra/core/agent";
import type { OutputProcessor, ProcessOutputStepArgs } from "@mastra/core/processors";
import { z } from "zod";

import { log, serializeLogError } from "@starter/observability";

import { generateComposedCopy } from "../services/websites/composed-copy";
import { evaluateDecision } from "./decisions";
import {
	buildWebsiteToolContract,
	composeWebsiteSectionToolContract,
	diagnoseComposeToolInput,
	websiteCopySchema,
} from "./website-contracts";
import { applyComposedCopy, isWebsiteCopySplitEnabled } from "./website-copy-split";

const blockingRepairLimit = 3;

const softImprovementLimit = 1;

const restoreLimit = 1;

export const websiteAuthoringRetryLimit = blockingRepairLimit + softImprovementLimit + restoreLimit;

const unsupportedCopyThreshold = 0.7;

const authoringContracts = [
	["buildWebsite", buildWebsiteToolContract.inputSchema],
	["composeWebsiteSection", composeWebsiteSectionToolContract.inputSchema],
] as const;

const findAuthoringSchema = (toolName: string) => authoringContracts.find(([name]) => name === toolName)?.[1];

const authoringCopySchema = z.compile(z.looseObject({ copy: websiteCopySchema.optional() }));

const evidenceCharacters = 14_000;

const requestCharacters = 2000;

const factCharacters = 400;

const copyValueCharacters = 400;

const copyChunkCharacters = 9000;

const walkDepth = 8;

const skippedScopes = new Set(["catalog", "reference"]);

const skippedKeys = new Set(["diagnostics", "logic", "props", "reference", "structure"]);

const jsonSchema = z.json();

const jsonRecordSchema = z.record(z.string(), jsonSchema);

const resultScopeSchema = z.looseObject({ scope: z.string().optional() });

type Json = z.infer<typeof jsonSchema>;

const truncate = (value: string, limit: number) => (value.length <= limit ? value : `${value.slice(0, limit - 1)}…`);

const collectFacts = ({ depth, label, value }: { depth: number; label: string; value: Json }): Array<string> => {
	if (depth >= walkDepth) {
		return [];
	}

	if (z.string().safeParse(value).success) {
		const text = String(value).trim();

		return text.length >= 3 ? [`${label}: ${truncate(text, factCharacters)}`] : [];
	}

	if (Array.isArray(value)) {
		return value.flatMap((item) => collectFacts({ depth: depth + 1, label, value: item }));
	}

	const record = jsonRecordSchema.safeParse(value).data;

	if (!record || skippedScopes.has(resultScopeSchema.safeParse(record).data?.scope ?? "")) {
		return [];
	}

	return Object.entries(record).flatMap(([key, item]) =>
		skippedKeys.has(key) ? [] : collectFacts({ depth: depth + 1, label: key, value: item })
	);
};

const collectEvidence = ({
	messages,
	steps,
}: {
	messages: Array<MastraDBMessage>;
	steps: Array<{ toolResults?: Array<{ output?: unknown; toolName: string }> }>;
}) => {
	const requests = messages.flatMap(({ content, role }) =>
		role === "user" ? content.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])) : []
	);

	const results = [
		...messages.flatMap(({ content }) =>
			content.parts.flatMap((part) =>
				part.type === "tool-invocation" && part.toolInvocation.state === "result"
					? [part.toolInvocation.result]
					: []
			)
		),
		...steps.flatMap(({ toolResults = [] }) => toolResults.map(({ output }) => output)),
	];

	const facts = [
		...new Set(
			results.toReversed().flatMap((result) => {
				const value = jsonSchema.safeParse(result);

				return value.success ? collectFacts({ depth: 0, label: "result", value: value.data }) : [];
			})
		),
	];

	const budget = { used: 0 };

	return {
		facts: facts.filter((fact) => {
			budget.used += fact.length;

			return budget.used <= evidenceCharacters;
		}),
		requests: requests.slice(-6).map((request) => truncate(request, requestCharacters)),
	};
};

type CopyEntry = [string, { ar: string; en: string }];

const chunkCopy = (copy: Array<CopyEntry>) =>
	copy.reduce<Array<{ entries: Array<CopyEntry>; size: number }>>((chunks, entry) => {
		const size = JSON.stringify(entry).length + 260;
		const last = chunks.at(-1);

		if (last && last.size + size <= copyChunkCharacters) {
			last.entries.push(entry);
			last.size += size;

			return chunks;
		}

		return [...chunks, { entries: [entry], size }];
	}, []);

const findUnsupportedCopy = async ({
	abortSignal,
	args,
	evidence,
	toolName,
}: {
	abortSignal?: AbortSignal;
	args: unknown;
	evidence: ReturnType<typeof collectEvidence>;
	toolName: string;
}) => {
	const copy = Object.entries(authoringCopySchema.safeParse(args).data?.copy ?? {});

	const results = await Promise.all(
		chunkCopy(copy).map(async ({ entries: chunk }) => {
			const evaluation = await evaluateDecision({
				abortSignal,
				functionId: "website-authoring-unsupported-copy",
				policy: "background",
				questions: Object.fromEntries(
					chunk.map(([key], index) => [
						`copy${index}`,
						{
							instructions: `Does the English or Arabic copy "${key}" state a specific business fact (price, number, duration, schedule, rating, guarantee, credential, staff, included deliverable, or policy) supported by neither the user requests nor the facts? Invitations, restated supplied facts, translations of supplied facts, and existing website text are supported.`,
							type: "boolean" as const,
						},
					])
				),
				state: {
					...evidence,
					copy: Object.fromEntries(
						chunk.map(([key, value]) => [
							key,
							{
								ar: truncate(value.ar, copyValueCharacters),
								en: truncate(value.en, copyValueCharacters),
							},
						])
					),
				},
			});

			if (!evaluation) {
				await log.warn({
					copyKeys: chunk.map(([key]) => key),
					functionId: "website-authoring-unsupported-copy",
					message: "Website authoring unsupported-facts check did not run; draft allowed",
					toolName,
				});

				return [];
			}

			return chunk.flatMap(([key], index) => {
				const answer = evaluation.answers[`copy${index}`];

				return answer?.type === "boolean" && answer.probability >= unsupportedCopyThreshold ? [key] : [];
			});
		})
	);

	return results.flat();
};

const authoringRunSchema = z.looseObject({
	blocking: z.number().default(0),
	copied: z.boolean().default(false),
	fallback: z.object({ draft: z.string(), soft: z.number(), toolName: z.string() }).optional(),
	restored: z.boolean().default(false),
	softUsed: z.boolean().default(false),
});

type AuthoringRun = z.infer<typeof authoringRunSchema>;

const issueCodes = (issues: Array<string>) => [
	...new Set(issues.flatMap((issue) => [...issue.matchAll(/\[([a-z][a-z-]+)\]/gu)].map(([, code]) => code ?? ""))),
];

const logAttempt = async ({
	attempt,
	codes,
	phase,
	retryCount,
	toolName,
}: {
	attempt: number;
	codes: Array<string>;
	phase: "soft-accepted" | "blocking" | "exhausted" | "restore" | "soft";
	retryCount: number;
	toolName: string;
}) =>
	log.info({
		attempt,
		codes,
		functionId: "website-authoring-retry",
		message: `Website authoring ${phase}`,
		phase,
		retryCount,
		toolName,
	});

const validateCalls = (calls: Array<{ args: unknown; toolName: string }>) =>
	Promise.all(
		calls.map(async ({ args, toolName }) => {
			const validated = await findAuthoringSchema(toolName)?.validate?.(args);

			return validated && !validated.success
				? `${toolName}: ${validated.error.message}\nRejected draft: ${JSON.stringify(args)}`
				: null;
		})
	);

const findUnsupportedIssues = (
	calls: Array<{ args: unknown; toolName: string }>,
	{ abortSignal, evidence }: { abortSignal?: AbortSignal; evidence: ReturnType<typeof collectEvidence> }
) =>
	Promise.all(
		calls.map(async ({ args, toolName }) => {
			const keys = await findUnsupportedCopy({ abortSignal, args, evidence, toolName });

			return keys.length > 0
				? `${toolName}: [unsupported-facts] copy ${keys.join(", ")} states business facts nobody supplied. Fix: use only supplied facts or rewrite them as invitations.\nRejected draft: ${JSON.stringify(args)}`
				: null;
		})
	);

const fillComposedCopy = async ({
	abortSignal,
	call,
	evidence,
	messages,
}: {
	abortSignal?: AbortSignal;
	call: { args: unknown; toolCallId: string };
	evidence: ReturnType<typeof collectEvidence>;
	messages: Array<MastraDBMessage>;
}) => {
	try {
		const validated = await composeWebsiteSectionToolContract.inputSchema.validate?.(call.args);

		if (!validated?.success) {
			return false;
		}

		const generated = await generateComposedCopy({ abortSignal, evidence, input: validated.value });

		if (!generated || !applyComposedCopy({ args: call.args, ...generated })) {
			return false;
		}

		messages.forEach(({ content }) =>
			content.parts.forEach((part) => {
				if (part.type === "tool-invocation" && part.toolInvocation.toolCallId === call.toolCallId) {
					part.toolInvocation.args = call.args;
				}
			})
		);

		return true;
	} catch (error) {
		await log.warn({
			error: serializeLogError(error),
			functionId: "website-composed-copy",
			message: "Website composed copy step failed",
		});

		return false;
	}
};

const splitComposedCopy = async ({
	abort,
	abortSignal,
	calls,
	canRetry,
	evidence,
	messages,
	run,
	save,
}: {
	abort: ProcessOutputStepArgs["abort"];
	abortSignal?: AbortSignal;
	calls: Array<{ args: unknown; toolCallId: string; toolName: string }>;
	canRetry: boolean;
	evidence: ReturnType<typeof collectEvidence>;
	messages: Array<MastraDBMessage>;
	run: AuthoringRun;
	save: () => void;
}) => {
	const [call] = calls;

	if (
		!isWebsiteCopySplitEnabled() ||
		run.copied ||
		calls.length !== 1 ||
		call?.toolName !== "composeWebsiteSection"
	) {
		return [];
	}

	run.copied = true;
	save();

	if (await fillComposedCopy({ abortSignal, call, evidence, messages })) {
		return (await validateCalls(calls)).filter(Boolean);
	}

	if (canRetry) {
		abort(
			"The copywriter was unavailable and nothing was saved. Call composeWebsiteSection once with the same draft, replacing every placeholder note with final specific English and Arabic copy for every key and image alt.",
			{ retry: true }
		);
	}

	return [];
};

export const websiteAuthoringProcessor: OutputProcessor = {
	id: "website-authoring",
	processOutputStep: async ({ abort, abortSignal, messages, retryCount, state, steps, toolCalls = [] }) => {
		const calls = toolCalls.filter(({ toolName }) => findAuthoringSchema(toolName));

		if (calls.length === 0) {
			return messages;
		}

		const run: AuthoringRun = authoringRunSchema.parse(state.authoring ?? {});

		const save = () => {
			state.authoring = run;
		};

		const toolName = calls.map((call) => call.toolName).join(",");
		const canRetry = retryCount < websiteAuthoringRetryLimit;
		const evaluatingSoftTurn = run.fallback !== undefined && !run.restored;

		const restore = async () => {
			if (!run.fallback || run.restored || !canRetry) {
				return false;
			}

			run.restored = true;
			save();
			await logAttempt({ attempt: 1, codes: [], phase: "restore", retryCount, toolName });
			abort(
				`The improved draft was worse than the previous valid draft, so it was discarded and nothing was saved. Call ${run.fallback.toolName} once with exactly this earlier valid draft and change nothing:\n${run.fallback.draft}`,
				{ retry: true }
			);

			return true;
		};

		const evidence = collectEvidence({ messages, steps });
		const initialIssues = (await validateCalls(calls)).filter(Boolean);

		const invalid =
			initialIssues.length > 0
				? initialIssues
				: await splitComposedCopy({ abort, abortSignal, calls, canRetry, evidence, messages, run, save });

		if (invalid.length > 0) {
			if (evaluatingSoftTurn) {
				await restore();
			}

			if (run.blocking >= blockingRepairLimit || !canRetry) {
				await logAttempt({
					attempt: run.blocking,
					codes: issueCodes(invalid),
					phase: "exhausted",
					retryCount,
					toolName,
				});

				return messages;
			}

			run.blocking += 1;
			save();
			await logAttempt({
				attempt: run.blocking,
				codes: issueCodes(invalid),
				phase: "blocking",
				retryCount,
				toolName,
			});
			abort(
				`The draft was rejected before approval and nothing was saved (repair attempt ${run.blocking} of ${blockingRepairLimit}). Call the same tool once with the rejected draft, changing only what these issues name and applying each Fix, and keep every other node, prop, copy value, image, and link exactly as drafted:\n${invalid.join("\n")}`,
				{ retry: true }
			);
		}

		const unsupported = (await findUnsupportedIssues(calls, { abortSignal, evidence })).filter(Boolean);

		if (unsupported.length > 0) {
			if (run.blocking >= blockingRepairLimit || !canRetry) {
				await logAttempt({
					attempt: run.blocking,
					codes: ["unsupported-facts"],
					phase: "exhausted",
					retryCount,
					toolName,
				});

				return messages;
			}

			run.blocking += 1;
			save();
			await logAttempt({
				attempt: run.blocking,
				codes: ["unsupported-facts"],
				phase: "blocking",
				retryCount,
				toolName,
			});
			abort(
				`The draft was rejected before approval and nothing was saved (repair attempt ${run.blocking} of ${blockingRepairLimit}). Call the same tool once with the rejected draft, changing only what these issues name and applying each Fix, and keep every other node, prop, copy value, image, and link exactly as drafted:\n${unsupported.join("\n")}`,
				{ retry: true }
			);
		}

		const [composeCall] = calls;

		if (calls.length !== 1 || composeCall?.toolName !== "composeWebsiteSection") {
			return messages;
		}

		const soft = (await diagnoseComposeToolInput(composeCall.args)).filter(({ severity }) => severity === "soft");

		if (evaluatingSoftTurn) {
			if (run.fallback && soft.length > run.fallback.soft) {
				await restore();
			}

			await logAttempt({
				attempt: 1,
				codes: soft.map(({ code }) => code),
				phase: "soft-accepted",
				retryCount,
				toolName,
			});

			return messages;
		}

		if (soft.length > 0 && !run.softUsed && canRetry) {
			run.softUsed = true;
			run.fallback = {
				draft: JSON.stringify(composeCall.args),
				soft: soft.length,
				toolName: composeCall.toolName,
			};
			save();
			await logAttempt({ attempt: 1, codes: soft.map(({ code }) => code), phase: "soft", retryCount, toolName });
			abort(
				`The draft is valid but has quality warnings; nothing was saved. Call the same tool once with an improved draft that fixes these warnings and changes nothing else; if you cannot improve it, resend the draft unchanged:\n${soft
					.map(({ code, fix, message }) => `[${code}] ${message} Fix: ${fix}`)
					.join("\n")}`,
				{ retry: true }
			);
		}

		return messages;
	},
};
