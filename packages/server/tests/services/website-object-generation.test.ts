import { NoObjectGeneratedError } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { generateTextMock } = vi.hoisted(() => ({ generateTextMock: vi.fn() }));

vi.mock("ai", async (importOriginal) => ({
	...(await importOriginal<typeof import("ai")>()),
	generateText: generateTextMock,
}));

import { runWebsiteObjectGeneration } from "../../src/services/websites/generation-model";

const schema = z.strictObject({ value: z.string() });

const prompt = { prompt: "Untrusted input", system: "Stable instructions" };

const createNoObjectError = ({ cause = new Error("Invalid JSON"), text }: { cause?: Error; text: string }) =>
	new NoObjectGeneratedError({
		cause,
		finishReason: "stop",
		message: "Invalid object",
		response: { id: "response", modelId: "test-model", timestamp: new Date(0) },
		text,
		usage: {
			inputTokenDetails: { cacheReadTokens: 0, cacheWriteTokens: 0, noCacheTokens: 1 },
			inputTokens: 1,
			outputTokenDetails: { reasoningTokens: 0, textTokens: 1 },
			outputTokens: 1,
			totalTokens: 2,
		},
	});

beforeEach(() => {
	generateTextMock.mockReset();
});

describe("website object generation", () => {
	it.each([undefined, { invalidOutput: "{}", validationError: "Missing value" }])(
		"does not start cancelled generation or repairs: %j",
		async (repair) => {
			await expect(
				runWebsiteObjectGeneration({
					abortSignal: AbortSignal.abort(new Error("Preview cancelled")),
					model: "test-provider:test-model",
					prompt,
					repair,
					schema,
					telemetryFunctionId: "website-test",
				})
			).rejects.toThrow("Preview cancelled");
			expect(generateTextMock).not.toHaveBeenCalled();
		}
	);

	it("aborts in-flight provider work without turning cancellation into a repair", async () => {
		const controller = new AbortController();
		generateTextMock.mockImplementationOnce(({ abortSignal }: { abortSignal: AbortSignal }) => {
			controller.abort(new Error("Preview cancelled"));
			expect(abortSignal.aborted).toBe(true);
			throw createNoObjectError({ text: '{"value":' });
		});

		await expect(
			runWebsiteObjectGeneration({
				abortSignal: controller.signal,
				model: "test-provider:test-model",
				prompt,
				schema,
				telemetryFunctionId: "website-test",
			})
		).rejects.toThrow("Preview cancelled");
		expect(generateTextMock).toHaveBeenCalledOnce();
	});

	it("preserves structured output, private telemetry, and DeepSeek-first routing without our own deadline", async () => {
		generateTextMock.mockResolvedValue({ output: { value: "accepted" }, steps: [{}], totalUsage: {} });

		await expect(
			runWebsiteObjectGeneration({
				model: "test-provider:test-model",
				prompt,
				schema,
				telemetryFunctionId: "website-test-generation",
			})
		).resolves.toEqual({ output: { value: "accepted" }, status: "valid" });

		expect(generateTextMock).toHaveBeenCalledWith(
			expect.objectContaining({
				model: "test-provider:test-model",
				prompt: prompt.prompt,
				reasoning: "none",
				system: prompt.system,
				telemetry: {
					functionId: "website-test-generation",
					recordInputs: false,
					recordOutputs: false,
				},
			})
		);

		expect(generateTextMock.mock.calls[0]?.[0].abortSignal).toBeUndefined();
		expect(generateTextMock.mock.calls[0]?.[0]).not.toHaveProperty("maxRetries");
		expect(generateTextMock.mock.calls[0]?.[0].providerOptions).toMatchObject({
			deepseek: { thinking: { type: "disabled" } },
			gateway: { models: ["google/gemini-3.6-flash"], order: ["deepseek", "alibaba"] },
		});
	});

	it("repairs malformed model JSON locally before requesting a model repair", async () => {
		generateTextMock.mockRejectedValueOnce(createNoObjectError({ text: "```json\n{value: 'accepted'}\n```" }));

		await expect(
			runWebsiteObjectGeneration({
				model: "test-provider:test-model",
				prompt,
				schema,
				telemetryFunctionId: "website-test-generation",
			})
		).resolves.toEqual({ output: { value: "accepted" }, status: "valid" });

		expect(generateTextMock).toHaveBeenCalledOnce();
	});

	it("turns schema-generation failures into repair descriptors without hiding other errors", async () => {
		generateTextMock.mockRejectedValueOnce(
			createNoObjectError({ cause: new Error("Schema failed"), text: '{"value":' })
		);

		await expect(
			runWebsiteObjectGeneration({
				model: "test-provider:test-model",
				prompt,
				schema,
				telemetryFunctionId: "website-test-generation",
			})
		).resolves.toEqual({
			invalidOutput: '{"value":',
			status: "repair",
			validationError: "Schema failed",
		});

		generateTextMock.mockRejectedValueOnce(new Error("Provider unavailable"));

		await expect(
			runWebsiteObjectGeneration({
				model: "test-provider:test-model",
				prompt,
				schema,
				telemetryFunctionId: "website-test-generation",
			})
		).rejects.toThrow("Provider unavailable");
	});

	it("uses the repair prompt once and accepts its schema-valid output", async () => {
		generateTextMock.mockResolvedValue({ output: { value: "still invalid" }, steps: [{}], totalUsage: {} });

		await expect(
			runWebsiteObjectGeneration({
				model: "test-provider:test-model",
				prompt,
				repair: { invalidOutput: '{"value":"invalid"}', validationError: "Grounding failed" },
				schema,
				telemetryFunctionId: "website-test",
			})
		).resolves.toEqual({ output: { value: "still invalid" }, status: "valid" });

		expect(generateTextMock).toHaveBeenCalledTimes(1);

		expect(generateTextMock.mock.calls[0]?.[0]).toMatchObject({
			reasoning: "none",
			telemetry: {
				functionId: "website-test-repair",
				recordInputs: false,
				recordOutputs: false,
			},
		});

		expect(generateTextMock.mock.calls[0]?.[0].system).toContain("failed validation");
	});

	it("repairs malformed JSON returned by the targeted model repair", async () => {
		generateTextMock.mockRejectedValueOnce(createNoObjectError({ text: "{value: 'accepted'}" }));

		await expect(
			runWebsiteObjectGeneration({
				model: "test-provider:test-model",
				prompt,
				repair: { invalidOutput: '{"value":', validationError: "Invalid JSON" },
				schema,
				telemetryFunctionId: "website-test",
			})
		).resolves.toEqual({ output: { value: "accepted" }, status: "valid" });

		expect(generateTextMock).toHaveBeenCalledOnce();
	});
});
