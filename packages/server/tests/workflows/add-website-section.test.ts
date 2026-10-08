import { beforeEach, describe, expect, it, vi } from "vitest";

const steps = vi.hoisted(() => ({
	assembleWebsiteSectionAdditionStep: vi.fn(),
	bindWebsiteWorkflow: vi.fn(),
	markWebsiteWorkflowFailed: vi.fn(),
	prepareWebsiteSectionAdditionStep: vi.fn(),
	resolveWebsiteSectionAdditionMedia: vi.fn(),
	saveWebsiteWorkflow: vi.fn(),
	websiteGenerationLocales: ["en", "ar"],
	writeWebsiteSectionAddition: vi.fn(),
	writeWebsiteSectionAdditionLocalization: vi.fn(),
}));

vi.mock("../../src/workflows/add-website-section/steps", () => steps);

import { addWebsiteSectionWorkflow } from "../../src/workflows/add-website-section";

const input = {
	expectedRunId: null,
	expectedUpdatedAt: "2026-08-22T12:00:00.000Z",
	input: {
		index: 0,
		pageId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d330",
		pattern: "hero-centered",
		schemaVersion: 1 as const,
	},
	organizationId: "organization-1",
	websiteId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d",
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("add website section workflow", () => {
	it("resolves media alongside both localizations and persists only after both finish", async () => {
		const prepared = { operation: "prepared" };
		const materialized = { operation: "content" };
		const assetBindings = { "asset-1": { src: "/image.jpg", type: "image" } };
		const generated = { site: { operation: "persisted" } };
		const localization = Promise.withResolvers<void>();
		steps.prepareWebsiteSectionAdditionStep.mockResolvedValue(prepared);

		steps.writeWebsiteSectionAdditionLocalization.mockImplementation(async ({ locale }) => {
			await localization.promise;

			return { locale, status: "valid" };
		});

		steps.writeWebsiteSectionAddition.mockResolvedValue(materialized);
		steps.resolveWebsiteSectionAdditionMedia.mockResolvedValue(assetBindings);
		steps.assembleWebsiteSectionAdditionStep.mockResolvedValue(generated);

		const workflow = addWebsiteSectionWorkflow(input);

		await vi.waitFor(() => expect(steps.resolveWebsiteSectionAdditionMedia).toHaveBeenCalledWith({ prepared }));
		expect(steps.writeWebsiteSectionAddition).not.toHaveBeenCalled();

		localization.resolve();
		await workflow;

		expect(steps.bindWebsiteWorkflow).toHaveBeenCalledWith({
			expectedRunId: input.expectedRunId,
			expectedUpdatedAt: input.expectedUpdatedAt,
			kind: "section-addition",
			organizationId: input.organizationId,
			websiteId: input.websiteId,
		});

		expect(steps.writeWebsiteSectionAdditionLocalization.mock.calls.map(([{ locale }]) => locale)).toEqual([
			"en",
			"ar",
		]);

		expect(steps.writeWebsiteSectionAddition).toHaveBeenCalledWith({
			input,
			localizations: [
				{ locale: "en", status: "valid" },
				{ locale: "ar", status: "valid" },
			],
			prepared,
		});

		expect(steps.resolveWebsiteSectionAdditionMedia).toHaveBeenCalledWith({ prepared });

		expect(steps.assembleWebsiteSectionAdditionStep).toHaveBeenCalledWith({
			assetBindings,
			materialized,
			prepared,
		});

		expect(steps.saveWebsiteWorkflow).toHaveBeenCalledWith({
			organizationId: input.organizationId,
			websiteId: input.websiteId,
			...generated,
		});

		expect(steps.resolveWebsiteSectionAdditionMedia.mock.invocationCallOrder[0]).toBeLessThan(
			steps.writeWebsiteSectionAddition.mock.invocationCallOrder[0] ?? Infinity
		);

		expect(steps.assembleWebsiteSectionAdditionStep.mock.invocationCallOrder[0]).toBeLessThan(
			steps.saveWebsiteWorkflow.mock.invocationCallOrder[0] ?? Infinity
		);

		expect(steps.markWebsiteWorkflowFailed).not.toHaveBeenCalled();
	});

	it("settles in-flight copy before reporting a media failure", async () => {
		const error = new Error("media failed");
		const localization = Promise.withResolvers<void>();
		steps.prepareWebsiteSectionAdditionStep.mockResolvedValue({ operation: "prepared" });
		steps.writeWebsiteSectionAdditionLocalization.mockImplementation(async ({ locale }) => {
			await localization.promise;

			return { locale, status: "valid" };
		});
		steps.writeWebsiteSectionAddition.mockResolvedValue({ operation: "content" });
		steps.resolveWebsiteSectionAdditionMedia.mockRejectedValue(error);

		const workflow = addWebsiteSectionWorkflow(input);

		await vi.waitFor(() => expect(steps.resolveWebsiteSectionAdditionMedia).toHaveBeenCalledOnce());
		expect(steps.markWebsiteWorkflowFailed).not.toHaveBeenCalled();

		localization.resolve();
		await expect(workflow).rejects.toBe(error);

		expect(steps.markWebsiteWorkflowFailed).toHaveBeenCalledWith({
			code: "SECTION_ADDITION_FAILED",
			errorMessage: "media failed",
			organizationId: input.organizationId,
			websiteId: input.websiteId,
		});
		expect(steps.assembleWebsiteSectionAdditionStep).not.toHaveBeenCalled();
		expect(steps.saveWebsiteWorkflow).not.toHaveBeenCalled();
	});

	it("marks the operation failed without saving a partial candidate", async () => {
		const error = new Error("provider failed");
		steps.prepareWebsiteSectionAdditionStep.mockResolvedValue({ operation: "prepared" });
		steps.writeWebsiteSectionAdditionLocalization.mockRejectedValue(error);
		steps.resolveWebsiteSectionAdditionMedia.mockResolvedValue({});

		await expect(addWebsiteSectionWorkflow(input)).rejects.toBe(error);

		expect(steps.markWebsiteWorkflowFailed).toHaveBeenCalledWith({
			code: "SECTION_ADDITION_FAILED",
			errorMessage: "provider failed",
			organizationId: input.organizationId,
			websiteId: input.websiteId,
		});

		expect(steps.assembleWebsiteSectionAdditionStep).not.toHaveBeenCalled();
		expect(steps.writeWebsiteSectionAddition).not.toHaveBeenCalled();
		expect(steps.saveWebsiteWorkflow).not.toHaveBeenCalled();
	});
});
