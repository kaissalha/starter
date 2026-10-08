import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockOrganizationPermissions } from "../../mocks/organization-permissions";

vi.mock("@/lib/api-client", () => ({ apiClient: {}, client: {} }));

import {
	initialWebsiteGenerationState,
	reduceGenerationEvent,
	selectWebsiteEditorLocked,
	useWebsiteGenerationStore,
} from "@/app/[locale]/dashboard/website/generation/website-generation-store";
import {
	createWebsiteGenerationShell,
	selectWebsiteGenerationProfile,
	type WebsiteGenerationEnvelopeV1,
	type WebsiteGenerationPlan,
} from "@starter/infinite-website/generation";

const websiteId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d";

const sectionId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d330";

const assetId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32f";

const applyEnvelope = (envelope: WebsiteGenerationEnvelopeV1) =>
	useWebsiteGenerationStore.getState().applyEnvelopes({ envelopes: [envelope] });

const createSnapshot = () => {
	const profile = selectWebsiteGenerationProfile({ businessType: "Design studio" });

	const plan: WebsiteGenerationPlan = {
		kind: "plan",
		pages: (["home", "about", "services", "faq", "contact"] as const).map((pageKey) => ({
			description: `A Toronto design studio ${pageKey} page.`,
			pageKey,
			title: pageKey === "home" ? "Northstar" : `Northstar ${pageKey}`,
		})),
		siteDescription: "A Toronto design studio.",
	};

	return createWebsiteGenerationShell({
		brief: { location: "Toronto", name: "Northstar", schemaVersion: 1, type: "Design studio" },
		localizations: { byLocale: { en: plan }, defaultLocale: "en" },
		profile,
		websiteId,
	});
};

beforeEach(() => {
	useWebsiteGenerationStore.setState(initialWebsiteGenerationState);
	useWebsiteGenerationStore.getState().startGeneration();
	useWebsiteGenerationStore.getState().attachWorkflow({ runId: "run-generation", websiteId });
});

describe("website generation store", () => {
	it("applies a burst of workflow events in one store notification", () => {
		const notificationsReference = { value: 0 };

		const unsubscribe = useWebsiteGenerationStore.subscribe(() => {
			notificationsReference.value += 1;
		});

		useWebsiteGenerationStore.getState().applyEnvelopes({
			envelopes: [
				{
					cursor: "0",
					event: { eventKey: "status:planning", stage: "planning", type: "status", version: 1 },
				},
				{
					cursor: "1",
					event: { eventKey: "status:writing", stage: "writing", type: "status", version: 1 },
				},
				{
					cursor: "2",
					event: { eventKey: "status:saving", stage: "saving", type: "status", version: 1 },
				},
			],
		});

		unsubscribe();

		expect(notificationsReference.value).toBe(1);

		expect(useWebsiteGenerationStore.getState()).toMatchObject({
			stage: "saving",
			workflow: { cursor: "2" },
		});
	});

	it("initializes a valid preview from the prepared event", () => {
		const snapshot = createSnapshot();

		applyEnvelope({
			cursor: "2",
			event: {
				eventKey: "prepared",
				slots: [
					{
						assetIds: [assetId],
						sectionId,
						slotKey: "pages.home.hero",
						target: {
							area: "page",
							index: 0,
							pageId: snapshot.document.structure.pages[0]?.id ?? websiteId,
						},
					},
				],
				snapshot,
				type: "prepared",
				version: 1,
			},
		});

		const state = useWebsiteGenerationStore.getState();

		expect(state).toMatchObject({ sectionsTotal: 1, workflow: { cursor: "2", phase: "streaming" } });
		expect(state.snapshot).toEqual(snapshot);
		expect(state.readiness[sectionId]).toMatchObject({ assetIds: [assetId], contentReady: false });

		applyEnvelope({
			cursor: "3",
			event: {
				asset: { src: "https://cdn.example.com/photo.webp", type: "image" },
				assetId,
				eventKey: `asset:${assetId}`,
				outcome: "provider",
				slotKey: "pages.home.hero",
				type: "asset-settled",
				version: 1,
			},
		});

		useWebsiteGenerationStore.getState().markAssetLoaded({ assetId, sectionId });

		expect(useWebsiteGenerationStore.getState().readiness[sectionId]?.resolvedAssetIds).toEqual({
			[assetId]: true,
		});

		const loaded = useWebsiteGenerationStore.getState();
		useWebsiteGenerationStore.getState().markAssetLoaded({ assetId, sectionId });
		expect(useWebsiteGenerationStore.getState()).toBe(loaded);
	});

	it("replaces replayed assets with constant-time duplicate tracking", () => {
		const snapshot = { ...createSnapshot(), assets: { [assetId]: { src: "/old.svg", type: "image" as const } } };
		useWebsiteGenerationStore.getState().recover({ snapshot });

		useWebsiteGenerationStore.getState().resumeWorkflow({
			kind: "generation",
			runId: "run-replay",
			snapshot,
			websiteId,
		});

		const envelope = {
			cursor: "5",
			event: {
				asset: { src: "https://cdn.example.com/photo.webp", type: "image" as const },
				assetId,
				eventKey: `asset:${assetId}`,
				outcome: "provider" as const,
				slotKey: "pages.home.hero",
				type: "asset-settled" as const,
				version: 1 as const,
			},
		};

		applyEnvelope(envelope);
		applyEnvelope(envelope);
		const replay = useWebsiteGenerationStore.getState();

		expect(Object.keys(replay.snapshot?.assets ?? {})).toEqual([assetId]);
		expect(replay.snapshot?.assets[assetId]?.src).toBe("https://cdn.example.com/photo.webp");
		expect(replay.completedEventKeys).toEqual({ [`asset:${assetId}`]: true });
	});

	it("distinguishes a recoverable disconnect from generation failure", () => {
		useWebsiteGenerationStore.getState().disconnectWorkflow();
		const disconnected = useWebsiteGenerationStore.getState();
		useWebsiteGenerationStore.getState().reconnect();
		const reconnecting = useWebsiteGenerationStore.getState();

		expect(disconnected.workflow).toMatchObject({ phase: "disconnected" });
		expect(reconnecting.workflow).toMatchObject({ phase: "streaming" });
	});

	it("restores the authoritative site when a section addition fails", () => {
		const snapshot = createSnapshot();

		const optimisticSnapshot = {
			...snapshot,
			assets: { ...snapshot.assets, [assetId]: { src: "/preview.svg", type: "image" as const } },
		};

		const workflowRunId = "run-addition";
		useWebsiteGenerationStore.getState().recover({ snapshot });

		useWebsiteGenerationStore.getState().startSectionAddition({
			baseSnapshot: snapshot,
			snapshot: optimisticSnapshot,
			target: { index: 0, pageId: snapshot.document.structure.pages[0]?.id ?? websiteId },
			websiteId,
		});

		expect(useWebsiteGenerationStore.getState().snapshot).toEqual(optimisticSnapshot);

		useWebsiteGenerationStore.getState().attachWorkflow({ runId: workflowRunId, websiteId });

		applyEnvelope({
			cursor: "2",
			event: {
				code: "SECTION_ADDITION_FAILED",
				eventKey: "failed",
				type: "failed",
				version: 1,
			},
		});

		expect(useWebsiteGenerationStore.getState()).toMatchObject({
			snapshot,
			workflow: { kind: "section-addition", phase: "failed", runId: workflowRunId },
		});
	});

	it("restores the authoritative site when layout generation fails", () => {
		const snapshot = createSnapshot();

		const optimisticSnapshot = {
			...snapshot,
			assets: { ...snapshot.assets, [assetId]: { src: "/placeholder.svg", type: "image" as const } },
		};

		const page = snapshot.document.structure.pages[0];

		if (!page) {
			throw new Error("Expected a layout generation page");
		}

		useWebsiteGenerationStore.getState().recover({ snapshot });

		useWebsiteGenerationStore.getState().startLayoutGeneration({
			assetIds: [assetId],
			baseSnapshot: snapshot,
			pattern: "banner-bottom-card",
			snapshot: optimisticSnapshot,
			target: { area: "page", index: 0, pageId: page.id, sectionId },
			websiteId,
		});

		expect(useWebsiteGenerationStore.getState()).toMatchObject({
			readiness: { [sectionId]: { assetIds: [assetId], contentReady: false } },
			snapshot: optimisticSnapshot,
			workflow: { baseSnapshot: snapshot, optimisticSnapshot },
		});

		useWebsiteGenerationStore.getState().attachWorkflow({ runId: "run-layout", websiteId });

		applyEnvelope({
			cursor: "0",
			event: {
				code: "LAYOUT_GENERATION_FAILED",
				eventKey: "failed",
				type: "failed",
				version: 1,
			},
		});

		expect(useWebsiteGenerationStore.getState()).toMatchObject({
			readiness: {},
			snapshot,
			workflow: { kind: "layout-generation", phase: "failed", runId: "run-layout" },
		});
	});

	it("keeps an instant theme preview while template generation starts", () => {
		const snapshot = createSnapshot();

		const optimisticSnapshot = {
			...snapshot,
			brand: {
				...snapshot.brand,
				colors: { ...snapshot.brand.colors, primary: "#123456" as const },
			},
		};

		useWebsiteGenerationStore.getState().recover({ snapshot });
		useWebsiteGenerationStore.getState().startTemplateChange({
			baseSnapshot: snapshot,
			snapshot: optimisticSnapshot,
			websiteId,
		});

		expect(useWebsiteGenerationStore.getState()).toMatchObject({
			snapshot: optimisticSnapshot,
			workflow: { baseSnapshot: snapshot, kind: "template-change", phase: "starting" },
		});

		useWebsiteGenerationStore.getState().failWorkflow();

		expect(useWebsiteGenerationStore.getState()).toMatchObject({
			snapshot,
			workflow: { kind: "template-change", phase: "failed" },
		});
	});

	it("tracks status, content readiness, completion, and duplicate replay", () => {
		const snapshot = createSnapshot();

		const preparedEnvelope = {
			cursor: "0",
			event: {
				eventKey: "prepared" as const,
				slots: [
					{
						assetIds: [],
						sectionId,
						slotKey: "pages.home.hero",
						target: {
							area: "page" as const,
							index: 0,
							pageId: snapshot.document.structure.pages[0]?.id ?? websiteId,
						},
					},
				],
				snapshot,
				type: "prepared" as const,
				version: 1 as const,
			},
		};

		applyEnvelope(preparedEnvelope);

		applyEnvelope({
			cursor: "1",
			event: { eventKey: "status:writing", stage: "writing", type: "status", version: 1 },
		});

		const sectionEnvelope = {
			cursor: "2",
			event: {
				content: { en: {} },
				eventKey: `section:${sectionId}` as const,
				section: {
					anchor: "hero",
					category: "hero" as const,
					contentId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d331",
					id: sectionId,
					root: {
						id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d332",
						props: { children: [] },
						type: "box" as const,
					},
					source: { pattern: "test-hero" },
				},
				slotKey: "pages.home.hero",
				target: preparedEnvelope.event.slots[0]?.target ?? { area: "header" as const, index: 0 },
				type: "section" as const,
				version: 1 as const,
			},
		};

		const sectionState = reduceGenerationEvent({
			appliedSnapshot: { snapshot },
			envelope: sectionEnvelope,
			state: useWebsiteGenerationStore.getState(),
		});

		expect(sectionState).toMatchObject({
			readiness: { [sectionId]: { contentReady: true } },
			sectionsCompleted: 1,
			sectionsTotal: 1,
			stage: "writing",
			workflow: { cursor: "2" },
		});

		const duplicate = reduceGenerationEvent({
			appliedSnapshot: { snapshot },
			envelope: { ...sectionEnvelope, cursor: "3" },
			state: sectionState,
		});

		expect(duplicate.sectionsCompleted).toBe(1);
		expect(duplicate.workflow).toMatchObject({ cursor: "3" });

		const completed = reduceGenerationEvent({
			appliedSnapshot: { snapshot },
			envelope: {
				cursor: "4",
				event: { eventKey: "completed", snapshot, type: "completed", version: 1 },
			},
			state: duplicate,
		});

		expect(completed.workflow.phase).toBe("reconciling");
		expect(selectWebsiteEditorLocked(completed)).toBe(true);
		expect(completed.readiness).toEqual({});
	});

	it("marks every pending generation section failed and locks the editor", () => {
		const snapshot = createSnapshot();

		applyEnvelope({
			cursor: "0",
			event: {
				eventKey: "prepared",
				slots: [
					{
						assetIds: [assetId],
						sectionId,
						slotKey: "pages.home.hero",
						target: { area: "header", index: 0 },
					},
				],
				snapshot,
				type: "prepared",
				version: 1,
			},
		});

		applyEnvelope({
			cursor: "1",
			event: { code: "GENERATION_FAILED", eventKey: "failed", type: "failed", version: 1 },
		});

		const failed = useWebsiteGenerationStore.getState();

		expect(failed.readiness[sectionId]?.failed).toBe(true);
		expect(failed.workflow).toMatchObject({ kind: "generation", phase: "failed" });
		expect(selectWebsiteEditorLocked(failed)).toBe(true);
	});

	it("rolls back an externally cancelled generation and clears streamed readiness", () => {
		const snapshot = createSnapshot();

		applyEnvelope({
			cursor: "0",
			event: {
				eventKey: "prepared",
				slots: [{ assetIds: [], sectionId, slotKey: "pages.home.hero", target: { area: "header", index: 0 } }],
				snapshot,
				type: "prepared",
				version: 1,
			},
		});

		applyEnvelope({ cursor: "1", event: { eventKey: "cancelled", type: "cancelled", version: 1 } });

		expect(useWebsiteGenerationStore.getState()).toMatchObject({
			readiness: {},
			sectionsCompleted: 0,
			sectionsTotal: 0,
			snapshot: null,
			workflow: { phase: "idle" },
		});
	});

	it("supports navigation, catalog controls, resume, reconnect, and recovery", () => {
		const snapshot = createSnapshot();
		const store = useWebsiteGenerationStore.getState();

		store.navigate({ pageId: "about-page" });
		store.openCatalog({ target: { index: 2, pageId: websiteId } });

		expect(useWebsiteGenerationStore.getState()).toMatchObject({
			catalogTarget: { index: 2, pageId: websiteId },
			pageId: "about-page",
		});

		useWebsiteGenerationStore.getState().closeCatalog();

		useWebsiteGenerationStore.getState().resumeWorkflow({
			kind: "section-addition",
			runId: "run-resumed",
			snapshot,
			websiteId,
		});

		useWebsiteGenerationStore.getState().disconnectWorkflow();
		useWebsiteGenerationStore.getState().reconnect();

		expect(useWebsiteGenerationStore.getState().workflow).toMatchObject({
			kind: "section-addition",
			phase: "streaming",
			subscriptionVersion: 1,
		});

		useWebsiteGenerationStore.getState().recover({ snapshot, websiteId });

		expect(useWebsiteGenerationStore.getState()).toMatchObject({
			catalogTarget: null,
			snapshot,
			websiteId,
			workflow: { phase: "idle" },
		});

		expect(selectWebsiteEditorLocked(useWebsiteGenerationStore.getState())).toBe(false);
	});
});

vi.mock("@/hooks/use-organization-permissions", () => ({
	useOrganizationPermissions: () => mockOrganizationPermissions(),
}));
