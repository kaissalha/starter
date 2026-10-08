import { toAISdkStream } from "@mastra/ai-sdk";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const decision = vi.hoisted(() => vi.fn());

const generateCopy = vi.hoisted(() => vi.fn());

const warn = vi.hoisted(() => vi.fn());

const info = vi.hoisted(() => vi.fn());

vi.mock("../../src/ai/decisions", () => ({ evaluateDecision: decision }));

vi.mock("../../src/services/websites/composed-copy", () => ({ generateComposedCopy: generateCopy }));

vi.mock("@starter/observability", () => ({ log: { info, warn } }));

import { websiteAuthoringProcessor, websiteAuthoringRetryLimit } from "../../src/ai/website-authoring-processor";
import {
	composeWebsiteSectionProviderInputSchema,
	composeWebsiteSectionToolContract,
} from "../../src/ai/website-contracts";
import { narrowMastraUIStream } from "../../src/api/chat-stream-narrow";

type ProviderInput = z.infer<typeof composeWebsiteSectionProviderInputSchema>;

const validInput = composeWebsiteSectionToolContract.inputExamples[0]!.input;

const invalidInput = {
	...validInput,
	structure: {
		...validInput.structure,
		nodes: validInput.structure.nodes.map((node) =>
			node.key === "surface" ? { ...node, props: { ...node.props, background: "tint" } } : node
		),
	},
};

type NodeProps = Record<string, string | number | { base: number; compact: number } | undefined>;

const withNodes = (overrides: Record<string, NodeProps>): Draft => ({
	...validInput,
	structure: {
		...validInput.structure,
		nodes: validInput.structure.nodes.map((node) =>
			overrides[node.key] ? { ...node, props: { ...node.props, ...overrides[node.key] } } : node
		),
	},
});

const blockingDiagnosticInput = withNodes({ frame: { columns: 3 } });

const softInput = withNodes({ story: { gap: "2rem" } });

const usage = {
	inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 1, total: 1 },
	outputTokens: { reasoning: 0, text: 1, total: 1 },
};

type Inspected = { reference?: { filler: string }; scope: string; texts?: Array<{ value: string }> };

type Draft = Omit<typeof validInput, "structure"> & { structure: { nodes: Array<object>; root: string } };

const toolCallStream = (input: Draft | { scope: string }) => ({
	stream: convertArrayToReadableStream([
		{ type: "stream-start" as const, warnings: [] },
		{
			input: JSON.stringify(input),
			toolCallId: crypto.randomUUID(),
			toolName: "scope" in input ? "inspectWebsite" : "composeWebsiteSection",
			type: "tool-call" as const,
		},
		{ finishReason: { raw: "tool_calls", unified: "tool-calls" as const }, type: "finish" as const, usage },
	]),
});

const textStream = () => ({
	stream: convertArrayToReadableStream([
		{ type: "stream-start" as const, warnings: [] },
		{ id: "text", type: "text-start" as const },
		{ delta: "Added.", id: "text", type: "text-delta" as const },
		{ id: "text", type: "text-end" as const },
		{ finishReason: { raw: "stop", unified: "stop" as const }, type: "finish" as const, usage },
	]),
});

const unsupportedAnswers = (probability: number) => ({
	answers: Object.fromEntries(
		Object.keys(validInput.copy).map((_, index) => [`copy${index}`, { probability, type: "boolean" }])
	),
});

const runAgent = async (drafts: Array<Draft | { scope: string }>, inspected: Record<string, Inspected> = {}) => {
	const executed: Array<ProviderInput> = [];
	const prompts: Array<string> = [];
	const responses = [...drafts.map(toolCallStream), textStream()];

	const agent = new Agent({
		id: "authoring-test",
		instructions: "Compose sections.",
		maxProcessorRetries: websiteAuthoringRetryLimit,
		model: new MockLanguageModelV4({
			doStream: async ({ prompt }) => {
				prompts.push(JSON.stringify(prompt));

				return responses.shift() ?? textStream();
			},
		}),
		name: "Authoring test",
		outputProcessors: [websiteAuthoringProcessor],
		tools: {
			composeWebsiteSection: createTool({
				description: composeWebsiteSectionToolContract.description,
				execute: async (input: ProviderInput) => {
					executed.push(input);

					return { saved: true };
				},
				id: "compose-website-section",
				inputSchema: composeWebsiteSectionProviderInputSchema,
			}),
			inspectWebsite: createTool({
				description: "Inspect.",
				execute: async ({ scope }) => inspected[scope] ?? {},
				id: "inspect-website",
				inputSchema: z.object({ scope: z.string() }),
			}),
		},
	});

	const output = await agent.stream("Add a studio section.", { maxSteps: 10 });
	await output.consumeStream();
	const toolResults = await output.toolResults;

	return { executed, prompts, toolResults };
};

describe("website authoring processor", () => {
	beforeEach(() => {
		generateCopy.mockReset();
		vi.unstubAllEnvs();
		decision.mockReset();
		warn.mockReset();
		info.mockReset();
		decision.mockResolvedValue(unsupportedAnswers(0.1));
	});

	it("replays an invalid draft with targeted feedback so only the corrected draft executes", async () => {
		const { executed, prompts } = await runAgent([invalidInput, validInput]);

		expect(executed).toHaveLength(1);
		expect(JSON.stringify(executed[0])).not.toContain('"background"');
		expect(prompts[1]).toContain("props.background");
		expect(prompts[1]).toContain("Rejected draft");
	});

	it("asks for a targeted rewrite of copy that states unsupplied business facts", async () => {
		decision.mockResolvedValueOnce(unsupportedAnswers(0.9));
		const { executed, prompts } = await runAgent([validInput, validInput]);

		expect(executed).toHaveLength(1);
		expect(prompts[1]).toContain("copy body, heading, visit-label states business facts nobody supplied");
	});

	it("fails open without a decision, logs the skipped check, and leaves an exhausted retry to tool validation", async () => {
		decision.mockResolvedValue(null);
		expect((await runAgent([validInput])).executed).toHaveLength(1);
		expect(warn).toHaveBeenCalledWith(
			expect.objectContaining({
				copyKeys: Object.keys(validInput.copy),
				message: expect.stringContaining("did not run"),
				toolName: "composeWebsiteSection",
			})
		);

		const exhausted = await runAgent([invalidInput, invalidInput, invalidInput, invalidInput, invalidInput]);
		expect(exhausted.executed).toHaveLength(0);
		expect(JSON.stringify(exhausted.toolResults)).toContain("props.background");
	});

	it("names the node key, rule, and fix for a blocking diagnostic", async () => {
		const { executed, prompts } = await runAgent([blockingDiagnosticInput, validInput]);

		expect(executed).toHaveLength(1);
		expect(prompts[1]).toContain("[column-overflow]");
		expect(prompts[1]).toContain(String.raw`Grid \"frame\" props.columns`);
		expect(prompts[1]).toContain("Fix: Set columns");
		expect(prompts[1]).toContain(String.raw`nodes[\"frame\"]`);
	});

	it("allows three blocking repairs, never a fourth, and logs each attempt", async () => {
		const { prompts } = await runAgent(Array.from({ length: 6 }, () => blockingDiagnosticInput));

		expect(prompts.join("")).toContain("repair attempt 3 of 3");
		expect(info.mock.calls.map(([entry]) => entry.phase).slice(0, 4)).toEqual([
			"blocking",
			"blocking",
			"blocking",
			"exhausted",
		]);
	});

	it("reports soft quality issues once and accepts the improved draft", async () => {
		const { executed, prompts } = await runAgent([softInput, validInput]);

		expect(executed).toEqual([expect.objectContaining({ structure: validInput.structure })]);
		expect(prompts[1]).toContain("[off-scale-spacing]");
		expect(prompts[1]).toContain("Fix: Express every padding");
		expect(info.mock.calls.map(([entry]) => entry.phase)).toEqual(["soft", "soft-accepted"]);
	});

	it("does not run a second soft turn when the improvement keeps the same warnings", async () => {
		const { executed, prompts } = await runAgent([softInput, softInput]);
		expect(executed).toHaveLength(1);
		expect(info.mock.calls.filter(([entry]) => entry.phase === "soft")).toHaveLength(1);
		expect(prompts).toHaveLength(3);
	});

	it("falls back to the last valid draft when the soft turn makes it invalid", async () => {
		const { executed, prompts } = await runAgent([softInput, invalidInput, softInput]);

		expect(executed).toHaveLength(1);
		expect(JSON.stringify(executed[0])).toContain("2rem");
		expect(prompts[2]).toContain("exactly this earlier valid draft");
		expect(info.mock.calls.map(([entry]) => entry.phase)).toEqual(["soft", "restore"]);
	});

	it("falls back when the soft turn adds warnings", async () => {
		const worse = {
			...withNodes({ body: { maxInlineSize: undefined }, story: { gap: "2rem" } }),
			copy: { ...validInput.copy, body: { ar: "ن ".repeat(200), en: "word ".repeat(80) } },
		};

		const { executed, prompts } = await runAgent([softInput, worse, softInput]);

		expect(prompts.some((prompt) => prompt.includes("exactly this earlier valid draft"))).toBe(true);
		expect(executed).toHaveLength(1);
		expect(executed[0]?.copy.body).toEqual(validInput.copy.body);
	});

	it("checks both locales per key under the background policy in one decision", async () => {
		await runAgent([validInput]);

		expect(decision).toHaveBeenCalledTimes(1);
		const call = decision.mock.calls[0]![0];
		expect(call.policy).toBe("background");
		expect(Object.keys(call.questions)).toHaveLength(Object.keys(validInput.copy).length);
		expect(call.state.copy.body).toEqual({ ar: validInput.copy.body.ar, en: validInput.copy.body.en });
		expect(call.questions.copy0.instructions).toContain("Arabic");
	});

	it("keeps facts and requests in the decision state, dropping reference payloads and truncating whole items", async () => {
		await runAgent([{ scope: "texts" }, { scope: "reference" }, validInput], {
			reference: { reference: { filler: "r".repeat(30_000) }, scope: "reference" },
			texts: { scope: "texts", texts: [{ value: "Open since 2009" }, { value: "y".repeat(30_000) }] },
		});

		const state = decision.mock.calls[0]![0].state;
		const serialized = JSON.stringify(state);
		expect(serialized).toContain("Open since 2009");
		expect(serialized).toContain("Add a studio section.");
		expect(serialized).not.toContain("rrrrrrrr");
		expect(serialized).not.toContain("y".repeat(401));
		expect(serialized).toContain("…");
		expect(serialized.length).toBeLessThan(32_000);
	});

	it("splits large copy into bounded decisions", async () => {
		const keys = Array.from({ length: 40 }, (_, index) => `extra${index}`);

		const copy = {
			...validInput.copy,
			...Object.fromEntries(keys.map((key) => [key, { ar: `${key} ن `.repeat(90), en: `${key} e `.repeat(90) }])),
		};

		const body = validInput.structure.nodes.find((node) => node.key === "body")!;

		const nodes: Array<object> = [
			...validInput.structure.nodes.map((node) =>
				node.type === "flex" ? { ...node, children: [...node.children, ...keys] } : node
			),
			...keys.map((key) => ({ ...body, key, props: { ...body.props, content: key } })),
		];

		await runAgent([{ ...validInput, copy, structure: { ...validInput.structure, nodes } }]);

		expect(decision.mock.calls.length).toBeGreaterThan(1);
		decision.mock.calls.forEach(([call]) => {
			expect(JSON.stringify(call.state).length + JSON.stringify(call.questions).length).toBeLessThan(32_000);
		});
	});

	describe("copy split", () => {
		const placeholderInput: Draft = {
			...validInput,
			copy: {
				body: { ar: "نص", en: "Body note" },
				heading: { ar: "عنوان", en: "Heading note" },
				"visit-label": { ar: "زر", en: "Button note" },
			},
		};

		const filled = {
			copy: {
				body: { ar: "نصنع كل قطعة يدويا.", en: "Every piece is made by hand." },
				heading: { ar: "فرن واحد", en: "One kiln" },
				"visit-label": { ar: "احجز زيارة", en: "Book a visit" },
			},
			images: validInput.images,
		};

		it("never calls the copywriter while the flag is off", async () => {
			const { executed } = await runAgent([placeholderInput]);

			expect(generateCopy).not.toHaveBeenCalled();
			expect(executed[0]?.copy.heading.en).toBe("Heading note");
		});

		it("executes the copywriter's copy once the structure validates", async () => {
			vi.stubEnv("WEBSITE_AUTHORING_COPY_SPLIT", "1");
			generateCopy.mockResolvedValue(filled);

			const { executed } = await runAgent([placeholderInput]);

			expect(generateCopy).toHaveBeenCalledTimes(1);
			expect(executed).toHaveLength(1);
			expect(executed[0]?.copy.heading.en).toBe("One kiln");
		});

		it("runs the copywriter only after structural repair succeeds and not again on later replays", async () => {
			vi.stubEnv("WEBSITE_AUTHORING_COPY_SPLIT", "1");
			generateCopy.mockResolvedValue(filled);
			decision.mockResolvedValueOnce(unsupportedAnswers(0.9)).mockResolvedValue(unsupportedAnswers(0.1));

			const { executed } = await runAgent([
				{ ...invalidInput, copy: placeholderInput.copy },
				placeholderInput,
				validInput,
			]);

			expect(generateCopy).toHaveBeenCalledTimes(1);
			expect(executed).toHaveLength(1);
		});

		it("asks the model for final copy when the copywriter fails", async () => {
			vi.stubEnv("WEBSITE_AUTHORING_COPY_SPLIT", "1");
			generateCopy.mockResolvedValue(null);

			const { executed, prompts } = await runAgent([placeholderInput, validInput]);

			expect(generateCopy).toHaveBeenCalledTimes(1);
			expect(prompts[1]).toContain("copywriter was unavailable");
			expect(executed).toHaveLength(1);
			expect(executed[0]?.copy.heading.en).toBe(validInput.copy.heading.en);
		});
	});

	it("never streams the tool call of a step the processor rejected", async () => {
		const responses = [softInput, validInput].map(toolCallStream);

		const agent = new Agent({
			id: "authoring-stream-test",
			instructions: "Compose sections.",
			maxProcessorRetries: websiteAuthoringRetryLimit,
			model: new MockLanguageModelV4({ doStream: async () => responses.shift() ?? textStream() }),
			name: "Authoring stream test",
			outputProcessors: [websiteAuthoringProcessor],
			tools: {
				composeWebsiteSection: createTool({
					description: "Compose.",
					execute: async () => ({ saved: true }),
					id: "compose-website-section",
					inputSchema: composeWebsiteSectionProviderInputSchema,
					requireApproval: true,
				}),
			},
		});

		const output = await agent.stream("Add a studio section.", { maxSteps: 10 });
		const toolChunks = new Array<{ toolCallId: string; type: string }>();

		for await (const chunk of narrowMastraUIStream(toAISdkStream(output, { from: "agent", version: "v7" }))) {
			if ("toolCallId" in chunk) {
				toolChunks.push({ toolCallId: chunk.toolCallId, type: chunk.type });
			}
		}

		expect(new Set(toolChunks.map(({ toolCallId }) => toolCallId)).size).toBe(1);
		expect(toolChunks.map(({ type }) => type)).toEqual(["tool-input-available", "tool-approval-request"]);
	});
});
