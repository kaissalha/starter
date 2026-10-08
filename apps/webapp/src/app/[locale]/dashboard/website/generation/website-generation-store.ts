"use client";

import { create } from "zustand";

import {
	applyWebsiteGenerationEvent,
	type WebsiteGenerationEnvelopeV1,
	type WebsiteGenerationEventV1,
	type WebsiteGenerationSlotV1,
	type WebsiteLayoutGenerationTargetV1,
	type WebsiteSnapshotV1,
} from "@starter/infinite-website/generation";

export type SectionInsertionTarget = { index: number; pageId: string };

export type SectionReadiness = {
	assetIds: Array<string>;
	contentReady: boolean;
	failed: boolean;
	resolvedAssetIds: Record<string, true>;
	sectionId: string;
	slotKey: string;
};

type GenerationWorkflowContext = { kind: "generation" };

type TemplateChangeWorkflowContext = {
	baseSnapshot: WebsiteSnapshotV1;
	kind: "template-change";
};

type SectionAdditionWorkflowContext = {
	baseSnapshot: WebsiteSnapshotV1;
	kind: "section-addition";
	target: SectionInsertionTarget | null;
};

type LayoutGenerationWorkflowContext = {
	assetIds: Array<string>;
	baseSnapshot: WebsiteSnapshotV1;
	kind: "layout-generation";
	optimisticSnapshot: WebsiteSnapshotV1;
	pattern: string | null;
	target: WebsiteLayoutGenerationTargetV1 | null;
};

type WebsiteWorkflowContext =
	| GenerationWorkflowContext
	| TemplateChangeWorkflowContext
	| SectionAdditionWorkflowContext
	| LayoutGenerationWorkflowContext;

type IdleWorkflowState = {
	cursor: null;
	kind: null;
	phase: "idle";
	runId: null;
	subscriptionVersion: 0;
};

type StartingWorkflowState = WebsiteWorkflowContext & {
	cursor: null;
	phase: "starting";
	runId: null;
	subscriptionVersion: number;
};

type StreamingWorkflowState = WebsiteWorkflowContext & {
	cursor: string | null;
	phase: "streaming";
	runId: string;
	subscriptionVersion: number;
};

type ReconcilingWorkflowState = WebsiteWorkflowContext &
	Omit<StreamingWorkflowState, "phase"> & { phase: "reconciling" };

type DisconnectedWorkflowState = WebsiteWorkflowContext & {
	cursor: string | null;
	phase: "disconnected";
	runId: string;
	subscriptionVersion: number;
};

type FailedWorkflowState = WebsiteWorkflowContext & {
	cursor: string | null;
	phase: "failed";
	runId: string | null;
	subscriptionVersion: number;
};

type BlockedWorkflowState = {
	cursor: null;
	kind: "unknown";
	phase: "failed";
	runId: string;
	subscriptionVersion: 0;
};

type WebsiteWorkflowClientState =
	| IdleWorkflowState
	| StartingWorkflowState
	| StreamingWorkflowState
	| ReconcilingWorkflowState
	| DisconnectedWorkflowState
	| FailedWorkflowState
	| BlockedWorkflowState;

export type GenerationState = {
	catalogTarget: SectionInsertionTarget | null;
	completedEventKeys: Record<string, true>;
	pageId: string | undefined;
	readiness: Record<string, SectionReadiness>;
	sectionsCompleted: number;
	sectionsTotal: number;
	snapshot: WebsiteSnapshotV1 | null;
	stage: Extract<WebsiteGenerationEventV1, { type: "status" }>["stage"] | null;
	websiteId: string | null;
	workflow: WebsiteWorkflowClientState;
};

type ResumeWorkflowInput =
	| { kind: "generation"; runId: string; snapshot?: WebsiteSnapshotV1; websiteId: string }
	| { kind: "section-addition"; runId: string; snapshot: WebsiteSnapshotV1; websiteId: string }
	| {
			kind: "layout-generation";
			pattern?: string;
			runId: string;
			snapshot: WebsiteSnapshotV1;
			target?: WebsiteLayoutGenerationTargetV1;
			websiteId: string;
	  }
	| { kind: "unknown"; runId: string; snapshot?: WebsiteSnapshotV1; websiteId: string };

type GenerationStore = GenerationState & {
	applyEnvelopes: ({ envelopes }: { envelopes: Array<WebsiteGenerationEnvelopeV1> }) => void;
	attachWorkflow: ({ runId, websiteId }: { runId: string; websiteId: string }) => void;
	cancelWorkflow: () => void;
	closeCatalog: () => void;
	disconnectWorkflow: () => void;
	failWorkflow: () => void;
	markAssetLoaded: ({ assetId, sectionId }: { assetId: string; sectionId: string }) => void;
	navigate: ({ pageId }: { pageId: string }) => void;
	openCatalog: ({ target }: { target: SectionInsertionTarget }) => void;
	reconnect: () => void;
	recover: ({ snapshot, websiteId }: { snapshot: WebsiteSnapshotV1; websiteId?: string }) => void;
	resumeWorkflow: (input: ResumeWorkflowInput) => void;
	startGeneration: () => void;
	startLayoutGeneration: ({
		assetIds,
		baseSnapshot,
		pattern,
		snapshot,
		target,
		websiteId,
	}: {
		assetIds: Array<string>;
		baseSnapshot: WebsiteSnapshotV1;
		pattern: string;
		snapshot: WebsiteSnapshotV1;
		target: WebsiteLayoutGenerationTargetV1;
		websiteId: string;
	}) => void;
	startSectionAddition: ({
		baseSnapshot,
		snapshot,
		target,
		websiteId,
	}: {
		baseSnapshot: WebsiteSnapshotV1;
		snapshot: WebsiteSnapshotV1;
		target: SectionInsertionTarget;
		websiteId: string;
	}) => void;
	startTemplateChange: ({
		baseSnapshot,
		snapshot,
		websiteId,
	}: {
		baseSnapshot: WebsiteSnapshotV1;
		snapshot: WebsiteSnapshotV1;
		websiteId: string;
	}) => void;
};

const initialWorkflowState: IdleWorkflowState = {
	cursor: null,
	kind: null,
	phase: "idle",
	runId: null,
	subscriptionVersion: 0,
};

export const initialWebsiteGenerationState: GenerationState = {
	catalogTarget: null,
	completedEventKeys: {},
	pageId: undefined,
	readiness: {},
	sectionsCompleted: 0,
	sectionsTotal: 0,
	snapshot: null,
	stage: null,
	websiteId: null,
	workflow: initialWorkflowState,
};

const readinessFromSlots = ({ slots }: { slots: Array<WebsiteGenerationSlotV1> }) =>
	Object.fromEntries(
		slots.map((slot) => [
			slot.sectionId,
			{
				assetIds: slot.assetIds,
				contentReady: false,
				failed: false,
				resolvedAssetIds: {},
				sectionId: slot.sectionId,
				slotKey: slot.slotKey,
			} satisfies SectionReadiness,
		])
	);

const removeVisuallyReadySections = ({ readiness }: Pick<GenerationState, "readiness">) =>
	Object.fromEntries(
		Object.entries(readiness).filter(
			([, section]) =>
				!section.contentReady || section.assetIds.some((assetId) => !section.resolvedAssetIds[assetId])
		)
	);

const removeModificationReadiness = ({
	readiness,
	workflow,
}: {
	readiness: GenerationState["readiness"];
	workflow: Exclude<WebsiteWorkflowClientState, IdleWorkflowState>;
}) => {
	if (workflow.kind === "generation" || workflow.kind === "template-change" || workflow.kind === "unknown") {
		return readiness;
	}

	return Object.fromEntries(
		Object.entries(readiness).filter(([sectionId, section]) => {
			if (workflow.kind === "layout-generation") {
				return sectionId !== workflow.target?.sectionId;
			}

			return section.slotKey !== `section-additions.${workflow.runId}`;
		})
	);
};

type StreamingGenerationState = Omit<GenerationState, "workflow"> & { workflow: StreamingWorkflowState };

const failStreamedWorkflow = ({
	state,
	streamed,
}: {
	state: GenerationState;
	streamed: StreamingGenerationState;
}): GenerationState => {
	const readiness = (() => {
		if (streamed.workflow.kind === "generation") {
			return Object.fromEntries(
				Object.entries(streamed.readiness).map(([sectionId, section]) => [
					sectionId,
					{ ...section, failed: true },
				])
			);
		}

		if (streamed.workflow.kind === "template-change") {
			return {};
		}

		return removeModificationReadiness({ readiness: state.readiness, workflow: streamed.workflow });
	})();

	return {
		...streamed,
		readiness,
		snapshot: streamed.workflow.kind === "generation" ? streamed.snapshot : streamed.workflow.baseSnapshot,
		workflow: { ...streamed.workflow, phase: "failed" },
	};
};

const cancelStreamedWorkflow = ({ streamed }: { streamed: StreamingGenerationState }): GenerationState => ({
	...streamed,
	completedEventKeys: {},
	readiness: {},
	sectionsCompleted: 0,
	sectionsTotal: 0,
	snapshot: streamed.workflow.kind === "generation" ? null : streamed.workflow.baseSnapshot,
	stage: null,
	workflow: initialWorkflowState,
});

const settleStreamedAsset = ({
	event,
	streamed,
}: {
	event: Extract<WebsiteGenerationEventV1, { type: "asset-settled" }>;
	streamed: StreamingGenerationState;
}): StreamingGenerationState => {
	if (event.outcome !== "placeholder") {
		return streamed;
	}

	return {
		...streamed,
		readiness: Object.fromEntries(
			Object.entries(streamed.readiness).map(([sectionId, section]) => [
				sectionId,
				section.assetIds.includes(event.assetId)
					? {
							...section,
							resolvedAssetIds: { ...section.resolvedAssetIds, [event.assetId]: true as const },
						}
					: section,
			])
		),
	};
};

export const reduceGenerationEvent = ({
	appliedSnapshot,
	envelope,
	state,
}: {
	appliedSnapshot?: { snapshot: WebsiteSnapshotV1 | null };
	envelope: WebsiteGenerationEnvelopeV1;
	state: GenerationState;
}): GenerationState => {
	if (state.workflow.phase !== "streaming") {
		return state;
	}

	const event = envelope.event;

	const cursorState: StreamingGenerationState = {
		...state,
		workflow: { ...state.workflow, cursor: envelope.cursor },
	};

	if (state.completedEventKeys[event.eventKey]) {
		return cursorState;
	}

	const streamed: StreamingGenerationState = {
		...cursorState,
		completedEventKeys: { ...state.completedEventKeys, [event.eventKey]: true as const },
		snapshot:
			appliedSnapshot?.snapshot ??
			applyWebsiteGenerationEvent({
				event,
				snapshot: state.snapshot,
				validateDocument: event.type === "prepared" || event.type === "completed",
			}),
	};

	switch (event.type) {
		case "failed":
			return failStreamedWorkflow({ state, streamed });
		case "cancelled":
			return cancelStreamedWorkflow({ streamed });
		case "status":
			return { ...streamed, stage: event.stage };
		case "prepared": {
			const firstTarget = event.slots[0]?.target;

			const target =
				firstTarget?.area === "page" ? { index: firstTarget.index, pageId: firstTarget.pageId } : null;

			return {
				...streamed,
				readiness: { ...streamed.readiness, ...readinessFromSlots({ slots: event.slots }) },
				sectionsTotal:
					streamed.workflow.kind === "generation" || streamed.workflow.kind === "template-change"
						? event.slots.length
						: streamed.sectionsTotal,
				workflow:
					streamed.workflow.kind === "section-addition"
						? { ...streamed.workflow, target: streamed.workflow.target ?? target }
						: streamed.workflow,
			};
		}

		case "section": {
			const readiness = streamed.readiness[event.section.id];

			return {
				...streamed,
				readiness: readiness
					? { ...streamed.readiness, [event.section.id]: { ...readiness, contentReady: true } }
					: streamed.readiness,
				sectionsCompleted:
					streamed.workflow.kind === "generation" || streamed.workflow.kind === "template-change"
						? streamed.sectionsCompleted + 1
						: streamed.sectionsCompleted,
			};
		}

		case "asset-settled":
			return settleStreamedAsset({ event, streamed });
		case "section-skipped": {
			const { [event.sectionId]: _skipped, ...readiness } = streamed.readiness;

			return {
				...streamed,
				readiness,
				sectionsCompleted:
					streamed.workflow.kind === "generation" || streamed.workflow.kind === "template-change"
						? streamed.sectionsCompleted + 1
						: streamed.sectionsCompleted,
			};
		}

		case "completed": {
			const completed = { ...streamed, workflow: { ...streamed.workflow, phase: "reconciling" as const } };

			return { ...completed, readiness: removeVisuallyReadySections(completed) };
		}
	}
};

export const selectWebsiteEditorLocked = (state: GenerationState, snapshot = state.snapshot) =>
	!snapshot ||
	state.workflow.phase === "starting" ||
	state.workflow.phase === "streaming" ||
	state.workflow.phase === "reconciling" ||
	state.workflow.phase === "disconnected" ||
	((state.workflow.kind === "generation" || state.workflow.kind === "unknown") && state.workflow.phase === "failed");

const markWebsiteAssetLoaded = ({
	assetId,
	sectionId,
	state,
}: {
	assetId: string;
	sectionId: string;
	state: GenerationStore;
}): GenerationStore | Pick<GenerationState, "readiness"> => {
	const section = state.readiness[sectionId];

	if (
		!section ||
		section.resolvedAssetIds[assetId] ||
		!section.assetIds.includes(assetId) ||
		!state.completedEventKeys[`asset:${assetId}`]
	) {
		return state;
	}

	const updated = {
		...section,
		resolvedAssetIds: { ...section.resolvedAssetIds, [assetId]: true as const },
	};

	const readiness = { ...state.readiness, [sectionId]: updated };

	const visuallyReady =
		updated.contentReady && updated.assetIds.every((candidate) => updated.resolvedAssetIds[candidate]);

	if (visuallyReady && state.workflow.phase === "idle") {
		const { [sectionId]: _ready, ...remaining } = readiness;

		return { readiness: remaining };
	}

	return { readiness };
};

export const useWebsiteGenerationStore = create<GenerationStore>((set) => ({
	...initialWebsiteGenerationState,
	applyEnvelopes: ({ envelopes }) =>
		set((state) =>
			envelopes.reduce<GenerationState>(
				(current, envelope) => reduceGenerationEvent({ envelope, state: current }),
				state
			)
		),
	attachWorkflow: ({ runId, websiteId }) =>
		set((state) => {
			if (state.workflow.phase !== "starting") {
				return state;
			}

			return {
				websiteId,
				workflow: { ...state.workflow, phase: "streaming", runId },
			};
		}),
	cancelWorkflow: () =>
		set((state) => {
			if (state.workflow.phase === "idle") {
				return state;
			}

			const snapshot = (() => {
				switch (state.workflow.kind) {
					case "generation":
						return null;
					case "unknown":
						return state.snapshot;
					default:
						return state.workflow.baseSnapshot;
				}
			})();

			return {
				completedEventKeys: {},
				readiness: {},
				sectionsCompleted: 0,
				sectionsTotal: 0,
				snapshot,
				stage: null,
				workflow: initialWorkflowState,
			};
		}),
	closeCatalog: () => set({ catalogTarget: null }),
	disconnectWorkflow: () =>
		set((state) =>
			state.workflow.phase === "streaming" || state.workflow.phase === "reconciling"
				? { workflow: { ...state.workflow, phase: "disconnected" } }
				: state
		),
	failWorkflow: () =>
		set((state) => {
			if (state.workflow.phase === "idle" || state.workflow.phase === "failed") {
				return state;
			}

			return {
				readiness:
					state.workflow.kind === "template-change"
						? {}
						: removeModificationReadiness({ readiness: state.readiness, workflow: state.workflow }),
				snapshot: state.workflow.kind === "generation" ? state.snapshot : state.workflow.baseSnapshot,
				workflow: { ...state.workflow, phase: "failed" },
			};
		}),
	markAssetLoaded: ({ assetId, sectionId }) => set((state) => markWebsiteAssetLoaded({ assetId, sectionId, state })),
	navigate: ({ pageId }) => set({ pageId }),
	openCatalog: ({ target }) => set({ catalogTarget: target }),
	reconnect: () =>
		set((state) =>
			state.workflow.phase === "disconnected"
				? {
						workflow: {
							...state.workflow,
							phase: "streaming",
							subscriptionVersion: state.workflow.subscriptionVersion + 1,
						},
					}
				: state
		),
	recover: ({ snapshot, websiteId }) =>
		set((state) => ({
			readiness: {},
			snapshot,
			websiteId: websiteId ?? state.websiteId,
			workflow: initialWorkflowState,
		})),
	resumeWorkflow: (input) =>
		set((current) => {
			if (current.workflow.runId === input.runId && current.workflow.kind === input.kind) {
				return current;
			}

			if (input.kind === "unknown") {
				return {
					completedEventKeys: {},
					snapshot: current.snapshot ?? input.snapshot ?? null,
					websiteId: input.websiteId,
					workflow: {
						cursor: null,
						kind: input.kind,
						phase: "failed",
						runId: input.runId,
						subscriptionVersion: 0,
					},
				};
			}

			const workflowBase: Pick<StreamingWorkflowState, "cursor" | "phase" | "runId" | "subscriptionVersion"> = {
				cursor: null,
				phase: "streaming",
				runId: input.runId,
				subscriptionVersion: 0,
			};

			const workflow: StreamingWorkflowState = (() => {
				if (input.kind === "section-addition") {
					return {
						...workflowBase,
						baseSnapshot: input.snapshot,
						kind: input.kind,
						target: null,
					};
				}

				if (input.kind === "layout-generation") {
					return {
						...workflowBase,
						assetIds: [],
						baseSnapshot: input.snapshot,
						kind: input.kind,
						optimisticSnapshot: input.snapshot,
						pattern: input.pattern ?? null,
						target: input.target ?? null,
					};
				}

				return { ...workflowBase, kind: input.kind };
			})();

			return {
				completedEventKeys: {},
				snapshot: current.snapshot ?? input.snapshot ?? null,
				websiteId: input.websiteId,
				workflow,
			};
		}),
	startGeneration: () =>
		set({
			...initialWebsiteGenerationState,
			workflow: {
				cursor: null,
				kind: "generation",
				phase: "starting",
				runId: null,
				subscriptionVersion: 0,
			},
		}),
	startLayoutGeneration: ({ assetIds, baseSnapshot, pattern, snapshot, target, websiteId }) =>
		set((state) => ({
			catalogTarget: null,
			completedEventKeys: {},
			readiness: {
				...state.readiness,
				[target.sectionId]: {
					assetIds,
					contentReady: false,
					failed: false,
					resolvedAssetIds: {},
					sectionId: target.sectionId,
					slotKey: "layout-generations.optimistic",
				},
			},
			snapshot,
			websiteId,
			workflow: {
				assetIds,
				baseSnapshot,
				cursor: null,
				kind: "layout-generation",
				optimisticSnapshot: snapshot,
				pattern,
				phase: "starting",
				runId: null,
				subscriptionVersion: 0,
				target,
			},
		})),
	startSectionAddition: ({ baseSnapshot, snapshot, target, websiteId }) =>
		set({
			catalogTarget: null,
			completedEventKeys: {},
			snapshot,
			websiteId,
			workflow: {
				baseSnapshot,
				cursor: null,
				kind: "section-addition",
				phase: "starting",
				runId: null,
				subscriptionVersion: 0,
				target,
			},
		}),
	startTemplateChange: ({ baseSnapshot, snapshot, websiteId }) =>
		set({
			catalogTarget: null,
			completedEventKeys: {},
			readiness: {},
			snapshot,
			websiteId,
			workflow: {
				baseSnapshot,
				cursor: null,
				kind: "template-change",
				phase: "starting",
				runId: null,
				subscriptionVersion: 0,
			},
		}),
}));
