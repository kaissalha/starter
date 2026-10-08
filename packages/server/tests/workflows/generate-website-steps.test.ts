import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	assembleWebsiteSections: vi.fn(),
	claimWebsiteWorkflowRun: vi.fn(),
	close: vi.fn(),
	completeWebsiteWorkflow: vi.fn(),
	createPersistedWebsiteSite: vi.fn(),
	generateWebsitePlan: vi.fn(),
	generateWebsiteSection: vi.fn(),
	getStepMetadata: vi.fn(() => ({ attempt: 1 })),
	getWorkflowMetadata: vi.fn(() => ({ workflowRunId: "run-generation" })),
	logError: vi.fn(),
	logInfo: vi.fn(),
	materializeWebsiteSection: vi.fn(),
	prepareWebsiteGeneration: vi.fn(),
	readWebsitePreviewFields: vi.fn(),
	releaseLock: vi.fn(),
	releaseWebsiteWorkflowRun: vi.fn(),
	resolveWebsiteGenerationMedia: vi.fn(),
	selectWebsiteGenerationTemplate: vi.fn(),
	write: vi.fn(),
}));

vi.mock("workflow", () => ({
	FatalError: class FatalError extends Error {
		override name = "FatalError";
	},
	getStepMetadata: mocks.getStepMetadata,
	getWorkflowMetadata: mocks.getWorkflowMetadata,
	getWritable: () => ({
		getWriter: () => ({ close: mocks.close, releaseLock: mocks.releaseLock, write: mocks.write }),
	}),
	RetryableError: class RetryableError extends Error {
		override name = "RetryableError";
	},
}));

vi.mock("../../src/services/websites/generation", () => ({
	assembleWebsiteSections: mocks.assembleWebsiteSections,
	generateWebsitePlan: mocks.generateWebsitePlan,
	generateWebsiteSection: mocks.generateWebsiteSection,
	materializeWebsiteSection: mocks.materializeWebsiteSection,
	prepareWebsiteGeneration: mocks.prepareWebsiteGeneration,
	resolveWebsiteGenerationMedia: mocks.resolveWebsiteGenerationMedia,
	selectWebsiteGenerationTemplate: mocks.selectWebsiteGenerationTemplate,
	websiteGenerationLocales: ["en", "ar"],
}));

vi.mock("../../src/services/websites/preview-cache", () => ({
	readWebsitePreviewFields: mocks.readWebsitePreviewFields,
}));

vi.mock("../../src/services/websites/persistence", () => ({
	createPersistedWebsiteSite: mocks.createPersistedWebsiteSite,
}));

vi.mock("../../src/services/websites/service", () => ({
	claimWebsiteWorkflowRun: mocks.claimWebsiteWorkflowRun,
	completeWebsiteWorkflow: mocks.completeWebsiteWorkflow,
}));

vi.mock("../../src/services/websites/workflow-stream", () => ({
	releaseWebsiteWorkflowRun: mocks.releaseWebsiteWorkflowRun,
}));

vi.mock("@starter/observability", () => ({
	log: { error: mocks.logError, info: mocks.logInfo },
}));

import {
	createWebsiteGenerationShell,
	generationPageKeys,
	listGenerationSlots,
	selectWebsiteGenerationProfile,
	type PersistedWebsiteSiteV1,
	type WebsiteGenerationPlan,
} from "@starter/infinite-website/generation";

import type {
	MaterializedWebsiteSection,
	WebsiteGenerationPreparation,
	WebsiteSectionGenerationSlot,
} from "../../src/services/websites/generation";
import {
	bindWebsiteWorkflow,
	markWebsiteWorkflowFailed,
	prepareWebsite,
	resolveWebsiteMedia,
	saveWebsiteWorkflow,
	selectWebsiteBrand,
	settleWebsiteMedia,
	skipWebsiteSection,
	writeWebsitePlan,
	writeWebsiteSection,
} from "../../src/workflows/generate-website/steps";

const input = {
	brief: { location: "Toronto", name: "Northstar", schemaVersion: 1 as const, type: "Design studio" },
	expectedRunId: null,
	organizationId: "organization-1",
	websiteId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d",
};

const profile = selectWebsiteGenerationProfile({ businessType: input.brief.type });

const slot = listGenerationSlots({ profile })[0];

if (!slot) {
	throw new Error("Expected a website generation slot");
}

const plan: WebsiteGenerationPlan = {
	kind: "plan",
	pages: generationPageKeys.map((pageKey) => ({
		description: `The ${pageKey} page.`,
		pageKey,
		title: pageKey,
	})),
	siteDescription: "Northstar",
};

const snapshot = {
	...createWebsiteGenerationShell({
		brief: input.brief,
		localizations: { byLocale: { ar: plan, en: plan }, defaultLocale: "en" },
		profile,
		websiteId: input.websiteId,
	}),
	assets: {},
};

const generationSlot = {
	assetIntents: [],
	codeFields: [],
	fieldOrder: [],
	linkIntents: [],
	linkPointers: [],
	promptSlot: {
		fields: [],
		links: [],
		pageKey: slot.pageKey,
		purpose: slot.purpose,
		sectionType: slot.definition.category,
		slotKey: slot.slotKey,
	},
	slot: {
		area: slot.area,
		category: slot.definition.category,
		index: slot.index,
		pageKey: slot.pageKey,
		pattern: slot.definition.pattern,
		purpose: slot.purpose,
		required: true,
		slotKey: slot.slotKey,
	},
} satisfies WebsiteSectionGenerationSlot;

const preparation = {
	generationSlots: [generationSlot],
	localizations: {
		byLocale: {
			ar: { language: "Arabic", plan },
			en: { language: "English", plan },
		},
		defaultLocale: "en",
	},
	slots: [
		{
			assetIds: [],
			sectionId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d330",
			slotKey: generationSlot.slot.slotKey,
			target: { area: "header", index: 0 },
		},
	],
	snapshot,
	templateId: profile.templateId,
	templateName: profile.name,
} satisfies WebsiteGenerationPreparation;

const materialized = {
	assetIds: [],
	assetIntents: [],
	content: { en: {} },
	section: {
		anchor: "header",
		category: slot.definition.category,
		contentId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d331",
		id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d330",
		root: {
			id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d332",
			props: { children: [] },
			type: "box" as const,
		},
		source: { pattern: slot.definition.pattern },
	},
	slotKey: slot.slotKey,
	target: { area: "header" as const, index: 0 },
} satisfies MaterializedWebsiteSection;

const site: PersistedWebsiteSiteV1 = {
	assetBindings: {},
	brand: snapshot.brand,
	document: snapshot.document,
	schemaVersion: 1,
	templateId: snapshot.templateId,
};

beforeEach(() => {
	vi.clearAllMocks();
	mocks.getStepMetadata.mockReturnValue({ attempt: 1 });
	mocks.claimWebsiteWorkflowRun.mockResolvedValue({ workflowRunId: "run-generation" });
	mocks.prepareWebsiteGeneration.mockReturnValue(preparation);
	mocks.readWebsitePreviewFields.mockResolvedValue({});
	mocks.selectWebsiteGenerationTemplate.mockResolvedValue({ probabilities: null, templateId: profile.templateId });

	mocks.generateWebsitePlan.mockImplementation(({ locale }) => ({
		language: locale === "ar" ? "Arabic" : "English",
		locale,
		plan,
		status: "valid",
	}));

	mocks.generateWebsiteSection.mockResolvedValue({ fields: [], status: "valid" });
	mocks.materializeWebsiteSection.mockReturnValue(materialized);
	mocks.completeWebsiteWorkflow.mockResolvedValue(snapshot);
	mocks.releaseWebsiteWorkflowRun.mockResolvedValue(true);
});

describe("generate website durable steps", () => {
	it("classifies every escaped website model failure as retryable", async () => {
		mocks.generateWebsitePlan.mockRejectedValueOnce(new Error("Provider timed out"));

		await expect(writeWebsitePlan({ input, locale: "en" })).rejects.toMatchObject({
			message: "Provider timed out",
			name: "RetryableError",
		});
	});

	it("claims ownership using the durable workflow run id", async () => {
		await bindWebsiteWorkflow({ kind: "generation", ...input });

		expect(mocks.claimWebsiteWorkflowRun).toHaveBeenCalledWith({
			...input,
			kind: "generation",
			runId: "run-generation",
		});

		mocks.claimWebsiteWorkflowRun.mockResolvedValue(null);
		await expect(bindWebsiteWorkflow({ kind: "generation", ...input })).rejects.toMatchObject({
			message: expect.stringContaining("no longer owns"),
			name: "FatalError",
		});
	});

	it("streams planning while selecting the Brand and writing locale plans", async () => {
		await expect(
			selectWebsiteBrand({ ...input, expectedUpdatedAt: "revision", templateId: profile.templateId })
		).resolves.toBeNull();
		expect(mocks.selectWebsiteGenerationTemplate).not.toHaveBeenCalled();

		await expect(writeWebsitePlan({ input, locale: "ar" })).resolves.toEqual({
			language: "Arabic",
			locale: "ar",
			plan,
			status: "valid",
		});

		expect(mocks.write).toHaveBeenCalledWith({
			eventKey: "status:planning",
			stage: "planning",
			type: "status",
			version: 1,
		});

		expect(mocks.selectWebsiteGenerationTemplate).not.toHaveBeenCalled();

		expect(mocks.generateWebsitePlan).toHaveBeenCalledWith({
			brief: input.brief,
			locale: "ar",
			templateId: "custom",
		});
	});

	it("prepares the shell after template and locale plans are selected", async () => {
		const plans = [
			{ language: "English", locale: "en" as const, plan, status: "valid" as const },
			{ language: "Arabic", locale: "ar" as const, plan, status: "valid" as const },
		];

		await expect(prepareWebsite({ brand: null, input, plans, templateId: profile.templateId })).resolves.toBe(
			preparation
		);

		expect(mocks.write.mock.calls.map(([event]) => event)).toEqual([
			{
				eventKey: "prepared",
				slots: preparation.slots,
				snapshot: preparation.snapshot,
				type: "prepared",
				version: 1,
			},
			{ eventKey: "status:writing", stage: "writing", type: "status", version: 1 },
		]);

		expect(mocks.prepareWebsiteGeneration).toHaveBeenCalledWith({
			brand: null,
			brief: input.brief,
			plans,
			templateId: profile.templateId,
			websiteId: input.websiteId,
		});

		expect(mocks.releaseLock).toHaveBeenCalledOnce();
	});

	it("looks up preview fields using the source revision before workflow ownership changes", async () => {
		const templateInput = { ...input, expectedUpdatedAt: "source-revision", templateId: profile.templateId };
		await prepareWebsite({ brand: null, input: templateInput, plans: [], templateId: profile.templateId });
		expect(mocks.readWebsitePreviewFields).toHaveBeenCalledWith({
			scope: { organizationId: input.organizationId, revision: "source-revision", websiteId: input.websiteId },
			targets: ["en", "ar"].map((locale) =>
				JSON.stringify([profile.templateId, generationSlot.slot.slotKey, locale])
			),
		});
	});

	it("resolves media from the selected profile before emitting provider and placeholder settlements", async () => {
		const assetId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d333";
		const placeholderId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d334";

		const resolvedMedia = {
			assetBindings: {},
			assets: [
				{
					asset: { src: "/provider.jpg", type: "image" as const },
					assetId,
					outcome: "provider" as const,
					slotKey: "pages.home.hero",
				},
				{
					asset: { src: "/website-image-placeholder.svg", type: "image" as const },
					assetId: placeholderId,
					outcome: "placeholder" as const,
					slotKey: "pages.home.gallery",
				},
			],
		};

		mocks.resolveWebsiteGenerationMedia.mockResolvedValue(resolvedMedia);

		await expect(resolveWebsiteMedia({ brand: null, input, templateId: profile.templateId })).resolves.toBe(
			resolvedMedia
		);
		await expect(settleWebsiteMedia({ resolved: resolvedMedia })).resolves.toEqual({});

		expect(mocks.resolveWebsiteGenerationMedia).toHaveBeenCalledWith({
			brand: null,
			brief: input.brief,
			templateId: profile.templateId,
			websiteId: input.websiteId,
		});

		expect(mocks.write.mock.calls.map(([event]) => event)).toEqual([
			{
				asset: { src: "/provider.jpg", type: "image" },
				assetId,
				eventKey: `asset:${assetId}`,
				outcome: "provider",
				slotKey: "pages.home.hero",
				type: "asset-settled",
				version: 1,
			},
			{
				asset: { src: "/website-image-placeholder.svg", type: "image" },
				assetId: placeholderId,
				eventKey: `asset:${placeholderId}`,
				outcome: "placeholder",
				slotKey: "pages.home.gallery",
				type: "asset-settled",
				version: 1,
			},
		]);
	});

	it("streams an omitted optional section by its prepared identity", async () => {
		await expect(skipWebsiteSection({ generationSlot, preparation })).resolves.toBe(
			preparation.slots[0]?.sectionId
		);

		expect(mocks.write).toHaveBeenCalledWith({
			eventKey: `section-skipped:${preparation.slots[0]?.sectionId}`,
			sectionId: preparation.slots[0]?.sectionId,
			slotKey: generationSlot.slot.slotKey,
			type: "section-skipped",
			version: 1,
		});

		expect(mocks.releaseLock).toHaveBeenCalledOnce();
	});

	it("releases the stream writer when preparation fails", async () => {
		mocks.prepareWebsiteGeneration.mockImplementation(() => {
			throw new Error("invalid plan");
		});

		await expect(prepareWebsite({ brand: null, input, plans: [], templateId: profile.templateId })).rejects.toThrow(
			"invalid plan"
		);

		expect(mocks.write).not.toHaveBeenCalled();
		expect(mocks.releaseLock).not.toHaveBeenCalled();
	});

	it("writes every locale of a section in one step before materializing and streaming it", async () => {
		await expect(writeWebsiteSection({ generationSlot, input, preparation })).resolves.toBe(materialized);

		expect(mocks.generateWebsiteSection).toHaveBeenNthCalledWith(1, {
			brief: input.brief,
			generationSlot,
			language: "English",
			plan,
			templateName: preparation.templateName,
		});

		expect(mocks.generateWebsiteSection).toHaveBeenNthCalledWith(2, {
			brief: input.brief,
			generationSlot,
			language: "Arabic",
			plan,
			templateName: preparation.templateName,
		});

		expect(mocks.materializeWebsiteSection).toHaveBeenCalledWith(
			expect.objectContaining({
				localizations: {
					byLocale: { ar: { fields: [], plan }, en: { fields: [], plan } },
					defaultLocale: "en",
				},
			})
		);

		expect(mocks.write).toHaveBeenCalledWith(
			expect.objectContaining({ eventKey: `section:${materialized.section.id}`, type: "section" })
		);
		expect(mocks.releaseLock).toHaveBeenCalledOnce();
	});

	it("repairs schema-invalid section output once and fails the section when the repair is invalid", async () => {
		const repair = { invalidOutput: "{}", status: "repair" as const, validationError: "Heading is repeated" };
		mocks.generateWebsiteSection.mockResolvedValueOnce(repair);

		await expect(writeWebsiteSection({ generationSlot, input, preparation })).resolves.toBe(materialized);

		expect(mocks.generateWebsiteSection).toHaveBeenCalledWith({
			brief: input.brief,
			generationSlot,
			language: "English",
			plan,
			repair: expect.objectContaining(repair),
			templateName: preparation.templateName,
		});

		mocks.generateWebsiteSection.mockResolvedValue(repair);

		await expect(writeWebsiteSection({ generationSlot, input, preparation })).rejects.toMatchObject({
			message: expect.stringContaining("repair failed"),
			name: "FatalError",
		});
	});

	it("persists before emitting and closing the completed stream", async () => {
		await saveWebsiteWorkflow({ organizationId: input.organizationId, site, websiteId: input.websiteId });

		expect(mocks.completeWebsiteWorkflow).toHaveBeenCalledWith({
			organizationId: input.organizationId,
			site,
			websiteId: input.websiteId,
			workflowRunId: "run-generation",
		});

		expect(mocks.write.mock.calls.map(([event]) => event)).toEqual([
			{ eventKey: "status:saving", stage: "saving", type: "status", version: 1 },
			{
				eventKey: "completed",
				snapshot,
				type: "completed",
				version: 1,
			},
		]);

		expect(mocks.close).toHaveBeenCalledOnce();
		expect(mocks.releaseLock).toHaveBeenCalledTimes(2);
	});

	it("does not complete the stream after losing save ownership", async () => {
		mocks.completeWebsiteWorkflow.mockResolvedValue(null);

		await expect(
			saveWebsiteWorkflow({ organizationId: input.organizationId, site, websiteId: input.websiteId })
		).rejects.toThrow("lost ownership");

		expect(mocks.close).not.toHaveBeenCalled();
		expect(mocks.releaseLock).toHaveBeenCalledOnce();
	});

	it("logs and emits the terminal generation failure", async () => {
		await markWebsiteWorkflowFailed({
			code: "GENERATION_FAILED",
			errorMessage: "provider failed",
			organizationId: input.organizationId,
			websiteId: input.websiteId,
		});

		expect(mocks.logError).toHaveBeenCalledWith({
			errorMessage: "provider failed",
			message: "Website generation failed",
			organizationId: input.organizationId,
			websiteId: input.websiteId,
			workflowRunId: "run-generation",
		});

		expect(mocks.write).toHaveBeenCalledWith({
			code: "GENERATION_FAILED",
			eventKey: "failed",
			type: "failed",
			version: 1,
		});

		expect(mocks.close).toHaveBeenCalledOnce();
		expect(mocks.releaseLock).toHaveBeenCalledOnce();
	});

	it("reuses only validated preview fields while leaving the other locale for generation", async () => {
		const selectedSlot = {
			...generationSlot,
			promptSlot: {
				...generationSlot.promptSlot,
				fields: [{ key: "f0", maxWords: 12, minWords: 1, path: "/copy/title", role: "heading" as const }],
			},
		};

		const previewPreparation = {
			...preparation,
			previewFields: {
				[JSON.stringify([preparation.templateId, generationSlot.slot.slotKey, "en"])]: [
					{ path: "/copy/title", value: "Reviewed preview heading" },
				],
			},
		};

		mocks.generateWebsiteSection.mockResolvedValue({
			fields: [{ path: "/copy/title", value: "عنوان عربي" }],
			status: "valid",
		});

		await writeWebsiteSection({ generationSlot: selectedSlot, input, preparation: previewPreparation });

		expect(mocks.generateWebsiteSection).toHaveBeenCalledOnce();
		expect(mocks.generateWebsiteSection).toHaveBeenCalledWith(expect.objectContaining({ language: "Arabic" }));
		expect(mocks.materializeWebsiteSection).toHaveBeenCalledWith(
			expect.objectContaining({
				localizations: expect.objectContaining({
					byLocale: expect.objectContaining({
						en: { fields: [{ path: "/copy/title", value: "Reviewed preview heading" }], plan },
					}),
				}),
			})
		);
		mocks.generateWebsiteSection.mockClear();
		await writeWebsiteSection({
			generationSlot: selectedSlot,
			input,
			preparation: {
				...previewPreparation,
				previewFields: {
					[JSON.stringify([preparation.templateId, generationSlot.slot.slotKey, "en"])]: [
						{ path: "/unrelated", value: "Wrong field" },
					],
				},
			},
		});
		expect(mocks.generateWebsiteSection).toHaveBeenCalledTimes(2);
	});
});
