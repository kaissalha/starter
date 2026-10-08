import { beforeEach, describe, expect, it, vi } from "vitest";

const steps = vi.hoisted(() => ({
	assembleWebsiteLayoutGenerationStep: vi.fn(),
	bindWebsiteWorkflow: vi.fn(),
	markWebsiteWorkflowFailed: vi.fn(),
	prepareWebsiteLayoutGenerationStep: vi.fn(),
	resolveWebsiteLayoutGenerationMedia: vi.fn(),
	saveWebsiteWorkflow: vi.fn(),
	websiteGenerationLocales: ["en", "ar"],
	writeWebsiteLayoutGeneration: vi.fn(),
	writeWebsiteLayoutLocalization: vi.fn(),
}));

vi.mock("../../src/workflows/generate-website-layout/steps", () => steps);

import { generateWebsiteLayoutWorkflow } from "../../src/workflows/generate-website-layout";

const input = {
	expectedRunId: null,
	expectedUpdatedAt: "2026-08-22T12:00:00.000Z",
	input: {
		pattern: "banner-bottom-card",
		schemaVersion: 1 as const,
		target: {
			area: "page" as const,
			index: 0,
			pageId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d330",
			sectionId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d331",
		},
	},
	organizationId: "organization-1",
	websiteId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d",
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("generate website layout workflow", () => {
	it("resolves media alongside both localizations and persists only after both finish", async () => {
		const prepared = { operation: "prepared", preparation: { missingTextPointers: ["/copy/heading"] } };
		const section = { operation: "content" };
		const assetBindings = { "asset-1": { src: "/image.jpg", type: "image" } };
		const generated = { site: { operation: "persisted" } };
		const localization = Promise.withResolvers<void>();
		steps.prepareWebsiteLayoutGenerationStep.mockResolvedValue(prepared);
		steps.writeWebsiteLayoutLocalization.mockImplementation(async ({ locale }) => {
			await localization.promise;

			return { locale, status: "valid" };
		});
		steps.writeWebsiteLayoutGeneration.mockResolvedValue(section);
		steps.resolveWebsiteLayoutGenerationMedia.mockResolvedValue(assetBindings);
		steps.assembleWebsiteLayoutGenerationStep.mockResolvedValue(generated);

		const workflow = generateWebsiteLayoutWorkflow(input);

		await vi.waitFor(() => expect(steps.resolveWebsiteLayoutGenerationMedia).toHaveBeenCalledWith({ prepared }));
		expect(steps.writeWebsiteLayoutGeneration).not.toHaveBeenCalled();

		localization.resolve();
		await workflow;

		expect(steps.bindWebsiteWorkflow).toHaveBeenCalledWith({
			expectedRunId: input.expectedRunId,
			expectedUpdatedAt: input.expectedUpdatedAt,
			kind: "layout-generation",
			organizationId: input.organizationId,
			websiteId: input.websiteId,
		});

		expect(steps.writeWebsiteLayoutLocalization.mock.calls.map(([{ locale }]) => locale)).toEqual(["en", "ar"]);

		expect(steps.writeWebsiteLayoutGeneration).toHaveBeenCalledWith({
			localizations: [
				{ locale: "en", status: "valid" },
				{ locale: "ar", status: "valid" },
			],
			prepared,
		});

		expect(steps.resolveWebsiteLayoutGenerationMedia).toHaveBeenCalledWith({ prepared });
		expect(steps.assembleWebsiteLayoutGenerationStep).toHaveBeenCalledWith({ assetBindings, prepared, section });

		expect(steps.saveWebsiteWorkflow).toHaveBeenCalledWith({
			organizationId: input.organizationId,
			websiteId: input.websiteId,
			...generated,
		});

		expect(steps.markWebsiteWorkflowFailed).not.toHaveBeenCalled();
	});

	it("skips localization steps when the selected layout already has complete copy", async () => {
		const prepared = { operation: "prepared", preparation: { missingTextPointers: [] } };
		const section = { operation: "content" };
		const assetBindings = { "asset-1": { src: "/image.jpg", type: "image" } };
		const generated = { site: { operation: "persisted" } };
		steps.prepareWebsiteLayoutGenerationStep.mockResolvedValue(prepared);
		steps.writeWebsiteLayoutGeneration.mockResolvedValue(section);
		steps.resolveWebsiteLayoutGenerationMedia.mockResolvedValue(assetBindings);
		steps.assembleWebsiteLayoutGenerationStep.mockResolvedValue(generated);

		await generateWebsiteLayoutWorkflow(input);

		expect(steps.writeWebsiteLayoutLocalization).not.toHaveBeenCalled();
		expect(steps.writeWebsiteLayoutGeneration).toHaveBeenCalledWith({
			localizations: [
				{ fields: [], locale: "en", status: "valid" },
				{ fields: [], locale: "ar", status: "valid" },
			],
			prepared,
		});
		expect(steps.assembleWebsiteLayoutGenerationStep).toHaveBeenCalledWith({ assetBindings, prepared, section });
		expect(steps.saveWebsiteWorkflow).toHaveBeenCalledOnce();
	});

	it("settles in-flight copy before reporting a media failure", async () => {
		const error = new Error("media failed");
		const localization = Promise.withResolvers<void>();
		steps.prepareWebsiteLayoutGenerationStep.mockResolvedValue({
			operation: "prepared",
			preparation: { missingTextPointers: ["/copy/heading"] },
		});
		steps.writeWebsiteLayoutLocalization.mockImplementation(async ({ locale }) => {
			await localization.promise;

			return { locale, status: "valid" };
		});
		steps.writeWebsiteLayoutGeneration.mockResolvedValue({ operation: "content" });
		steps.resolveWebsiteLayoutGenerationMedia.mockRejectedValue(error);

		const workflow = generateWebsiteLayoutWorkflow(input);

		await vi.waitFor(() => expect(steps.resolveWebsiteLayoutGenerationMedia).toHaveBeenCalledOnce());
		expect(steps.markWebsiteWorkflowFailed).not.toHaveBeenCalled();

		localization.resolve();
		await expect(workflow).rejects.toBe(error);

		expect(steps.markWebsiteWorkflowFailed).toHaveBeenCalledWith({
			code: "LAYOUT_GENERATION_FAILED",
			errorMessage: "media failed",
			organizationId: input.organizationId,
			websiteId: input.websiteId,
		});
		expect(steps.assembleWebsiteLayoutGenerationStep).not.toHaveBeenCalled();
		expect(steps.saveWebsiteWorkflow).not.toHaveBeenCalled();
	});

	it("marks failure without saving a partial layout", async () => {
		const error = new Error("provider failed");
		steps.prepareWebsiteLayoutGenerationStep.mockResolvedValue({
			operation: "prepared",
			preparation: { missingTextPointers: ["/copy/heading"] },
		});
		steps.writeWebsiteLayoutLocalization.mockRejectedValue(error);
		steps.resolveWebsiteLayoutGenerationMedia.mockResolvedValue({});

		await expect(generateWebsiteLayoutWorkflow(input)).rejects.toBe(error);

		expect(steps.markWebsiteWorkflowFailed).toHaveBeenCalledWith({
			code: "LAYOUT_GENERATION_FAILED",
			errorMessage: "provider failed",
			organizationId: input.organizationId,
			websiteId: input.websiteId,
		});

		expect(steps.writeWebsiteLayoutGeneration).not.toHaveBeenCalled();
		expect(steps.saveWebsiteWorkflow).not.toHaveBeenCalled();
	});
});
