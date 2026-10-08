import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db, linkPages, websites, websiteVersions, type WebsiteRecord } from "@starter/db";
import { createDefaultLinkPageDocument } from "@starter/infinite-links/document";
import { WebsiteEditError } from "@starter/infinite-website/editing";
import {
	createWebsiteGenerationShell,
	selectWebsiteGenerationProfile,
	upsertGeneratedSection,
	type WebsiteGenerationEventV1,
	type WebsiteGenerationPlan,
} from "@starter/infinite-website/generation";

import { createWebsiteGenerationSlots, materializeWebsiteSection } from "../../src/services/websites/generation";
import { createPersistedWebsiteSite, splitPersistedWebsiteSite } from "../../src/services/websites/persistence";
import { getPublishedWebsiteVersionId, getReadyWebsite } from "../../src/services/websites/ready-website";
import {
	WebsiteDraftNotFoundError,
	WebsiteGenerationConflictError,
	WebsiteSectionAdditionConflictError,
	WebsiteSectionAdditionTargetError,
	WebsiteMutationConflictError,
	cancelWebsiteWorkflow,
	claimWebsiteWorkflowRun,
	completeWebsiteWorkflow,
	editWebsite,
	getWebsite,
	getWebsiteWorkflowContext,
	prepareWebsiteGenerationStart,
	prepareWebsiteSectionAdditionStart,
	publishWebsite,
	unpublishWebsite,
} from "../../src/services/websites/service";
import {
	cancelWebsiteWorkflowRun,
	releaseWebsiteWorkflowRun,
	streamWebsiteWorkflow,
} from "../../src/services/websites/workflow-stream";
import { cleanupOrganization, createTestOrganization } from "../helpers/db";

const workflowRuns = vi.hoisted(
	() =>
		new Map<
			string,
			{
				events?: Array<WebsiteGenerationEventV1>;
				exists: boolean;
				status: "pending" | "running" | "completed" | "failed" | "cancelled";
				workflowName?: string;
			}
		>()
);

const getRun = vi.hoisted(() => vi.fn());

const cancelRun = vi.hoisted(() => vi.fn());

vi.mock("workflow/api", () => ({
	getRun: getRun.mockImplementation((runId: string) => {
		const run = workflowRuns.get(runId) ?? { events: [], exists: false, status: "failed" as const };

		return {
			cancel: cancelRun,
			exists: Promise.resolve(run.exists),
			getReadable: ({ startIndex = 0 }: { startIndex?: number } = {}) =>
				new ReadableStream({
					start(controller) {
						for (const event of (run.events ?? []).slice(startIndex)) {
							controller.enqueue(event);
						}

						controller.close();
					},
				}),
			runId,
			status: Promise.resolve(run.status),
			workflowName: Promise.resolve(run.workflowName),
		};
	}),
}));

const websiteId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d";

const activeWebsiteId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32e";

const futureWebsiteUpdatedAt = "2099-01-01T00:00:00.000Z";

const brief = { location: "Toronto", name: "Northstar", schemaVersion: 1 as const, type: "Design studio" };

const organizationIds: Array<string> = [];

const generationWorkflowName = "workflow//./src/workflows/generate-website//generateWebsiteWorkflow";

const sectionAdditionWorkflowName = "workflow//./src/workflows/add-website-section//addWebsiteSectionWorkflow";

const layoutGenerationWorkflowName = "workflow//./src/workflows/generate-website-layout//generateWebsiteLayoutWorkflow";

const translationWorkflowName = "workflow//./src/workflows/translate-website//translateWebsiteWorkflow";

const baseRecord: WebsiteRecord = {
	brief,
	createdAt: "2026-08-12T12:00:00.000Z",
	draftVersionId: null,
	id: websiteId,
	locale: "en",
	organizationId: "organization-1",
	publishedVersionId: null,
	subdomain: null,
	suspendedAt: null,
	suspensionReason: null,
	translationLocale: null,
	updatedAt: "2026-08-12T12:01:00.000Z",
	workflowRunId: null,
};

const createGeneratingWebsite = async (values: { updatedAt?: string; workflowRunId: string }) => {
	const organization = await createTestOrganization();
	organizationIds.push(organization.id);
	const prepared = await prepareWebsiteGenerationStart({ brief, organizationId: organization.id });
	await db.update(websites).set(values).where(eq(websites.id, prepared.record.id));

	return { organizationId: organization.id, websiteId: prepared.record.id };
};

const createReadyWebsite = async () => {
	const organization = await createTestOrganization();
	organizationIds.push(organization.id);
	const profile = selectWebsiteGenerationProfile({ businessType: brief.type });

	const plan: WebsiteGenerationPlan = {
		kind: "plan",
		pages: (["home", "about", "services", "faq", "contact"] as const).map((pageKey) => ({
			description: `A ${pageKey} page.`,
			pageKey,
			title: pageKey,
		})),
		siteDescription: "A Toronto design studio.",
	};

	const shell = createWebsiteGenerationShell({
		brief,
		localizations: { byLocale: { ar: plan, en: plan }, defaultLocale: "en" },
		profile,
		websiteId,
	});

	const slot = profile.pages.home.slots[0];

	if (!slot) {
		throw new Error("Website profile is missing its first home slot");
	}

	const generationSlot = createWebsiteGenerationSlots({
		businessName: brief.name,
		profileKeyword: profile.keywords[0] ?? "business",
		slots: [slot],
		templateId: profile.templateId,
		websiteId,
	})[0];

	if (!generationSlot) {
		throw new Error("Website generation slot could not be created");
	}

	const section = materializeWebsiteSection({
		generatedSection: generationSlot,
		localizations: {
			byLocale: {
				ar: {
					fields: generationSlot.promptSlot.fields.map(({ path }) => ({
						path,
						value: "نسخة تصميم محلية واضحة",
					})),
					plan,
				},
				en: {
					fields: generationSlot.promptSlot.fields.map(({ path }) => ({
						path,
						value: "Grounded local design copy",
					})),
					plan,
				},
			},
			defaultLocale: "en",
		},
		pages: shell.document.structure.pages,
		templateId: profile.templateId,
		websiteId,
	});

	expect(section.section.source).toEqual({ pattern: slot.definition.pattern });

	const assetBindings = Object.fromEntries(
		generationSlot.assetIntents.map(({ assetId }) => [
			assetId,
			{ src: `https://example.com/${assetId}.jpg`, type: "image" as const },
		])
	);

	const site = createPersistedWebsiteSite({
		assetBindings,
		snapshot: {
			...shell,
			document: upsertGeneratedSection({
				document: shell.document,
				section: { content: section.content, section: section.section, target: section.target },
			}),
		},
	});

	const [website] = await db
		.insert(websites)
		.values({
			brief,
			id: websiteId,
			locale: "en",
			organizationId: organization.id,
		})
		.returning();

	if (!website) {
		throw new Error("Ready website fixture was not inserted");
	}

	const [version] = await db
		.insert(websiteVersions)
		.values({
			version: 1,
			websiteId,
			...splitPersistedWebsiteSite({ site }),
		})
		.returning();

	if (!version) {
		throw new Error("Ready website version fixture was not inserted");
	}

	const [record] = await db
		.update(websites)
		.set({ draftVersionId: version.id })
		.where(eq(websites.id, websiteId))
		.returning();

	if (!record) {
		throw new Error("Ready website fixture was not linked to its draft");
	}

	return {
		organization,
		pageId: site.document.structure.pages[0]?.id ?? websiteId,
		record,
		site,
		slot,
		version,
	};
};

beforeEach(() => {
	workflowRuns.clear();
	getRun.mockClear();
	cancelRun.mockReset();
});

afterEach(async () => {
	for (const organizationId of organizationIds) {
		await cleanupOrganization(organizationId);
	}

	organizationIds.length = 0;
});

describe("website workflow state", () => {
	it("returns only a published, valid website snapshot", async () => {
		await expect(getPublishedWebsiteVersionId({ websiteId: "not-a-uuid" })).resolves.toBeNull();
		await expect(getReadyWebsite({ websiteId: "not-a-uuid" })).resolves.toBeNull();
		await expect(getReadyWebsite({ websiteId })).resolves.toBeNull();

		const fixture = await createReadyWebsite();
		await expect(getPublishedWebsiteVersionId({ websiteId: fixture.record.id })).resolves.toBeNull();
		await expect(getReadyWebsite({ websiteId: fixture.record.id })).resolves.toBeNull();

		await publishWebsite({
			organizationId: fixture.organization.id,
			updatedAt: fixture.record.updatedAt,
			websiteId: fixture.record.id,
		});

		await expect(getPublishedWebsiteVersionId({ websiteId: fixture.record.id })).resolves.toBe(fixture.version.id);
		await expect(
			getReadyWebsite({ publishedVersionId: activeWebsiteId, websiteId: fixture.record.id })
		).resolves.toBeNull();
		await expect(
			getReadyWebsite({ publishedVersionId: fixture.version.id, websiteId: fixture.record.id })
		).resolves.toEqual(expect.objectContaining({ schemaVersion: 1, templateId: fixture.site.templateId }));
	});

	it("projects Workflow status only while a run is attached", async () => {
		const organization = await createTestOrganization();
		organizationIds.push(organization.id);

		workflowRuns.set("run-active", {
			exists: true,
			status: "running",
			workflowName: generationWorkflowName,
		});

		await db.insert(websites).values({
			brief,
			id: activeWebsiteId,
			locale: "en",
			organizationId: organization.id,
			workflowRunId: "run-active",
		});

		await expect(getWebsite({ organizationId: organization.id })).resolves.toMatchObject({
			id: activeWebsiteId,
			snapshot: null,
			workflow: { kind: "generation", runId: "run-active", state: "active" },
		});

		const ready = await createReadyWebsite();
		getRun.mockClear();

		await expect(getWebsite({ organizationId: ready.organization.id })).resolves.toMatchObject({
			snapshot: { schemaVersion: 1 },
			workflow: null,
		});

		expect(getRun).not.toHaveBeenCalled();
		expect(cancelRun).not.toHaveBeenCalled();
	});

	it("projects known failed runs and ignores unavailable stale runs", async () => {
		const organization = await createTestOrganization();
		organizationIds.push(organization.id);

		workflowRuns.set("run-failed", {
			exists: true,
			status: "failed",
			workflowName: generationWorkflowName,
		});

		await db.insert(websites).values({
			brief,
			id: websiteId,
			locale: "en",
			organizationId: organization.id,
			workflowRunId: "run-failed",
		});

		await expect(getWebsite({ organizationId: organization.id })).resolves.toMatchObject({
			workflow: { kind: "generation", runId: "run-failed", state: "failed" },
		});
		await expect(db.select().from(websites).where(eq(websites.id, websiteId))).resolves.toMatchObject([
			{ workflowRunId: "run-failed" },
		]);

		await db.update(websites).set({ workflowRunId: "run-missing" }).where(eq(websites.id, websiteId));

		await expect(getWebsite({ organizationId: organization.id })).resolves.toMatchObject({ workflow: null });

		await expect(db.select().from(websites).where(eq(websites.id, websiteId))).resolves.toMatchObject([
			{ workflowRunId: null },
		]);
	});

	it("projects an unknown attached workflow as an explicit blocker", async () => {
		const organization = await createTestOrganization();
		organizationIds.push(organization.id);

		workflowRuns.set("run-unknown", {
			exists: true,
			status: "running",
			workflowName: "workflow//./src/workflows/future-website-operation//futureWebsiteWorkflow",
		});

		await db.insert(websites).values({
			brief,
			id: websiteId,
			locale: "en",
			organizationId: organization.id,
			workflowRunId: "run-unknown",
		});

		await expect(getWebsite({ organizationId: organization.id })).resolves.toMatchObject({
			workflow: { kind: "unknown", runId: "run-unknown", state: "blocked" },
		});

		await expect(db.select().from(websites).where(eq(websites.id, websiteId))).resolves.toMatchObject([
			{ workflowRunId: "run-unknown" },
		]);
	});

	it("persists translation progress across reads and releases the website once the run fails", async () => {
		const fixture = await createReadyWebsite();

		const input = {
			expectedRunId: null,
			expectedUpdatedAt: fixture.record.updatedAt,
			kind: "translation" as const,
			locale: "sv" as const,
			organizationId: fixture.organization.id,
			runId: "run-translation",
			websiteId: fixture.record.id,
		};

		expect(await claimWebsiteWorkflowRun(input)).toMatchObject({ translationLocale: "sv" });
		workflowRuns.set(input.runId, { exists: true, status: "running", workflowName: translationWorkflowName });
		expect(await getWebsite({ organizationId: input.organizationId })).toMatchObject({
			workflow: { kind: "translation", locale: "sv", state: "active" },
		});
		workflowRuns.set(input.runId, { exists: true, status: "failed", workflowName: translationWorkflowName });
		expect(await getWebsite({ organizationId: input.organizationId })).toMatchObject({ workflow: null });
		expect(await db.select().from(websites).where(eq(websites.id, input.websiteId))).toMatchObject([
			{ translationLocale: null, workflowRunId: null },
		]);
	});

	it.each(["failed", "cancelled", "completed"] as const)(
		"releases a %s run that still owns a website with a draft",
		async (status) => {
			const fixture = await createReadyWebsite();
			await db.update(websites).set({ workflowRunId: "run-terminal" }).where(eq(websites.id, websiteId));
			workflowRuns.set("run-terminal", { exists: true, status, workflowName: sectionAdditionWorkflowName });

			await expect(getWebsite({ organizationId: fixture.organization.id })).resolves.toMatchObject({
				workflow: null,
			});
			await expect(db.select().from(websites).where(eq(websites.id, websiteId))).resolves.toMatchObject([
				{ updatedAt: fixture.record.updatedAt, workflowRunId: null },
			]);
		}
	);

	it("cancels and releases an active run that outlived the stale window", async () => {
		const fixture = await createReadyWebsite();
		await db
			.update(websites)
			.set({ updatedAt: "2020-01-01T00:00:00.000Z", workflowRunId: "run-stuck" })
			.where(eq(websites.id, websiteId));
		workflowRuns.set("run-stuck", { exists: true, status: "running", workflowName: sectionAdditionWorkflowName });

		await expect(getWebsite({ organizationId: fixture.organization.id })).resolves.toMatchObject({
			workflow: null,
		});
		expect(cancelRun).toHaveBeenCalledWith({ cancelReason: "Website workflow exceeded its time limit" });
		await expect(db.select().from(websites).where(eq(websites.id, websiteId))).resolves.toMatchObject([
			{ workflowRunId: null },
		]);
	});

	it("cancels a stale initial generation but keeps its failed projection", async () => {
		const initial = await createGeneratingWebsite({
			updatedAt: "2020-01-01T00:00:00.000Z",
			workflowRunId: "run-stuck-initial",
		});

		workflowRuns.set("run-stuck-initial", {
			exists: true,
			status: "running",
			workflowName: generationWorkflowName,
		});

		await expect(getWebsite({ organizationId: initial.organizationId })).resolves.toMatchObject({
			workflow: { kind: "generation", runId: "run-stuck-initial", state: "failed" },
		});
		expect(cancelRun).toHaveBeenCalled();
		await expect(db.select().from(websites).where(eq(websites.id, initial.websiteId))).resolves.toMatchObject([
			{ workflowRunId: "run-stuck-initial" },
		]);
	});

	it("infers layout generation from the attached workflow", async () => {
		const fixture = await createReadyWebsite();

		await db.update(websites).set({ workflowRunId: "run-layout" }).where(eq(websites.id, websiteId));

		workflowRuns.set("run-layout", {
			exists: true,
			status: "running",
			workflowName: layoutGenerationWorkflowName,
		});

		await expect(getWebsite({ organizationId: fixture.organization.id })).resolves.toMatchObject({
			workflow: { kind: "layout-generation", runId: "run-layout", state: "active" },
		});
	});
});

describe("website workflow ownership", () => {
	it.each([false, true])("creates a matching Links draft once and preserves existing edits: %s", async (existing) => {
		const fixture = await createReadyWebsite();
		const organization = await createTestOrganization();
		organizationIds.push(organization.id);
		const prepared = await prepareWebsiteGenerationStart({ brief, organizationId: organization.id });
		await claimWebsiteWorkflowRun({
			brief,
			expectedRunId: null,
			kind: "generation",
			organizationId: organization.id,
			runId: "run-onboarding",
			websiteId: prepared.record.id,
		});
		const existingDocument = createDefaultLinkPageDocument({ name: "Manually edited Links" });

		if (existing) {
			await db.insert(linkPages).values({ document: existingDocument, organizationId: organization.id });
		}

		const completion = {
			organizationId: organization.id,
			site: fixture.site,
			websiteId: prepared.record.id,
			workflowRunId: "run-onboarding",
		};

		expect(await completeWebsiteWorkflow({ ...completion, workflowRunId: "stale-run" })).toBeNull();
		expect(await db.select().from(linkPages).where(eq(linkPages.organizationId, organization.id))).toHaveLength(
			existing ? 1 : 0
		);
		await completeWebsiteWorkflow(completion);
		const [links] = await db.select().from(linkPages).where(eq(linkPages.organizationId, organization.id));
		expect(links?.publishedAt).toBeNull();
		expect(links?.publishedDocument).toBeNull();
		expect(links?.document).toMatchObject(
			existing
				? existingDocument
				: {
						appearance: { brandOverride: null },
						profile: {
							bio: { ar: "A Toronto design studio.", en: "A Toronto design studio." },
							title: { ar: "Northstar", en: "Northstar" },
						},
					}
		);
		expect(links?.document.blocks.map((block) => (block.kind === "link" ? block.label : null))).toEqual(
			existing
				? []
				: [
						{ ar: "الموقع الإلكتروني", en: "Website" },
						{ ar: "من نحن", en: "About us" },
						{ ar: "خدماتنا", en: "Our services" },
						{ ar: "الأسئلة الشائعة", en: "FAQs" },
						{ ar: "تواصل معنا", en: "Contact us" },
					]
		);
		expect(links?.document.blocks.map((block) => (block.kind === "link" ? block.url : null))).toEqual(
			existing ? [] : ["/", "/about", "/services", "/faq", "/contact"]
		);
		expect(
			existing ||
				["business", "centered", "classic", "hero", "minimal-01", "minimal-04"].includes(
					links?.document.profile.layout ?? ""
				)
		).toBe(true);
		await completeWebsiteWorkflow(completion);
		expect(await db.select().from(linkPages).where(eq(linkPages.organizationId, organization.id))).toEqual([links]);
	});

	it("cancels only the attached run and preserves the current draft", async () => {
		const fixture = await createReadyWebsite();
		await db.update(websites).set({ workflowRunId: "run-cancel" }).where(eq(websites.id, websiteId));
		workflowRuns.set("run-cancel", { exists: true, status: "running" });

		await expect(
			cancelWebsiteWorkflow({
				organizationId: fixture.organization.id,
				websiteId,
				workflowRunId: "run-cancel",
			})
		).resolves.toBe(true);

		expect(cancelRun).toHaveBeenCalledWith({ cancelReason: "Cancelled by the website editor" });

		const readRecord = async () => {
			const [record] = await db.select().from(websites).where(eq(websites.id, websiteId));

			return record;
		};

		const record = await readRecord();
		expect(record).toMatchObject({
			draftVersionId: fixture.record.draftVersionId,
			workflowRunId: null,
		});

		await db.update(websites).set({ workflowRunId: "run-new" }).where(eq(websites.id, websiteId));

		await expect(
			cancelWebsiteWorkflow({
				organizationId: fixture.organization.id,
				websiteId,
				workflowRunId: "run-cancel",
			})
		).resolves.toBe(false);

		const updatedRecord = await readRecord();
		expect(updatedRecord?.workflowRunId).toBe("run-new");
		expect(cancelRun).toHaveBeenCalledOnce();
	});

	it("releases only the matching run of a website that has a draft, without changing the revision", async () => {
		const fixture = await createReadyWebsite();
		const organizationId = fixture.organization.id;
		await db
			.update(websites)
			.set({ translationLocale: "sv", workflowRunId: "run-release" })
			.where(eq(websites.id, websiteId));

		await expect(
			releaseWebsiteWorkflowRun({ organizationId, websiteId, workflowRunId: "run-other" })
		).resolves.toBe(false);
		await expect(
			releaseWebsiteWorkflowRun({ organizationId, websiteId, workflowRunId: "run-release" })
		).resolves.toBe(true);
		await expect(
			releaseWebsiteWorkflowRun({ organizationId, websiteId, workflowRunId: "run-release" })
		).resolves.toBe(false);
		await expect(db.select().from(websites).where(eq(websites.id, websiteId))).resolves.toMatchObject([
			{ translationLocale: null, updatedAt: fixture.record.updatedAt, workflowRunId: null },
		]);
	});

	it("does not release a website without a draft", async () => {
		const initial = await createGeneratingWebsite({ workflowRunId: "run-initial" });

		await expect(releaseWebsiteWorkflowRun({ ...initial, workflowRunId: "run-initial" })).resolves.toBe(false);
		await expect(db.select().from(websites).where(eq(websites.id, initial.websiteId))).resolves.toMatchObject([
			{ workflowRunId: "run-initial" },
		]);
	});

	it.each([
		[
			"claims a released website even when the caller still expects the released run",
			null,
			expect.objectContaining({ workflowRunId: "run-next" }),
		],
		["still refuses a claim when a different run owns the website", "run-other", null],
	])("%s", async (_name, owner, expected) => {
		const fixture = await createReadyWebsite();
		await db.update(websites).set({ workflowRunId: owner }).where(eq(websites.id, websiteId));

		const claimed = await claimWebsiteWorkflowRun({
			expectedRunId: "run-released",
			expectedUpdatedAt: fixture.record.updatedAt,
			kind: "section-addition",
			organizationId: fixture.organization.id,
			runId: "run-next",
			websiteId,
		});

		expect(claimed).toEqual(expected);
	});

	it("keeps the previous draft as a restore point only when the template changes", async () => {
		const fixture = await createReadyWebsite();

		const completion = {
			organizationId: fixture.organization.id,
			site: { ...fixture.site, templateId: "restyled-template" },
			websiteId,
		};

		const readVersions = () => db.select().from(websiteVersions).where(eq(websiteVersions.websiteId, websiteId));
		await db.update(websites).set({ workflowRunId: "run-template" }).where(eq(websites.id, websiteId));
		await completeWebsiteWorkflow({ ...completion, workflowRunId: "run-template" });

		const versions = await readVersions();
		const [record] = await db.select().from(websites).where(eq(websites.id, websiteId));
		expect(versions).toHaveLength(2);
		expect(versions.find(({ id }) => id === fixture.version.id)).toMatchObject({
			publishedAt: null,
			templateId: fixture.site.templateId,
			version: 1,
		});
		expect(versions.find(({ id }) => id === record?.draftVersionId)).toMatchObject({
			templateId: "restyled-template",
			version: 2,
		});

		await db.update(websites).set({ workflowRunId: "run-section" }).where(eq(websites.id, websiteId));
		await completeWebsiteWorkflow({ ...completion, workflowRunId: "run-section" });
		await expect(readVersions()).resolves.toHaveLength(2);
	});

	it("claims an initial generation with compare-and-set and rejects an active run", async () => {
		const organization = await createTestOrganization();
		organizationIds.push(organization.id);
		const prepared = await prepareWebsiteGenerationStart({ brief, organizationId: organization.id });

		const claimed = await claimWebsiteWorkflowRun({
			brief,
			expectedRunId: null,
			kind: "generation",
			organizationId: organization.id,
			runId: "run-1",
			websiteId: prepared.record.id,
		});

		expect(claimed?.workflowRunId).toBe("run-1");

		workflowRuns.set("run-1", { exists: true, status: "running" });

		await expect(prepareWebsiteGenerationStart({ brief, organizationId: organization.id })).rejects.toBeInstanceOf(
			WebsiteGenerationConflictError
		);
	});

	it("uses the same run column for section addition and clears it with the atomic site commit", async () => {
		const fixture = await createReadyWebsite();

		const prepared = await prepareWebsiteSectionAdditionStart({
			input: {
				index: 1,
				pageId: fixture.pageId,
				pattern: fixture.slot.definition.pattern,
				schemaVersion: 1,
			},
			organizationId: fixture.organization.id,
			websiteId,
		});

		const claim = {
			expectedRunId: prepared.expectedRunId,
			expectedUpdatedAt: prepared.record.updatedAt,
			kind: "section-addition" as const,
			organizationId: fixture.organization.id,
			runId: "run-addition",
			websiteId,
		};

		await expect(
			claimWebsiteWorkflowRun({ ...claim, expectedUpdatedAt: "1970-01-01T00:00:00.000Z" })
		).resolves.toBeNull();

		const claimed = await claimWebsiteWorkflowRun(claim);

		expect(claimed?.workflowRunId).toBe("run-addition");
		await expect(claimWebsiteWorkflowRun(claim)).resolves.toMatchObject({ workflowRunId: "run-addition" });

		workflowRuns.set("run-addition", { exists: true, status: "running" });

		await expect(
			prepareWebsiteSectionAdditionStart({
				input: prepared.input,
				organizationId: fixture.organization.id,
				websiteId,
			})
		).rejects.toBeInstanceOf(WebsiteSectionAdditionConflictError);

		const completed = await completeWebsiteWorkflow({
			organizationId: fixture.organization.id,
			site: fixture.site,
			websiteId,
			workflowRunId: "run-addition",
		});

		expect(completed?.document).toEqual({ ...fixture.site.document, direction: undefined, logic: {} });
		const [record] = await db.select().from(websites).where(eq(websites.id, websiteId));
		expect(record?.workflowRunId).toBeNull();
	});

	it("advances the revision across a clock-skewed section addition claim and completion", async () => {
		const fixture = await createReadyWebsite();

		const [futureRecord] = await db
			.update(websites)
			.set({ updatedAt: futureWebsiteUpdatedAt })
			.where(eq(websites.id, websiteId))
			.returning();

		if (!futureRecord) {
			throw new Error("Website section addition fixture was not found");
		}

		const claimed = await claimWebsiteWorkflowRun({
			expectedRunId: null,
			expectedUpdatedAt: futureRecord.updatedAt,
			kind: "section-addition",
			organizationId: fixture.organization.id,
			runId: "run-skewed-addition",
			websiteId,
		});

		if (!claimed) {
			throw new Error("Website section addition was not claimed");
		}

		expect(Date.parse(claimed.updatedAt)).toBeGreaterThan(Date.parse(futureRecord.updatedAt));

		await expect(
			completeWebsiteWorkflow({
				organizationId: fixture.organization.id,
				site: fixture.site,
				websiteId,
				workflowRunId: "run-skewed-addition",
			})
		).resolves.toMatchObject({ templateId: fixture.site.templateId });

		const [completedRecord] = await db.select().from(websites).where(eq(websites.id, websiteId));

		if (!completedRecord) {
			throw new Error("Completed website section addition was not found");
		}

		expect(Date.parse(completedRecord.updatedAt)).toBeGreaterThan(Date.parse(claimed.updatedAt));
	});

	it("replaces a terminal generation run and makes a repeated claim idempotent", async () => {
		const organization = await createTestOrganization();
		organizationIds.push(organization.id);
		const prepared = await prepareWebsiteGenerationStart({ brief, organizationId: organization.id });

		await db.update(websites).set({ workflowRunId: "run-terminal" }).where(eq(websites.id, prepared.record.id));
		workflowRuns.set("run-terminal", { exists: true, status: "failed" });

		const replacement = await prepareWebsiteGenerationStart({
			brief,
			organizationId: organization.id,
		});

		expect(replacement.expectedRunId).toBe("run-terminal");

		const claim = {
			brief,
			expectedRunId: "run-terminal",
			kind: "generation" as const,
			organizationId: organization.id,
			runId: "run-replacement",
			websiteId: prepared.record.id,
		};

		await expect(claimWebsiteWorkflowRun(claim)).resolves.toMatchObject({ workflowRunId: "run-replacement" });
		await expect(claimWebsiteWorkflowRun(claim)).resolves.toMatchObject({ workflowRunId: "run-replacement" });
	});

	it("validates section targets and exposes context only to the owning run", async () => {
		const fixture = await createReadyWebsite();

		await expect(
			prepareWebsiteSectionAdditionStart({
				input: {
					index: 0,
					pageId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d399",
					pattern: fixture.slot.definition.pattern,
					schemaVersion: 1,
				},
				organizationId: fixture.organization.id,
				websiteId,
			})
		).rejects.toBeInstanceOf(WebsiteSectionAdditionTargetError);

		await db.update(websites).set({ workflowRunId: "run-owner" }).where(eq(websites.id, websiteId));

		await expect(
			getWebsiteWorkflowContext({
				organizationId: fixture.organization.id,
				websiteId,
				workflowRunId: "run-stale",
			})
		).resolves.toBeNull();

		await expect(
			getWebsiteWorkflowContext({
				organizationId: fixture.organization.id,
				websiteId,
				workflowRunId: "run-owner",
			})
		).resolves.toMatchObject({ brief, site: { templateId: fixture.site.templateId } });
	});

	it("makes a repeated completion idempotent without accepting a stale owner", async () => {
		const fixture = await createReadyWebsite();

		const [owned] = await db
			.update(websites)
			.set({ updatedAt: futureWebsiteUpdatedAt, workflowRunId: "run-owner" })
			.where(eq(websites.id, websiteId))
			.returning();

		if (!owned) {
			throw new Error("Website workflow fixture was not claimed");
		}

		await expect(
			completeWebsiteWorkflow({
				organizationId: fixture.organization.id,
				site: fixture.site,
				websiteId,
				workflowRunId: "run-stale",
			})
		).resolves.toBeNull();

		const completion = {
			organizationId: fixture.organization.id,
			site: fixture.site,
			websiteId,
			workflowRunId: "run-owner",
		};

		await expect(completeWebsiteWorkflow(completion)).resolves.toMatchObject({
			templateId: fixture.site.templateId,
		});

		const [completedRecord] = await db.select().from(websites).where(eq(websites.id, websiteId));

		if (!completedRecord) {
			throw new Error("Completed website fixture was not found");
		}

		expect(Date.parse(completedRecord.updatedAt)).toBeGreaterThan(Date.parse(owned.updatedAt));

		await expect(completeWebsiteWorkflow(completion)).resolves.toMatchObject({
			templateId: fixture.site.templateId,
		});
	});
});

describe("website editing", () => {
	it("rejects scripted behavior that fails its document-boundary execution gate", async () => {
		const fixture = await createReadyWebsite();

		await expect(
			editWebsite({
				inputs: [
					{
						index: 0,
						operation: "add-composed-section",
						pageId: fixture.pageId,
						seed: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d350",
						specification: {
							content: {
								ar: {
									"amount-invalid": "\u0623\u062f\u062e\u0644 \u0631\u0642\u0645\u064b\u0627",
									"amount-label": "\u0627\u0644\u0645\u0628\u0644\u063a",
									"amount-placeholder": "100",
									heading: "\u062a\u0642\u062f\u064a\u0631",
									"result-label": "\u0627\u0644\u0646\u062a\u064a\u062c\u0629",
									"result-unavailable": "\u063a\u064a\u0631 \u0645\u062a\u0627\u062d",
								},
								en: {
									"amount-invalid": "Enter a number",
									"amount-label": "Amount",
									"amount-placeholder": "100",
									heading: "Estimate",
									"result-label": "Result",
									"result-unavailable": "Unavailable",
								},
							},
							logic: {
								fields: [{ initial: "100", key: "amount" }],
								kind: "script",
								outputs: ["result"],
								script: "function calculate() { while (true) {} }",
							},
							structure: {
								nodes: [
									{
										children: ["heading", "amount-field", "result-value"],
										key: "surface",
										props: {
											padding: {
												blockEnd: "5rem",
												blockStart: "5rem",
												inlineEnd: "1.5rem",
												inlineStart: "1.5rem",
											},
										},
										type: "box",
									},
									{
										children: [],
										key: "heading",
										props: { content: "heading", element: "h2" },
										type: "text",
									},
									{
										children: ["amount-label"],
										key: "amount-field",
										props: {
											invalid: "amount-invalid",
											placeholder: "amount-placeholder",
											slot: "amount",
										},
										type: "field",
									},
									{
										children: [],
										key: "amount-label",
										props: { content: "amount-label", element: "span" },
										type: "text",
									},
									{
										children: ["result-label"],
										key: "result-value",
										props: {
											format: { maximumFractionDigits: 2, style: "decimal" },
											output: "result",
											unavailable: "result-unavailable",
										},
										type: "value",
									},
									{
										children: [],
										key: "result-label",
										props: { content: "result-label", element: "span" },
										type: "text",
									},
								],
								root: "surface",
							},
						},
					},
				],
				organizationId: fixture.organization.id,
				updatedAt: fixture.record.updatedAt,
				websiteId,
			})
		).rejects.toBeInstanceOf(WebsiteEditError);

		const [record] = await db.select().from(websites).where(eq(websites.id, websiteId));
		expect(record?.updatedAt).toBe(fixture.record.updatedAt);
	});

	it("persists a section deletion and removes its localized content", async () => {
		const fixture = await createReadyWebsite();
		const section = fixture.site.document.structure.pages[0]?.sections[0];

		if (!section) {
			throw new Error("Expected a generated page section");
		}

		const [lockedRecord] = await db
			.update(websites)
			.set({ updatedAt: futureWebsiteUpdatedAt })
			.where(eq(websites.id, websiteId))
			.returning();

		if (!lockedRecord) {
			throw new Error("Website edit fixture was not found");
		}

		const updated = await editWebsite({
			inputs: [
				{
					operation: "delete",
					pageId: fixture.pageId,
					sectionId: section.id,
				},
			],
			organizationId: fixture.organization.id,
			updatedAt: lockedRecord.updatedAt,
			websiteId,
		});

		expect(updated.snapshot.document.structure.pages[0]?.sections).toEqual([]);
		expect(updated.snapshot.document.content.en?.sections[section.contentId]).toBeUndefined();
		expect(updated.snapshot.assets).toEqual({});
		expect(Date.parse(updated.updatedAt)).toBeGreaterThan(Date.parse(lockedRecord.updatedAt));

		const [record] = await db.select().from(websites).where(eq(websites.id, websiteId));

		const [draftVersion] = await db
			.select()
			.from(websiteVersions)
			.where(eq(websiteVersions.id, fixture.version.id));

		expect(record?.draftVersionId).toBe(fixture.version.id);
		expect(draftVersion?.content).toEqual(updated.snapshot.document.content);
		expect(draftVersion?.assetBindings).toEqual({});
	});

	it("rejects an edit based on a stale website version", async () => {
		const fixture = await createReadyWebsite();
		const section = fixture.site.document.structure.pages[0]?.sections[0];

		if (!section) {
			throw new Error("Expected a generated page section");
		}

		await db.update(websites).set({ updatedAt: "2026-08-15T12:00:00.000Z" }).where(eq(websites.id, websiteId));

		await expect(
			editWebsite({
				inputs: [
					{
						operation: "delete",
						pageId: fixture.pageId,
						sectionId: section.id,
					},
				],
				organizationId: fixture.organization.id,
				updatedAt: fixture.record.updatedAt,
				websiteId,
			})
		).rejects.toBeInstanceOf(WebsiteMutationConflictError);
	});

	it("does not edit while a workflow owns the website", async () => {
		const fixture = await createReadyWebsite();
		const section = fixture.site.document.structure.pages[0]?.sections[0];

		if (!section) {
			throw new Error("Expected a generated page section");
		}

		await db.update(websites).set({ workflowRunId: "run-owner" }).where(eq(websites.id, websiteId));
		workflowRuns.set("run-owner", { exists: true, status: "running" });

		await expect(
			editWebsite({
				inputs: [
					{
						operation: "move-down",
						pageId: fixture.pageId,
						sectionId: section.id,
					},
				],
				organizationId: fixture.organization.id,
				updatedAt: fixture.record.updatedAt,
				websiteId,
			})
		).rejects.toBeInstanceOf(WebsiteMutationConflictError);
	});

	it("applies a batch of edits atomically under a single revision bump", async () => {
		const fixture = await createReadyWebsite();
		const section = fixture.site.document.structure.pages[0]?.sections[0];

		if (!section) {
			throw new Error("Expected a generated page section");
		}

		const updated = await editWebsite({
			inputs: [
				{
					brand: { ...fixture.site.brand, corners: { style: "soft" } },
					operation: "update-brand",
				},
				{
					operation: "delete",
					pageId: fixture.pageId,
					sectionId: section.id,
				},
			],
			organizationId: fixture.organization.id,
			updatedAt: fixture.record.updatedAt,
			websiteId,
		});

		expect(updated.snapshot.brand.corners.style).toBe("soft");
		expect(updated.snapshot.document.structure.pages[0]?.sections).toEqual([]);
		expect(Date.parse(updated.updatedAt)).toBeGreaterThan(Date.parse(fixture.record.updatedAt));

		const versions = await db.select().from(websiteVersions).where(eq(websiteVersions.websiteId, websiteId));
		const [record] = await db.select().from(websites).where(eq(websites.id, websiteId));

		expect(versions).toHaveLength(1);
		expect(record?.updatedAt).toBe(updated.updatedAt);
	});

	it.each<[string, { exists: boolean; status: "cancelled" | "failed"; workflowName?: string } | undefined]>([
		["a failed section addition", { exists: true, status: "failed", workflowName: sectionAdditionWorkflowName }],
		[
			"a cancelled layout generation",
			{ exists: true, status: "cancelled", workflowName: layoutGenerationWorkflowName },
		],
		["a failed template change", { exists: true, status: "failed", workflowName: generationWorkflowName }],
		["a run that no longer exists", undefined],
	])("edits after %s", async (_name, run) => {
		const fixture = await createReadyWebsite();
		await db.update(websites).set({ workflowRunId: "run-failed" }).where(eq(websites.id, websiteId));

		if (run) {
			workflowRuns.set("run-failed", run);
		}

		const updated = await editWebsite({
			inputs: [{ brand: { ...fixture.site.brand, corners: { style: "soft" } }, operation: "update-brand" }],
			organizationId: fixture.organization.id,
			updatedAt: fixture.record.updatedAt,
			websiteId,
		});

		expect(updated.snapshot.brand.corners.style).toBe("soft");
		await expect(db.select().from(websites).where(eq(websites.id, websiteId))).resolves.toMatchObject([
			{ workflowRunId: null },
		]);
	});

	it("keeps a restore point when a restyle edit changes the template", async () => {
		const fixture = await createReadyWebsite();

		const updated = await editWebsite({
			inputs: [{ brand: { ...fixture.site.brand, corners: { style: "soft" } }, operation: "update-brand" }],
			organizationId: fixture.organization.id,
			templateId: "restyled-template",
			updatedAt: fixture.record.updatedAt,
			websiteId,
		});

		expect(updated.snapshot.templateId).toBe("restyled-template");
		const versions = await db.select().from(websiteVersions).where(eq(websiteVersions.websiteId, websiteId));
		expect(versions).toHaveLength(2);
		expect(versions.find(({ id }) => id === fixture.version.id)).toMatchObject({
			templateId: fixture.site.templateId,
		});
	});

	it("persists a validated brand update without changing website content or assets", async () => {
		const fixture = await createReadyWebsite();

		const updated = await editWebsite({
			inputs: [
				{
					brand: { ...fixture.site.brand, corners: { style: "soft" } },
					operation: "update-brand",
				},
			],
			organizationId: fixture.organization.id,
			updatedAt: fixture.record.updatedAt,
			websiteId,
		});

		expect(updated.snapshot.brand.corners.style).toBe("soft");
		expect(updated.snapshot.document).toEqual({ ...fixture.site.document, direction: undefined, logic: {} });
		expect(Object.keys(updated.snapshot.assets)).toHaveLength(Object.keys(fixture.site.assetBindings).length);
		expect(updated.publication).toEqual({ hasUnpublishedChanges: true, publishedAt: null });

		const [record] = await db.select().from(websites).where(eq(websites.id, websiteId));

		const [draftVersion] = await db
			.select()
			.from(websiteVersions)
			.where(eq(websiteVersions.id, fixture.version.id));

		expect(record?.draftVersionId).toBe(fixture.version.id);
		expect(draftVersion?.brand).toEqual(updated.snapshot.brand);
		expect(draftVersion?.content).toEqual(fixture.version.content);
		expect(draftVersion?.assetBindings).toEqual(fixture.site.assetBindings);
	});
});

describe("website publication", () => {
	it("publishes the current draft without creating a duplicate version", async () => {
		const fixture = await createReadyWebsite();

		const [lockedRecord] = await db
			.update(websites)
			.set({ updatedAt: futureWebsiteUpdatedAt })
			.where(eq(websites.id, websiteId))
			.returning();

		if (!lockedRecord) {
			throw new Error("Website publication fixture was not found");
		}

		const published = await publishWebsite({
			organizationId: fixture.organization.id,
			updatedAt: lockedRecord.updatedAt,
			websiteId,
		});

		expect(published.publication).toMatchObject({
			hasUnpublishedChanges: false,
			publishedAt: expect.any(String),
		});

		expect(Date.parse(published.updatedAt)).toBeGreaterThan(Date.parse(lockedRecord.updatedAt));

		const [record] = await db.select().from(websites).where(eq(websites.id, websiteId));
		const versions = await db.select().from(websiteVersions).where(eq(websiteVersions.websiteId, websiteId));

		expect(record).toMatchObject({
			draftVersionId: fixture.version.id,
			publishedVersionId: fixture.version.id,
		});

		expect(versions).toHaveLength(1);
		expect(versions[0]?.publishedAt).toBe(published.publication.publishedAt);
		await expect(getReadyWebsite({ websiteId })).resolves.toEqual(published.snapshot);
	});

	it("copies a published version before editing and keeps the live snapshot unchanged", async () => {
		const fixture = await createReadyWebsite();
		const section = fixture.site.document.structure.pages[0]?.sections[0];

		if (!section) {
			throw new Error("Expected a generated page section");
		}

		const published = await publishWebsite({
			organizationId: fixture.organization.id,
			updatedAt: fixture.record.updatedAt,
			websiteId,
		});

		const cornerStyle = fixture.site.brand.corners.style === "square" ? "soft" : "square";

		const edited = await editWebsite({
			inputs: [
				{
					brand: { ...fixture.site.brand, corners: { style: cornerStyle } },
					operation: "update-brand",
				},
				{
					operation: "delete",
					pageId: fixture.pageId,
					sectionId: section.id,
				},
			],
			organizationId: fixture.organization.id,
			updatedAt: published.updatedAt,
			websiteId,
		});

		const [record] = await db.select().from(websites).where(eq(websites.id, websiteId));
		const versions = await db.select().from(websiteVersions).where(eq(websiteVersions.websiteId, websiteId));
		const original = versions.find(({ id }) => id === record?.publishedVersionId);
		const draft = versions.find(({ id }) => id === record?.draftVersionId);

		expect(versions).toHaveLength(2);
		expect(record?.publishedVersionId).toBe(fixture.version.id);
		expect(record?.draftVersionId).not.toBe(record?.publishedVersionId);
		expect(original).toMatchObject({ brand: fixture.site.brand, publishedAt: expect.any(String), version: 1 });
		expect(draft).toMatchObject({ brand: edited.snapshot.brand, publishedAt: null, version: 2 });
		expect(original?.assetBindings).toEqual(fixture.site.assetBindings);
		expect(draft?.assetBindings).toEqual({});

		expect(edited.publication).toEqual({
			hasUnpublishedChanges: true,
			publishedAt: published.publication.publishedAt,
		});

		await expect(getReadyWebsite({ websiteId })).resolves.toEqual(published.snapshot);

		await expect(getWebsite({ organizationId: fixture.organization.id })).resolves.toMatchObject({
			publication: { hasUnpublishedChanges: true, publishedAt: published.publication.publishedAt },
			snapshot: { brand: { corners: { style: cornerStyle } } },
		});

		const republished = await publishWebsite({
			organizationId: fixture.organization.id,
			updatedAt: edited.updatedAt,
			websiteId,
		});

		await expect(getReadyWebsite({ publishedVersionId: fixture.version.id, websiteId })).resolves.toEqual(
			published.snapshot
		);
		await expect(getReadyWebsite({ websiteId })).resolves.toEqual(republished.snapshot);
	});

	it("publishes after a failed workflow run released the website", async () => {
		const fixture = await createReadyWebsite();
		await db.update(websites).set({ workflowRunId: "run-failed" }).where(eq(websites.id, websiteId));
		workflowRuns.set("run-failed", { exists: true, status: "failed", workflowName: generationWorkflowName });

		await expect(
			publishWebsite({ organizationId: fixture.organization.id, updatedAt: fixture.record.updatedAt, websiteId })
		).resolves.toMatchObject({ publication: { hasUnpublishedChanges: false } });
		await expect(db.select().from(websites).where(eq(websites.id, websiteId))).resolves.toMatchObject([
			{ workflowRunId: null },
		]);
	});

	it("keeps rejecting a publish while the attached run is active", async () => {
		const fixture = await createReadyWebsite();
		await db.update(websites).set({ workflowRunId: "run-active" }).where(eq(websites.id, websiteId));
		workflowRuns.set("run-active", { exists: true, status: "running", workflowName: generationWorkflowName });

		await expect(
			publishWebsite({ organizationId: fixture.organization.id, updatedAt: fixture.record.updatedAt, websiteId })
		).rejects.toBeInstanceOf(WebsiteMutationConflictError);
		await expect(db.select().from(websites).where(eq(websites.id, websiteId))).resolves.toMatchObject([
			{ workflowRunId: "run-active" },
		]);
	});

	it("rejects publishing a stale website revision", async () => {
		const fixture = await createReadyWebsite();

		await db.update(websites).set({ updatedAt: "2026-08-15T12:00:00.000Z" }).where(eq(websites.id, websiteId));

		await expect(
			publishWebsite({
				organizationId: fixture.organization.id,
				updatedAt: fixture.record.updatedAt,
				websiteId,
			})
		).rejects.toBeInstanceOf(WebsiteMutationConflictError);
	});

	it("unpublishes, keeps the draft, and republishes the same version", async () => {
		const fixture = await createReadyWebsite();

		const published = await publishWebsite({
			organizationId: fixture.organization.id,
			updatedAt: fixture.record.updatedAt,
			websiteId,
		});

		const unpublished = await unpublishWebsite({
			organizationId: fixture.organization.id,
			updatedAt: published.updatedAt,
			websiteId,
		});

		expect(unpublished.publication).toEqual({ hasUnpublishedChanges: true, publishedAt: null });
		expect(Date.parse(unpublished.updatedAt)).toBeGreaterThan(Date.parse(published.updatedAt));
		await expect(getReadyWebsite({ websiteId })).resolves.toBeNull();
		await expect(getPublishedWebsiteVersionId({ websiteId })).resolves.toBeNull();

		const [record] = await db.select().from(websites).where(eq(websites.id, websiteId));

		expect(record).toMatchObject({ draftVersionId: fixture.version.id, publishedVersionId: null });

		const republished = await publishWebsite({
			organizationId: fixture.organization.id,
			updatedAt: unpublished.updatedAt,
			websiteId,
		});

		expect(republished.publication.hasUnpublishedChanges).toBe(false);
		await expect(getPublishedWebsiteVersionId({ websiteId })).resolves.toBe(fixture.version.id);
		expect(await db.select().from(websiteVersions).where(eq(websiteVersions.websiteId, websiteId))).toHaveLength(1);
	});

	it("rejects unpublishing with a stale timestamp or an active workflow", async () => {
		const fixture = await createReadyWebsite();

		await expect(
			unpublishWebsite({
				organizationId: fixture.organization.id,
				updatedAt: "2000-01-01T00:00:00.000Z",
				websiteId,
			})
		).rejects.toBeInstanceOf(WebsiteMutationConflictError);

		await db.update(websites).set({ workflowRunId: "run-active" }).where(eq(websites.id, websiteId));
		workflowRuns.set("run-active", { exists: true, status: "running" });

		await expect(
			unpublishWebsite({
				organizationId: fixture.organization.id,
				updatedAt: fixture.record.updatedAt,
				websiteId,
			})
		).rejects.toBeInstanceOf(WebsiteMutationConflictError);
	});

	it("hides a suspended website from public readers without touching the published pointer", async () => {
		const fixture = await createReadyWebsite();

		const published = await publishWebsite({
			organizationId: fixture.organization.id,
			updatedAt: fixture.record.updatedAt,
			websiteId,
		});

		await db
			.update(websites)
			.set({ suspendedAt: new Date().toISOString(), suspensionReason: "abuse" })
			.where(eq(websites.id, websiteId));

		await expect(getPublishedWebsiteVersionId({ websiteId })).resolves.toBeNull();
		await expect(getReadyWebsite({ websiteId })).resolves.toBeNull();
		await expect(getReadyWebsite({ publishedVersionId: fixture.version.id, websiteId })).resolves.toBeNull();

		const [suspended] = await db.select().from(websites).where(eq(websites.id, websiteId));

		expect(suspended?.publishedVersionId).toBe(fixture.version.id);

		await db.update(websites).set({ suspendedAt: null, suspensionReason: null }).where(eq(websites.id, websiteId));

		await expect(getPublishedWebsiteVersionId({ websiteId })).resolves.toBe(fixture.version.id);
		await expect(getReadyWebsite({ websiteId })).resolves.toEqual(published.snapshot);
		await expect(getReadyWebsite({ publishedVersionId: fixture.version.id, websiteId })).resolves.toEqual(
			published.snapshot
		);
	});
});

describe("website workflow stream", () => {
	it("replays events and synthesizes authoritative completion after the run clears", async () => {
		const fixture = await createReadyWebsite();
		const record: WebsiteRecord = { ...fixture.record, workflowRunId: "run-stream" };

		workflowRuns.set("run-stream", {
			events: [{ eventKey: "status:planning", stage: "planning", type: "status", version: 1 }],
			exists: true,
			status: "running",
		});

		const events = [];

		for await (const envelope of streamWebsiteWorkflow({ record, runId: "run-stream" })) {
			events.push(envelope);
		}

		expect(events).toHaveLength(2);
		expect(events[0]).toMatchObject({ cursor: "0", event: { type: "status" } });
		expect(events[1]).toMatchObject({ cursor: "1", event: { type: "completed" } });
	});

	it("synthesizes the operation-specific failure code from Workflow status", async () => {
		workflowRuns.set("run-failed", {
			exists: true,
			status: "failed",
			workflowName: generationWorkflowName,
		});

		const events = [];

		for await (const envelope of streamWebsiteWorkflow({
			record: { ...baseRecord, workflowRunId: "run-failed" },
			runId: "run-failed",
		})) {
			events.push(envelope);
		}

		expect(events).toEqual([
			{
				cursor: "0",
				event: { code: "GENERATION_FAILED", eventKey: "failed", type: "failed", version: 1 },
			},
		]);
	});

	it("emits cancellation instead of reporting an editor-cancelled run as failed", async () => {
		workflowRuns.set("run-cancelled", {
			exists: true,
			status: "cancelled",
			workflowName: generationWorkflowName,
		});

		const events = [];

		for await (const envelope of streamWebsiteWorkflow({
			record: { ...baseRecord, workflowRunId: "run-cancelled" },
			runId: "run-cancelled",
		})) {
			events.push(envelope);
		}

		expect(events).toEqual([
			{
				cursor: "0",
				event: { eventKey: "cancelled", type: "cancelled", version: 1 },
			},
		]);
	});

	it("rejects a completed section addition that is still attached to the website", async () => {
		const fixture = await createReadyWebsite();

		workflowRuns.set("run-attached", {
			exists: true,
			status: "completed",
			workflowName: sectionAdditionWorkflowName,
		});

		await db.update(websites).set({ workflowRunId: "run-attached" }).where(eq(websites.id, fixture.record.id));
		const events = [];

		for await (const envelope of streamWebsiteWorkflow({
			record: { ...fixture.record, workflowRunId: "run-attached" },
			runId: "run-attached",
		})) {
			events.push(envelope);
		}

		expect(events).toEqual([
			{
				cursor: "0",
				event: { code: "SECTION_ADDITION_FAILED", eventKey: "failed", type: "failed", version: 1 },
			},
		]);
	});

	it("uses a generic failure when the attached Workflow run is unavailable", async () => {
		const fixture = await createReadyWebsite();
		await db.update(websites).set({ workflowRunId: "run-missing" }).where(eq(websites.id, fixture.record.id));
		const events = [];

		for await (const envelope of streamWebsiteWorkflow({
			record: { ...fixture.record, workflowRunId: "run-missing" },
			runId: "run-missing",
		})) {
			events.push(envelope);
		}

		expect(events).toEqual([
			{
				cursor: "0",
				event: { code: "WORKFLOW_FAILED", eventKey: "failed", type: "failed", version: 1 },
			},
		]);
	});

	it("resumes after the requested cursor and does not duplicate a terminal event", async () => {
		workflowRuns.set("run-terminal", {
			events: [
				{ eventKey: "status:planning", stage: "planning", type: "status", version: 1 },
				{ code: "GENERATION_FAILED", eventKey: "failed", type: "failed", version: 1 },
			],
			exists: true,
			status: "completed",
		});

		const events = [];

		for await (const envelope of streamWebsiteWorkflow({
			afterCursor: "0",
			record: { ...baseRecord, workflowRunId: "run-terminal" },
			runId: "run-terminal",
		})) {
			events.push(envelope);
		}

		expect(events).toEqual([
			{
				cursor: "1",
				event: { code: "GENERATION_FAILED", eventKey: "failed", type: "failed", version: 1 },
			},
		]);
	});

	it("cancels an existing orphan run and tolerates cleanup failures", async () => {
		workflowRuns.set("run-orphan", { exists: true, status: "running" });

		await cancelWebsiteWorkflowRun({ runId: "run-orphan" });
		expect(cancelRun).toHaveBeenCalledWith({ cancelReason: "Website workflow lost resource ownership" });

		getRun.mockImplementationOnce(() => {
			throw new Error("world unavailable");
		});

		await expect(cancelWebsiteWorkflowRun({ runId: "run-missing" })).resolves.toBeUndefined();
	});
});

describe("website tenant isolation", () => {
	const createOtherOrganization = async () => {
		const other = await createTestOrganization();
		organizationIds.push(other.id);

		return other;
	};

	it("does not publish a website for another organization", async () => {
		const fixture = await createReadyWebsite();
		const other = await createOtherOrganization();

		await expect(
			publishWebsite({ organizationId: other.id, updatedAt: fixture.record.updatedAt, websiteId })
		).rejects.toBeInstanceOf(WebsiteDraftNotFoundError);

		const [row] = await db.select().from(websites).where(eq(websites.id, websiteId));
		expect(row?.publishedVersionId).toBeNull();
	});

	it("does not edit a website for another organization", async () => {
		const fixture = await createReadyWebsite();
		const other = await createOtherOrganization();
		const sectionId = fixture.site.document.structure.pages[0]?.sections[0]?.id;

		if (!sectionId) {
			throw new Error("Ready website fixture has no section");
		}

		await expect(
			editWebsite({
				inputs: [{ operation: "delete", pageId: fixture.pageId, sectionId }],
				organizationId: other.id,
				updatedAt: fixture.record.updatedAt,
				websiteId,
			})
		).rejects.toBeInstanceOf(WebsiteDraftNotFoundError);

		const [row] = await db.select().from(websiteVersions).where(eq(websiteVersions.id, fixture.version.id));
		expect(row?.structure).toEqual(fixture.version.structure);
	});

	it("does not cancel a workflow for another organization", async () => {
		await createReadyWebsite();
		const other = await createOtherOrganization();
		await db.update(websites).set({ workflowRunId: "run-x" }).where(eq(websites.id, websiteId));

		await expect(
			cancelWebsiteWorkflow({ organizationId: other.id, websiteId, workflowRunId: "run-x" })
		).resolves.toBe(false);

		const [row] = await db.select().from(websites).where(eq(websites.id, websiteId));
		expect(row?.workflowRunId).toBe("run-x");
	});
});
