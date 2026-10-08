import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	assembleWebsiteSectionAddition: vi.fn(),
	claimWebsiteWorkflowRun: vi.fn(),
	close: vi.fn(),
	completeWebsiteWorkflow: vi.fn(),
	createPersistedWebsiteSite: vi.fn(),
	generateWebsiteSectionAddition: vi.fn(),
	getWebsiteWorkflowContext: vi.fn(),
	getWorkflowMetadata: vi.fn(() => ({ workflowRunId: "run-addition" })),
	logError: vi.fn(),
	materializeWebsiteSection: vi.fn(),
	prepareWebsiteSectionAddition: vi.fn(),
	projectWebsiteSnapshot: vi.fn(),
	releaseLock: vi.fn(),
	releaseWebsiteWorkflowRun: vi.fn(),
	settleWebsiteAssetIntents: vi.fn(),
	write: vi.fn(),
}));

vi.mock("workflow", () => ({
	FatalError: class FatalError extends Error {
		override name = "FatalError";
	},
	getWorkflowMetadata: mocks.getWorkflowMetadata,
	getWritable: () => ({
		getWriter: () => ({ close: mocks.close, releaseLock: mocks.releaseLock, write: mocks.write }),
	}),
}));

vi.mock("../../src/services/websites/generation", () => ({
	materializeWebsiteSection: mocks.materializeWebsiteSection,
	settleWebsiteAssetIntents: mocks.settleWebsiteAssetIntents,
	websiteGenerationLocales: ["en", "ar"],
}));

vi.mock("../../src/services/websites/persistence", () => ({
	createPersistedWebsiteSite: mocks.createPersistedWebsiteSite,
}));

vi.mock("../../src/services/websites/persistence-read", () => ({
	projectWebsiteSnapshot: mocks.projectWebsiteSnapshot,
}));

vi.mock("../../src/services/websites/section-addition", () => ({
	assembleWebsiteSectionAddition: mocks.assembleWebsiteSectionAddition,
	generateWebsiteSectionAddition: mocks.generateWebsiteSectionAddition,
	prepareWebsiteSectionAddition: mocks.prepareWebsiteSectionAddition,
}));

vi.mock("../../src/services/websites/service", () => ({
	claimWebsiteWorkflowRun: mocks.claimWebsiteWorkflowRun,
	completeWebsiteWorkflow: mocks.completeWebsiteWorkflow,
	getWebsiteWorkflowContext: mocks.getWebsiteWorkflowContext,
}));

vi.mock("../../src/services/websites/workflow-stream", () => ({
	releaseWebsiteWorkflowRun: mocks.releaseWebsiteWorkflowRun,
}));

vi.mock("@starter/observability", () => ({
	log: { error: mocks.logError, info: vi.fn() },
}));

import {
	createWebsiteGenerationShell,
	generationPageKeys,
	listGenerationSlots,
	selectWebsiteGenerationProfile,
	type PersistedWebsiteSiteV1,
	type WebsiteGenerationPlan,
} from "@starter/infinite-website/generation";

import type { MaterializedWebsiteSection, WebsiteSectionGenerationSlot } from "../../src/services/websites/generation";
import type { WebsiteSectionAdditionPreparation } from "../../src/services/websites/section-addition";
import {
	bindWebsiteWorkflow,
	markWebsiteWorkflowFailed,
	prepareWebsiteSectionAdditionStep,
	resolveWebsiteSectionAdditionMedia,
	saveWebsiteWorkflow,
	writeWebsiteSectionAddition,
	writeWebsiteSectionAdditionLocalization,
} from "../../src/workflows/add-website-section/steps";

const brief = { location: "Toronto", name: "Northstar", schemaVersion: 1 as const, type: "Design studio" };

const profile = selectWebsiteGenerationProfile({ businessType: brief.type });

const generationDefinition = listGenerationSlots({ profile })[0];

if (!generationDefinition) {
	throw new Error("Expected a website generation slot");
}

const input = {
	expectedRunId: null,
	expectedUpdatedAt: "2026-08-22T12:00:00.000Z",
	input: {
		index: 1,
		pageId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d330",
		pattern: generationDefinition.definition.pattern,
		schemaVersion: 1 as const,
	},
	organizationId: "organization-1",
	websiteId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d",
};

const plan: WebsiteGenerationPlan = {
	kind: "plan",
	pages: generationPageKeys.map((pageKey) => ({
		description: `The ${pageKey} page.`,
		pageKey,
		title: pageKey,
	})),
	siteDescription: "Northstar",
};

const snapshot = createWebsiteGenerationShell({
	brief,
	localizations: { byLocale: { ar: plan, en: plan }, defaultLocale: "en" },
	profile,
	websiteId: input.websiteId,
});

const generationSlot = {
	assetIntents: [],
	codeFields: [],
	fieldOrder: [],
	linkIntents: [],
	linkPointers: [],
	promptSlot: {
		fields: [],
		links: [],
		pageKey: generationDefinition.pageKey,
		purpose: generationDefinition.purpose,
		sectionType: generationDefinition.definition.category,
		slotKey: generationDefinition.slotKey,
	},
	slot: {
		area: generationDefinition.area,
		category: generationDefinition.definition.category,
		index: generationDefinition.index,
		pageKey: generationDefinition.pageKey,
		pattern: generationDefinition.definition.pattern,
		purpose: generationDefinition.purpose,
		required: true,
		slotKey: generationDefinition.slotKey,
	},
} satisfies WebsiteSectionGenerationSlot;

const preparation = {
	generationSlot,
	localizations: {
		byLocale: {
			ar: {
				language: "Arabic",
				page: { description: plan.siteDescription, title: plan.pages[0]?.title ?? "home" },
				pageKey: plan.pages[0]?.pageKey ?? "home",
				plan,
			},
			en: {
				language: "English",
				page: { description: plan.siteDescription, title: plan.pages[0]?.title ?? "home" },
				pageKey: plan.pages[0]?.pageKey ?? "home",
				plan,
			},
		},
		defaultLocale: "en" as const,
	},
	slot: {
		assetIds: [],
		sectionId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d331",
		slotKey: "section-additions.run-addition",
		target: { area: "page" as const, index: 1, pageId: input.input.pageId },
	},
	snapshot,
	templateId: profile.templateId,
	templateName: profile.name,
} satisfies WebsiteSectionAdditionPreparation;

const site: PersistedWebsiteSiteV1 = {
	assetBindings: {
		"018ff7c2-1f7c-7b28-b6c1-3f2e60b5d339": { src: "/existing.jpg", type: "image" },
	},
	brand: snapshot.brand,
	document: snapshot.document,
	schemaVersion: 1,
	templateId: snapshot.templateId,
};

const context = { brief, site };

const prepared = {
	brief: context.brief,
	existingAssetBindings: context.site.assetBindings,
	preparation,
} satisfies Parameters<typeof writeWebsiteSectionAddition>[0]["prepared"];

const materialized = {
	assetIds: [],
	assetIntents: [],
	content: { en: {} },
	section: {
		anchor: "addition",
		category: generationDefinition.definition.category,
		contentId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d333",
		id: preparation.slot.sectionId,
		root: {
			id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d334",
			props: { children: [] },
			type: "box" as const,
		},
		source: { pattern: generationDefinition.definition.pattern },
	},
	slotKey: preparation.slot.slotKey,
	target: preparation.slot.target,
} satisfies MaterializedWebsiteSection;

const resolved = {
	assetBindings: { "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d332": { src: "/added.jpg", type: "image" as const } },
	assets: [
		{
			asset: { src: "/added.jpg", type: "image" as const },
			assetId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d332",
			outcome: "provider" as const,
			slotKey: preparation.slot.slotKey,
		},
	],
};

beforeEach(() => {
	vi.clearAllMocks();
	mocks.claimWebsiteWorkflowRun.mockResolvedValue({ workflowRunId: "run-addition" });
	mocks.getWebsiteWorkflowContext.mockResolvedValue(context);
	mocks.projectWebsiteSnapshot.mockReturnValue(snapshot);
	mocks.prepareWebsiteSectionAddition.mockReturnValue(preparation);

	mocks.generateWebsiteSectionAddition.mockImplementation(({ locale }) => ({
		fields: [],
		locale,
		plan,
		status: "valid",
	}));

	mocks.materializeWebsiteSection.mockReturnValue(materialized);
	mocks.settleWebsiteAssetIntents.mockResolvedValue(resolved);
	mocks.completeWebsiteWorkflow.mockResolvedValue(snapshot);
	mocks.releaseWebsiteWorkflowRun.mockResolvedValue(true);
});

describe("add website section durable steps", () => {
	it("claims section-addition ownership using the durable run id", async () => {
		const claim = {
			expectedRunId: input.expectedRunId,
			expectedUpdatedAt: input.expectedUpdatedAt,
			kind: "section-addition" as const,
			organizationId: input.organizationId,
			websiteId: input.websiteId,
		};

		await bindWebsiteWorkflow(claim);

		expect(mocks.claimWebsiteWorkflowRun).toHaveBeenCalledWith({ ...claim, runId: "run-addition" });

		mocks.claimWebsiteWorkflowRun.mockResolvedValue(null);
		await expect(bindWebsiteWorkflow(claim)).rejects.toMatchObject({
			message: expect.stringContaining("no longer owns"),
			name: "FatalError",
		});
	});

	it("loads authoritative context and streams the prepared candidate", async () => {
		await expect(prepareWebsiteSectionAdditionStep(input)).resolves.toEqual(prepared);

		expect(mocks.getWebsiteWorkflowContext).toHaveBeenCalledWith({
			organizationId: input.organizationId,
			websiteId: input.websiteId,
			workflowRunId: "run-addition",
		});

		expect(mocks.prepareWebsiteSectionAddition).toHaveBeenCalledWith({
			brief,
			input: input.input,
			snapshot,
			websiteId: input.websiteId,
			workflowRunId: "run-addition",
		});

		expect(mocks.write.mock.calls.map(([event]) => event)).toEqual([
			{ eventKey: "status:planning", stage: "planning", type: "status", version: 1 },
			{
				eventKey: "prepared",
				slots: [preparation.slot],
				snapshot: preparation.snapshot,
				type: "prepared",
				version: 1,
			},
			{ eventKey: "status:writing", stage: "writing", type: "status", version: 1 },
		]);

		expect(mocks.releaseLock).toHaveBeenCalledOnce();
	});

	it("rejects a stale section-addition context before writing events", async () => {
		mocks.getWebsiteWorkflowContext.mockResolvedValue(null);

		await expect(prepareWebsiteSectionAdditionStep(input)).rejects.toThrow("no longer available");
		expect(mocks.write).not.toHaveBeenCalled();
	});

	it("generates each locale independently before materializing and streaming the added section", async () => {
		const en = await writeWebsiteSectionAdditionLocalization({ locale: "en", prepared });
		const ar = await writeWebsiteSectionAdditionLocalization({ locale: "ar", prepared });

		if (en.status !== "valid" || ar.status !== "valid") {
			throw new Error("Expected valid localized section additions");
		}

		const localizations = [en, ar];

		await expect(writeWebsiteSectionAddition({ input, localizations, prepared })).resolves.toBe(materialized);

		expect(mocks.generateWebsiteSectionAddition).toHaveBeenNthCalledWith(1, {
			brief: prepared.brief,
			locale: "en",
			preparation,
		});

		expect(mocks.generateWebsiteSectionAddition).toHaveBeenNthCalledWith(2, {
			brief: prepared.brief,
			locale: "ar",
			preparation,
		});

		expect(mocks.materializeWebsiteSection).toHaveBeenCalledWith({
			generatedSection: preparation.generationSlot,
			localizations: {
				byLocale: {
					ar: { fields: [], plan },
					en: { fields: [], plan },
				},
				defaultLocale: "en",
			},
			pages: preparation.snapshot.document.structure.pages,
			templateId: preparation.templateId,
			websiteId: input.websiteId,
		});

		expect(mocks.write).toHaveBeenCalledWith({
			content: materialized.content,
			eventKey: `section:${materialized.section.id}`,
			section: materialized.section,
			slotKey: materialized.slotKey,
			target: materialized.target,
			type: "section",
			version: 1,
		});

		expect(mocks.releaseLock).toHaveBeenCalledOnce();
	});

	it("resolves and streams every added-section asset", async () => {
		await expect(resolveWebsiteSectionAdditionMedia({ prepared })).resolves.toBe(resolved.assetBindings);

		expect(mocks.settleWebsiteAssetIntents).toHaveBeenCalledWith({
			brandColors: preparation.snapshot.brand.colors,
			brief: prepared.brief,
			fallbackAssets: Object.values(prepared.existingAssetBindings),
			intents: preparation.generationSlot.assetIntents,
		});

		expect(mocks.write).toHaveBeenCalledWith({
			asset: resolved.assets[0]?.asset,
			assetId: resolved.assets[0]?.assetId,
			eventKey: `asset:${resolved.assets[0]?.assetId}`,
			outcome: resolved.assets[0]?.outcome,
			slotKey: resolved.assets[0]?.slotKey,
			type: "asset-settled",
			version: 1,
		});

		expect(mocks.releaseLock).toHaveBeenCalledOnce();
	});

	it("persists before completing the section-addition stream", async () => {
		await saveWebsiteWorkflow({ organizationId: input.organizationId, site, websiteId: input.websiteId });

		expect(mocks.completeWebsiteWorkflow).toHaveBeenCalledWith({
			organizationId: input.organizationId,
			site,
			websiteId: input.websiteId,
			workflowRunId: "run-addition",
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

	it("logs and emits the terminal section-addition failure", async () => {
		await markWebsiteWorkflowFailed({
			code: "SECTION_ADDITION_FAILED",
			errorMessage: "provider failed",
			organizationId: input.organizationId,
			websiteId: input.websiteId,
		});

		expect(mocks.logError).toHaveBeenCalledWith({
			errorMessage: "provider failed",
			message: "Website section addition failed",
			organizationId: input.organizationId,
			websiteId: input.websiteId,
			workflowRunId: "run-addition",
		});

		expect(mocks.write).toHaveBeenCalledWith({
			code: "SECTION_ADDITION_FAILED",
			eventKey: "failed",
			type: "failed",
			version: 1,
		});

		expect(mocks.releaseWebsiteWorkflowRun).toHaveBeenCalledWith({
			organizationId: input.organizationId,
			websiteId: input.websiteId,
			workflowRunId: "run-addition",
		});
		expect(mocks.releaseWebsiteWorkflowRun.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.write.mock.invocationCallOrder[0] ?? Infinity
		);
		expect(mocks.close).toHaveBeenCalledOnce();
		expect(mocks.releaseLock).toHaveBeenCalledOnce();
	});
});
