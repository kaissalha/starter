import { beforeEach, describe, expect, it, vi } from "vitest";

const start = vi.hoisted(() => vi.fn());

vi.mock("workflow/api", () => ({ start }));

vi.mock("../../src/workflows/generate-blog-post", () => ({ generateBlogPostWorkflow: vi.fn() }));

const sleep = vi.hoisted(() => vi.fn());

vi.mock("workflow", () => ({ sleep }));

const steps = vi.hoisted(() => ({
	assembleWebsite: vi.fn(),
	bindWebsiteWorkflow: vi.fn(),
	markWebsiteWorkflowFailed: vi.fn(),
	prepareWebsite: vi.fn(),
	recordWebsiteGenerationTimeline: vi.fn(),
	resolveWebsiteMedia: vi.fn(),
	saveWebsiteWorkflow: vi.fn(),
	selectWebsiteBrand: vi.fn(),
	settleWebsiteMedia: vi.fn(),
	skipWebsiteSection: vi.fn(),
	writeWebsitePlan: vi.fn(),
	writeWebsiteSection: vi.fn(),
}));

vi.mock("../../src/workflows/generate-website/steps", () => steps);

import { generateWebsiteWorkflow } from "../../src/workflows/generate-website";

const input = {
	brief: { location: "Toronto", name: "Northstar", schemaVersion: 1 as const, type: "Design studio" },
	expectedRunId: null,
	organizationId: "organization-1",
	websiteId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d",
};

const preparation = {
	generationSlots: [
		{
			promptSlot: { fields: [] },
			slot: { area: "header", purpose: "Header", required: true, slotKey: "header" },
		},
		...Array.from({ length: 6 }, (_, index) => ({
			promptSlot: { fields: [{ key: "f0" }] },
			slot: {
				area: "page",
				pageKey: index < 4 ? "home" : "about",
				purpose: `Section ${index}`,
				required: index !== 2,
				slotKey: `slot-${index}`,
			},
		})),
		{
			promptSlot: { fields: [{ key: "f0" }] },
			slot: { area: "footer", purpose: "Footer", required: true, slotKey: "footer" },
		},
	],
	snapshot: { brand: { colors: {} }, document: { structure: { pages: [] } } },
	templateId: "custom",
};

const plans = [
	{ locale: "en", pages: [], status: "valid" },
	{ locale: "ar", pages: [], status: "valid" },
];

beforeEach(() => {
	vi.clearAllMocks();
	sleep.mockReturnValue(new Promise(() => {}));
	steps.resolveWebsiteMedia.mockResolvedValue({ assetBindings: {}, assets: [] });
	steps.selectWebsiteBrand.mockResolvedValue(null);
	steps.settleWebsiteMedia.mockResolvedValue({});
	steps.writeWebsitePlan.mockImplementation(async ({ locale }) => ({ locale, pages: [], status: "valid" }));
	steps.prepareWebsite.mockResolvedValue(preparation);
	steps.writeWebsiteSection.mockImplementation(async ({ generationSlot }) => ({
		slotKey: generationSlot.slot.slotKey,
	}));
	steps.assembleWebsite.mockResolvedValue({ site: { generated: "site" } });
});

describe("generate website workflow", () => {
	it("plans every locale and writes each section in one durable step, then saves and records the timeline", async () => {
		await generateWebsiteWorkflow(input);

		expect(steps.bindWebsiteWorkflow).toHaveBeenCalledWith({ kind: "generation", ...input });
		expect(steps.selectWebsiteBrand).toHaveBeenCalledWith(input);
		expect(steps.writeWebsitePlan.mock.calls.map(([{ locale }]) => locale)).toEqual(["en", "ar"]);
		expect(steps.resolveWebsiteMedia).toHaveBeenCalledWith({ brand: null, input, templateId: "custom" });
		expect(steps.prepareWebsite).toHaveBeenCalledWith({ brand: null, input, plans, templateId: "custom" });
		expect(steps.writeWebsiteSection.mock.calls.map(([{ generationSlot }]) => generationSlot.slot.slotKey)).toEqual(
			preparation.generationSlots.map(({ slot }) => slot.slotKey)
		);
		expect(steps.assembleWebsite).toHaveBeenCalledWith({
			assetBindings: {},
			preparation,
			sections: preparation.generationSlots.map(({ slot }) => ({ slotKey: slot.slotKey })),
			skippedSectionIds: [],
		});
		expect(steps.saveWebsiteWorkflow).toHaveBeenCalledWith({
			organizationId: input.organizationId,
			site: { generated: "site" },
			websiteId: input.websiteId,
		});
		expect(steps.recordWebsiteGenerationTimeline).toHaveBeenCalledWith(
			expect.objectContaining({
				counts: { locales: 2, modelCalls: 14, sections: 8, skippedSections: 0 },
				kind: "generation",
				outcome: "completed",
				stages: expect.objectContaining({
					assembled: expect.any(Number),
					bound: expect.any(Number),
					mediaSettled: expect.any(Number),
					plansWritten: expect.any(Number),
					prepared: expect.any(Number),
					saved: expect.any(Number),
					sectionsWritten: expect.any(Number),
				}),
			})
		);
		expect(start).toHaveBeenCalledWith(expect.any(Function), [
			expect.objectContaining({
				initialDraft: true,
				organizationId: input.organizationId,
				postId: input.websiteId,
			}),
		]);
		expect(steps.saveWebsiteWorkflow.mock.invocationCallOrder[0]).toBeLessThan(
			start.mock.invocationCallOrder[0] ?? Infinity
		);
		expect(steps.markWebsiteWorkflowFailed).not.toHaveBeenCalled();
	});

	it("starts every section at once while a slow section is still writing", async () => {
		const slowSection = Promise.withResolvers<{ slotKey: string }>();
		steps.writeWebsiteSection.mockImplementation(async ({ generationSlot }) =>
			generationSlot.slot.slotKey === "slot-0" ? slowSection.promise : { slotKey: generationSlot.slot.slotKey }
		);

		const workflow = generateWebsiteWorkflow(input);

		await vi.waitFor(() =>
			expect(steps.writeWebsiteSection).toHaveBeenCalledTimes(preparation.generationSlots.length)
		);
		expect(steps.assembleWebsite).not.toHaveBeenCalled();

		slowSection.resolve({ slotKey: "slot-0" });
		await workflow;

		expect(steps.assembleWebsite).toHaveBeenCalledOnce();
	});

	it("skips a failed optional section and still saves the remaining website", async () => {
		const optionalSlot = preparation.generationSlots[3];
		const optionalPreparation = { ...preparation, generationSlots: [optionalSlot] };
		steps.prepareWebsite.mockResolvedValue(optionalPreparation);
		steps.writeWebsiteSection.mockRejectedValue(new Error("optional model failed"));
		steps.skipWebsiteSection.mockResolvedValue("section-optional");

		await expect(generateWebsiteWorkflow(input)).resolves.toBeUndefined();

		expect(steps.skipWebsiteSection).toHaveBeenCalledWith({
			generationSlot: optionalSlot,
			preparation: optionalPreparation,
		});
		expect(steps.assembleWebsite).toHaveBeenCalledWith({
			assetBindings: {},
			preparation: optionalPreparation,
			sections: [],
			skippedSectionIds: ["section-optional"],
		});
		expect(steps.markWebsiteWorkflowFailed).not.toHaveBeenCalled();
	});

	it("fails a stranded generation at its durable deadline and never saves late results", async () => {
		const deadline = Promise.withResolvers<void>();
		const section = Promise.withResolvers<{ slotKey: string }>();
		sleep.mockReturnValue(deadline.promise);
		steps.prepareWebsite.mockResolvedValue({ ...preparation, generationSlots: [preparation.generationSlots[0]] });
		steps.writeWebsiteSection.mockReturnValue(section.promise);

		const workflow = generateWebsiteWorkflow(input);
		await vi.waitFor(() => expect(steps.writeWebsiteSection).toHaveBeenCalledOnce());
		deadline.resolve();
		await expect(workflow).rejects.toThrow("Website generation timed out after 5 minutes");

		expect(sleep).toHaveBeenCalledWith("5m");
		expect(steps.markWebsiteWorkflowFailed).toHaveBeenCalledWith({
			code: "GENERATION_FAILED",
			errorMessage: "Website generation timed out after 5 minutes",
			organizationId: input.organizationId,
			websiteId: input.websiteId,
		});

		section.resolve({ slotKey: "header" });
		await vi.waitFor(() => expect(steps.assembleWebsite).toHaveBeenCalledOnce());
		expect(steps.saveWebsiteWorkflow).not.toHaveBeenCalled();
		expect(start).not.toHaveBeenCalled();
	});

	it("marks a required-section failure and does not save a partial website", async () => {
		const error = new Error("model failed");
		steps.prepareWebsite.mockResolvedValue({ ...preparation, generationSlots: [preparation.generationSlots[0]] });
		steps.writeWebsiteSection.mockRejectedValue(error);

		await expect(generateWebsiteWorkflow(input)).rejects.toBe(error);

		expect(steps.recordWebsiteGenerationTimeline).toHaveBeenCalledWith(
			expect.objectContaining({
				outcome: "failed",
				stages: expect.objectContaining({ failed: expect.any(Number) }),
			})
		);
		expect(steps.markWebsiteWorkflowFailed).toHaveBeenCalledWith({
			code: "GENERATION_FAILED",
			errorMessage: "model failed",
			organizationId: input.organizationId,
			websiteId: input.websiteId,
		});
		expect(steps.skipWebsiteSection).not.toHaveBeenCalled();
		expect(steps.saveWebsiteWorkflow).not.toHaveBeenCalled();
		expect(start).not.toHaveBeenCalled();
	});

	it("keeps the selected template and does not start another blog draft for a template change", async () => {
		await generateWebsiteWorkflow({ ...input, expectedUpdatedAt: "revision", templateId: "template-1" });

		expect(steps.prepareWebsite).toHaveBeenCalledWith(expect.objectContaining({ templateId: "template-1" }));
		expect(start).not.toHaveBeenCalled();
	});
});
