import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	cancelWebsiteWorkflowRun: vi.fn(),
	claimWebsiteWorkflowRun: vi.fn(),
	logInfo: vi.fn(),
	start: vi.fn(),
}));

vi.mock("@starter/observability", () => ({ log: { info: mocks.logInfo } }));

vi.mock("workflow/api", () => ({ start: mocks.start }));

vi.mock("../../src/services/websites/languages", () => ({}));

vi.mock("../../src/services/websites/service", async (importOriginal) => ({
	...(await importOriginal()),
	claimWebsiteWorkflowRun: mocks.claimWebsiteWorkflowRun,
}));

vi.mock("../../src/services/websites/workflow-stream", () => ({
	cancelWebsiteWorkflowRun: mocks.cancelWebsiteWorkflowRun,
}));

import {
	WebsiteGenerationConflictError,
	WebsiteSectionAdditionConflictError,
} from "../../src/services/websites/service";
import { startWebsiteGeneration, startWebsiteSectionAddition } from "../../src/workflows/start";

const generationInput = {
	brief: { location: "Toronto", name: "Northstar", schemaVersion: 1 as const, type: "Design studio" },
	expectedRunId: null,
	organizationId: "organization-1",
	websiteId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d",
};

const templateChangeInput = {
	...generationInput,
	expectedUpdatedAt: "2026-08-22T12:00:00.000Z",
	templateId: "nordic-edge",
};

const sectionInput = {
	expectedRunId: "previous-run",
	expectedUpdatedAt: "2026-08-22T12:00:00.000Z",
	input: {
		index: 2,
		pageId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d330",
		pattern: "feature-grid",
		schemaVersion: 1 as const,
	},
	organizationId: "organization-1",
	websiteId: generationInput.websiteId,
};

beforeEach(() => {
	vi.clearAllMocks();
	mocks.start.mockResolvedValue({ runId: "run-new" });
	mocks.claimWebsiteWorkflowRun.mockResolvedValue({ workflowRunId: "run-new" });
});

describe("website workflow start", () => {
	it("starts and atomically claims website generation", async () => {
		await expect(startWebsiteGeneration(generationInput)).resolves.toEqual({
			websiteId: generationInput.websiteId,
			workflowRunId: "run-new",
		});

		expect(mocks.claimWebsiteWorkflowRun).toHaveBeenCalledWith({
			...generationInput,
			kind: "generation",
			runId: "run-new",
		});

		expect(mocks.cancelWebsiteWorkflowRun).not.toHaveBeenCalled();

		expect(mocks.logInfo).toHaveBeenCalledWith({
			kind: "generation",
			message: "Website workflow started",
			organizationId: "organization-1",
			websiteId: generationInput.websiteId,
			workflowRunId: "run-new",
		});
	});

	it("starts a template change through the generation workflow", async () => {
		await startWebsiteGeneration(templateChangeInput);

		expect(mocks.claimWebsiteWorkflowRun).toHaveBeenCalledWith({
			brief: templateChangeInput.brief,
			expectedRunId: templateChangeInput.expectedRunId,
			expectedUpdatedAt: templateChangeInput.expectedUpdatedAt,
			kind: "template-change",
			organizationId: templateChangeInput.organizationId,
			runId: "run-new",
			websiteId: templateChangeInput.websiteId,
		});
	});

	it("starts and atomically claims a section addition", async () => {
		await expect(startWebsiteSectionAddition(sectionInput)).resolves.toEqual({
			websiteId: sectionInput.websiteId,
			workflowRunId: "run-new",
		});

		expect(mocks.claimWebsiteWorkflowRun).toHaveBeenCalledWith({
			expectedRunId: sectionInput.expectedRunId,
			expectedUpdatedAt: sectionInput.expectedUpdatedAt,
			kind: "section-addition",
			organizationId: sectionInput.organizationId,
			runId: "run-new",
			websiteId: sectionInput.websiteId,
		});

		expect(mocks.cancelWebsiteWorkflowRun).not.toHaveBeenCalled();
	});

	it.each([
		["generation", () => startWebsiteGeneration(generationInput), WebsiteGenerationConflictError],
		["section addition", () => startWebsiteSectionAddition(sectionInput), WebsiteSectionAdditionConflictError],
	])("cancels an unclaimed %s run", async (_kind, startWorkflow, ConflictError) => {
		mocks.claimWebsiteWorkflowRun.mockResolvedValue(null);

		await expect(startWorkflow()).rejects.toBeInstanceOf(ConflictError);
		expect(mocks.cancelWebsiteWorkflowRun).toHaveBeenCalledWith({ runId: "run-new" });
	});

	it("cancels a started run when the ownership claim throws", async () => {
		const error = new Error("database unavailable");
		mocks.claimWebsiteWorkflowRun.mockRejectedValue(error);

		await expect(startWebsiteGeneration(generationInput)).rejects.toBe(error);
		expect(mocks.cancelWebsiteWorkflowRun).toHaveBeenCalledWith({ runId: "run-new" });
	});
});
