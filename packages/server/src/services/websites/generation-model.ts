import {
	generateText,
	NoObjectGeneratedError,
	Output,
	type FlexibleSchema,
	type JSONValue,
	type LanguageModel,
} from "ai";
import type { Experimental_EvaluationModel } from "ai-evaluation";
import { jsonrepair } from "jsonrepair";
import { z } from "zod";

import {
	createGenerationTemplateBrand,
	drawNearBest,
	resolveWebsiteGenerationProfile,
	selectWebsiteGenerationProfile,
	validateWebsiteGenerationPlan,
	websiteGenerationProfiles,
	type Iso6391LanguageCode,
	type WebsiteBriefV1,
	type WebsiteGenerationPlan,
} from "@starter/infinite-website/generation";
import { log } from "@starter/observability";

import { evaluateDecision, type DecisionPolicy } from "../../ai/decisions";
import {
	createWebsiteGenerationPlanPrompt,
	createWebsiteGenerationProfileSelectionPrompt,
	createWebsiteGenerationProfileSelectionSchema,
	createWebsiteGenerationRepairPrompt,
	createWebsiteSectionOutputSchema,
	createWebsiteSectionPrompt,
	websiteGenerationPlanSchema,
} from "../../ai/prompts";
import { models } from "../../mastra/models";
import type { WebsiteSectionGenerationSlot } from "./generation-slots";

const languageDisplayNames = new Intl.DisplayNames(["en"], { type: "language" });

export const websiteLanguageName = (locale: Iso6391LanguageCode) => languageDisplayNames.of(locale) ?? locale;

const modelIdentitySchema = z.compile(
	z.union([z.string().transform((modelId) => ({ modelId })), z.object({ modelId: z.string() })])
);

const gatewayRoutingSchema = z.compile(
	z.looseObject({ canonicalSlug: z.string(), finalProvider: z.string(), modelAttemptCount: z.number() })
);

type EvaluationModel = Exclude<Experimental_EvaluationModel, string>;

type WebsiteObjectGenerationPrompt = {
	prompt: string;
	system: string;
};

type WebsiteProviderOptions = Record<string, Record<string, JSONValue>>;

export type WebsiteGenerationRepair = { invalidOutput: string; validationError: string };

type WebsiteObjectGenerationOptions<Generated> = {
	abortSignal?: AbortSignal;
	model: LanguageModel;
	prompt: WebsiteObjectGenerationPrompt;
	providerOptions?: WebsiteProviderOptions;
	schema: FlexibleSchema<Generated>;
	telemetryFunctionId: string;
};

export type WebsiteObjectGenerationResult<Generated> =
	| { output: Generated; status: "valid" }
	| ({ status: "repair" } & WebsiteGenerationRepair);

const generateWebsiteSchemaOutput = async <Generated>({
	abortSignal,
	model,
	prompt,
	providerOptions = models.websiteGeneration.providerOptions,
	schema,
	telemetryFunctionId,
}: WebsiteObjectGenerationOptions<Generated>) => {
	abortSignal?.throwIfAborted();
	const outputFormat = Output.object({ schema });
	const startedAt = performance.now();

	try {
		const { output, steps, totalUsage } = await generateText({
			abortSignal,
			maxOutputTokens: 12_000,
			model,
			output: outputFormat,
			prompt: prompt.prompt,
			providerOptions,
			reasoning: "none",
			system: prompt.system,
			telemetry: { functionId: telemetryFunctionId, recordInputs: false, recordOutputs: false },
		});

		abortSignal?.throwIfAborted();
		const routing = gatewayRoutingSchema.safeParse(steps.at(-1)?.providerMetadata?.gateway?.routing).data;

		await log.info({
			elapsedMs: performance.now() - startedAt,
			functionId: telemetryFunctionId,
			message: "Website model call completed",
			model: modelIdentitySchema.parse(model).modelId,
			modelAttemptCount: routing?.modelAttemptCount,
			modelCalls: steps.length,
			servedModel: routing?.canonicalSlug,
			servedProvider: routing?.finalProvider,
			usage: totalUsage,
		});

		return output;
	} catch (error) {
		abortSignal?.throwIfAborted();
		await log.info({
			elapsedMs: performance.now() - startedAt,
			functionId: telemetryFunctionId,
			message: "Website model call failed",
			model: modelIdentitySchema.parse(model).modelId,
			usage: NoObjectGeneratedError.isInstance(error) ? error.usage : undefined,
		});

		if (!NoObjectGeneratedError.isInstance(error)) {
			throw error;
		}

		if (!error.text || !error.response || !error.usage || !error.finishReason) {
			throw error;
		}

		try {
			const repaired = await outputFormat.parseCompleteOutput(
				{ text: jsonrepair(error.text) },
				{ finishReason: error.finishReason, response: error.response, usage: error.usage }
			);

			await log.info({
				elapsedMs: performance.now() - startedAt,
				functionId: telemetryFunctionId,
				message: "Website output recovered with JSON syntax repair",
				modelCalls: 0,
			});

			return repaired;
		} catch {
			throw error;
		}
	}
};

export const runWebsiteObjectGeneration = async <Generated>({
	abortSignal,
	model,
	prompt,
	providerOptions,
	repair,
	schema,
	telemetryFunctionId,
}: WebsiteObjectGenerationOptions<Generated> & {
	repair?: WebsiteGenerationRepair;
}): Promise<WebsiteObjectGenerationResult<Generated>> => {
	try {
		const output = await generateWebsiteSchemaOutput({
			abortSignal,
			model,
			prompt: repair ? createWebsiteGenerationRepairPrompt({ base: prompt, ...repair }) : prompt,
			providerOptions,
			schema,
			telemetryFunctionId: repair ? `${telemetryFunctionId}-repair` : telemetryFunctionId,
		});

		return { output, status: "valid" };
	} catch (error) {
		abortSignal?.throwIfAborted();

		if (repair || !NoObjectGeneratedError.isInstance(error)) {
			throw error;
		}

		return {
			invalidOutput: error.text ?? "",
			status: "repair",
			validationError: error.cause instanceof Error ? error.cause.message : error.message,
		};
	}
};

const listNumbers = (text: string) =>
	text
		.replaceAll(/[\u0660-\u0669\u06F0-\u06F9]/gu, (digit) => String(digit.codePointAt(0)! % 16))
		.match(/\d+(?:[.,]\d+)*/gu) ?? [];

export const findUnsupportedWebsiteFacts = ({ brief, values }: { brief: WebsiteBriefV1; values: Array<string> }) => {
	const supported = new Set([
		...listNumbers(
			JSON.stringify([brief.name, brief.type, brief.location, brief.details, brief.menu, brief.portfolio])
		),
		String(new Date().getFullYear()),
	]);

	return [...new Set(values.flatMap(listNumbers))].filter((number) => !supported.has(number));
};

export const generateWebsiteSection = async ({
	abortSignal,
	brief,
	generationSlot,
	language,
	model = models.websiteGeneration.model,
	plan,
	repair,
	templateName,
}: {
	abortSignal?: AbortSignal;
	brief: WebsiteBriefV1;
	generationSlot: WebsiteSectionGenerationSlot;
	language: string;
	model?: LanguageModel;
	plan: WebsiteGenerationPlan;
	repair?: WebsiteGenerationRepair;
	templateName: string;
}) => {
	if (generationSlot.promptSlot.fields.length === 0) {
		return { fields: [], status: "valid" as const };
	}

	const relevantPageKeys = new Set([
		generationSlot.slot.pageKey,
		...generationSlot.linkIntents.map(({ targetPageKey }) => targetPageKey),
	]);

	const pages =
		generationSlot.slot.area === "page"
			? plan.pages.filter(({ pageKey }) => relevantPageKeys.has(pageKey))
			: plan.pages.map(({ pageKey, title }) => ({ pageKey, title }));

	const generated = await runWebsiteObjectGeneration({
		abortSignal,
		model,
		prompt: createWebsiteSectionPrompt({
			brief,
			language,
			plan: { pages, siteDescription: plan.siteDescription },
			slot: generationSlot.promptSlot,
			templateName,
		}),
		repair,
		schema: createWebsiteSectionOutputSchema({ slot: generationSlot.promptSlot }),
		telemetryFunctionId: "website-section-generation",
	});

	if (generated.status !== "valid") {
		return generated;
	}

	const unsupportedFacts = findUnsupportedWebsiteFacts({
		brief,
		values: generated.output.fields.map(({ value }) => value),
	});

	if (unsupportedFacts.length > 0 && !repair) {
		return {
			invalidOutput: JSON.stringify(
				Object.fromEntries(
					generationSlot.promptSlot.fields.map(({ key }, index) => [
						key,
						generated.output.fields[index]?.value,
					])
				)
			),
			status: "repair" as const,
			validationError: `These numbers are not in the business brief: ${unsupportedFacts.join(", ")}. Remove them or describe the point qualitatively; never invent prices, years, counts, durations, or statistics.`,
		};
	}

	return { fields: generated.output.fields, status: "valid" as const };
};

export const selectWebsiteGenerationTemplate = async ({
	abortSignal,
	brief,
	model,
	policy,
}: {
	abortSignal?: AbortSignal;
	brief: WebsiteBriefV1;
	model?: EvaluationModel;
	policy?: DecisionPolicy;
}) => {
	const fallback = selectWebsiteGenerationProfile({ businessType: brief.type });

	const candidates = websiteGenerationProfiles.map(({ keywords, name, templateId }) => ({
		keywords,
		name,
		templateId,
	}));

	const prompt = createWebsiteGenerationProfileSelectionPrompt({ brief, candidates });

	const decision = await evaluateDecision({
		abortSignal,
		functionId: "website-template-selection",
		memoize: true,
		model,
		policy,
		questions: {
			template: {
				criteria: Object.fromEntries(candidates.map(({ name, templateId }) => [templateId, name])),
				instructions: prompt.system,
				type: "choice",
			},
		},
		state: prompt.prompt,
	});

	const selected = decision
		? createWebsiteGenerationProfileSelectionSchema({
				templateIds: candidates.map(({ templateId }) => templateId),
			}).safeParse({ templateId: decision.answers.template.choice }).data
		: undefined;

	await log.info({
		functionId: "website-template-selection",
		message: selected
			? "Website template evaluation completed"
			: "Website template evaluation used deterministic fallback",
		selectedProbability: selected ? decision?.answers.template.probabilities?.[selected.templateId] : undefined,
		templateId: selected?.templateId ?? fallback.templateId,
	});
	const probabilities = selected ? (decision?.answers.template.probabilities ?? null) : null;
	const templateId = selected?.templateId ?? fallback.templateId;

	const ranked = Object.entries(probabilities ?? {})
		.toSorted(([, left], [, right]) => right - left)
		.map(([id]) => id);

	return {
		probabilities,
		templateId,
		templateIds: [...new Set([templateId, ...ranked])].slice(0, 3),
		templateName:
			websiteGenerationProfiles.find((profile) => profile.templateId === templateId)?.name ?? templateId,
	};
};

export const selectWebsiteGenerationBrand = async ({
	abortSignal,
	brief,
	model,
	websiteId,
}: {
	abortSignal?: AbortSignal;
	brief: WebsiteBriefV1;
	model?: EvaluationModel;
	websiteId: string;
}) => {
	const { probabilities } = await selectWebsiteGenerationTemplate({
		abortSignal,
		brief,
		model,
		policy: "background",
	});

	const drawn = drawNearBest({
		candidates: Object.entries(probabilities ?? {}),
		seed: `${websiteId}:brand`,
		weight: ([, probability]) => probability,
	});

	const profile = websiteGenerationProfiles.find(({ templateId }) => templateId === drawn?.[0]);

	return profile ? createGenerationTemplateBrand({ locale: "en", profile }) : null;
};

export const generateWebsitePlan = async ({
	abortSignal,
	brief,
	locale,
	model = models.websiteGeneration.model,
	repair,
	templateId,
}: {
	abortSignal?: AbortSignal;
	brief: WebsiteBriefV1;
	locale: Iso6391LanguageCode;
	model?: LanguageModel;
	repair?: WebsiteGenerationRepair;
	templateId?: string;
}) => {
	const language = websiteLanguageName(locale);
	const pageKeys = templateId ? Object.keys(resolveWebsiteGenerationProfile({ brief, templateId }).pages) : undefined;

	const generated = await runWebsiteObjectGeneration({
		abortSignal,
		model,
		prompt: createWebsiteGenerationPlanPrompt({ brief, language, pageKeys }),
		repair,
		schema: websiteGenerationPlanSchema,
		telemetryFunctionId: "website-generation-plan",
	});

	if (generated.status !== "valid") {
		return { language, locale, ...generated };
	}

	const plan = validateWebsiteGenerationPlan({
		expectedPageKeys: pageKeys,
		plan: { kind: "plan", ...generated.output },
	});

	return { language, locale, plan, status: "valid" as const };
};
