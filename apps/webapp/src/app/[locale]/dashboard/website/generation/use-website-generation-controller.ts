"use client";

import { useEffect, useEffectEvent, useTransition } from "react";

import { type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";

import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { apiClient, client } from "@/lib/api-client";
import type { SiteDocument } from "@starter/infinite-website";
import { insertWebsiteSectionPreview } from "@starter/infinite-website/editing";
import type {
	WebsiteGenerationEnvelopeV1,
	WebsiteLayoutGenerationTargetV1,
	WebsiteSnapshotV1,
	WebsiteStateV1,
} from "@starter/infinite-website/generation";

import {
	initialWebsiteGenerationState,
	type GenerationState,
	type SectionInsertionTarget,
	useWebsiteGenerationStore,
} from "./website-generation-store";
import { subscribeToWebsiteWorkflow } from "./website-workflow-subscription";

const controllerPhaseByWorkflowPhase = {
	disconnected: "failed",
	failed: "failed",
	idle: "ready",
	reconciling: "streaming",
	starting: "starting",
	streaming: "streaming",
} as const;

type AnimationFrameReference = { value: number | undefined };

type ControllerPhase = "failed" | "idle" | "ready" | "starting" | "streaming";

const fetchPersistedWebsite = async (queryClient: QueryClient) => {
	try {
		return await queryClient.query({
			...apiClient.websites.get.queryOptions(),
			staleTime: 0,
		});
	} catch {
		return undefined;
	}
};

const modificationWorkflowKinds = ["template-change", "section-addition", "layout-generation"];

const isFailedModification = ({ kind, phase }: { kind: string | null; phase: string }) =>
	phase === "failed" && modificationWorkflowKinds.includes(kind ?? "");

const resolveControllerPhase = ({
	snapshot,
	workflowKind,
	workflowPhase,
}: {
	snapshot: WebsiteSnapshotV1 | null;
	workflowKind: GenerationState["workflow"]["kind"];
	workflowPhase: keyof typeof controllerPhaseByWorkflowPhase;
}): ControllerPhase => {
	if (workflowPhase === "idle" && !snapshot) {
		return "idle";
	}

	const modificationFailure =
		modificationWorkflowKinds.includes(workflowKind ?? "") && ["failed", "disconnected"].includes(workflowPhase);

	return modificationFailure ? "ready" : controllerPhaseByWorkflowPhase[workflowPhase];
};

const resumePersistedWebsiteWorkflow = ({ persisted }: { persisted: WebsiteStateV1 }) => {
	const current = useWebsiteGenerationStore.getState();
	const workflow = persisted.workflow;

	if (workflow?.kind === "translation") {
		if (persisted.snapshot) {
			current.recover({ snapshot: persisted.snapshot, websiteId: persisted.id });
		}

		return;
	}

	if (!workflow) {
		if (persisted.snapshot && current.workflow.phase !== "starting" && !isFailedModification(current.workflow)) {
			current.recover({ snapshot: persisted.snapshot, websiteId: persisted.id });
		}

		return;
	}

	if (persisted.snapshot && current.workflow.phase === "idle") {
		current.recover({ snapshot: persisted.snapshot, websiteId: persisted.id });
	}

	if (workflow.kind === "unknown" || workflow.kind === "generation") {
		current.resumeWorkflow({
			kind: workflow.kind,
			runId: workflow.runId,
			snapshot: persisted.snapshot ?? undefined,
			websiteId: persisted.id,
		});

		return;
	}

	if (persisted.snapshot) {
		current.resumeWorkflow({
			kind: workflow.kind,
			runId: workflow.runId,
			snapshot: persisted.snapshot,
			websiteId: persisted.id,
		});
	}
};

const useWebsiteWorkflowSubscription = ({
	queryClient,
	websiteId,
	workflowPhase,
	workflowRunId,
	workflowSubscriptionVersion,
}: {
	queryClient: QueryClient;
	websiteId: string | null;
	workflowPhase: keyof typeof controllerPhaseByWorkflowPhase;
	workflowRunId: string | null;
	workflowSubscriptionVersion: number;
}) => {
	const [, startTransition] = useTransition();

	const reconcilePersistedState = useEffectEvent(async (signal: AbortSignal) => {
		const actions = useWebsiteGenerationStore.getState();
		const current = await fetchPersistedWebsite(queryClient);

		if (signal.aborted || useWebsiteGenerationStore.getState().workflow.runId !== workflowRunId) {
			return;
		}

		if (current === undefined) {
			actions.disconnectWorkflow();

			return;
		}

		if (current?.workflow?.state === "active") {
			actions.disconnectWorkflow();

			return;
		}

		if (current?.workflow?.state === "failed") {
			actions.failWorkflow();

			return;
		}

		if (isFailedModification(useWebsiteGenerationStore.getState().workflow)) {
			return;
		}

		if (current?.snapshot) {
			queryClient.invalidateQueries({ queryKey: apiClient.linkPages.get.key() });
			actions.recover({ snapshot: current.snapshot, websiteId: current.id });

			return;
		}

		actions.failWorkflow();
	});

	useEffect(() => {
		if ((workflowPhase !== "streaming" && workflowPhase !== "reconciling") || !workflowRunId || !websiteId) {
			return;
		}

		const abortController = new AbortController();

		if (workflowPhase === "reconciling") {
			reconcilePersistedState(abortController.signal);

			return () => abortController.abort();
		}

		const cursor = useWebsiteGenerationStore.getState().workflow.cursor;
		const pendingEnvelopes: Array<WebsiteGenerationEnvelopeV1> = [];
		const animationFrame: AnimationFrameReference = { value: undefined };

		const flushEnvelopes = () => {
			animationFrame.value = undefined;

			if (pendingEnvelopes.length === 0) {
				return;
			}

			const envelopes = pendingEnvelopes.splice(0);
			startTransition(() => useWebsiteGenerationStore.getState().applyEnvelopes({ envelopes }));
		};

		subscribeToWebsiteWorkflow({
			afterCursor: cursor ?? undefined,
			onEnded: async () => {
				if (animationFrame.value !== undefined) {
					window.cancelAnimationFrame(animationFrame.value);
				}

				flushEnvelopes();

				if (useWebsiteGenerationStore.getState().workflow.phase !== "reconciling") {
					await reconcilePersistedState(abortController.signal);
				}
			},
			onEnvelope: (envelope) => {
				if (envelope.event.type === "completed") {
					queryClient.invalidateQueries({
						queryKey: apiClient.linkPages.get.key(),
						refetchType: "none",
					});
				}

				pendingEnvelopes.push(envelope);
				animationFrame.value ??= window.requestAnimationFrame(flushEnvelopes);
			},
			signal: abortController.signal,
			websiteId,
			workflowRunId,
		});

		return () => {
			abortController.abort();

			if (animationFrame.value !== undefined) {
				window.cancelAnimationFrame(animationFrame.value);
			}

			pendingEnvelopes.length = 0;
		};
	}, [queryClient, websiteId, workflowPhase, workflowRunId, workflowSubscriptionVersion]);

	useEffect(() => {
		if (workflowPhase !== "disconnected") {
			return;
		}

		const resume = () => {
			if (globalThis.document.visibilityState === "visible") {
				useWebsiteGenerationStore.getState().reconnect();
			}
		};

		globalThis.document.addEventListener("visibilitychange", resume);
		window.addEventListener("online", resume);

		return () => {
			globalThis.document.removeEventListener("visibilitychange", resume);
			window.removeEventListener("online", resume);
		};
	}, [workflowPhase]);
};

const requestWebsiteWorkflow = async ({
	invalidateAgentChat = false,
	queryClient,
	request,
}: {
	invalidateAgentChat?: boolean;
	queryClient: QueryClient;
	request: () => Promise<{ websiteId: string; workflowRunId: string }>;
}) => {
	const actions = useWebsiteGenerationStore.getState();

	try {
		const result = await request();
		actions.attachWorkflow({ runId: result.workflowRunId, websiteId: result.websiteId });
	} catch {
		actions.failWorkflow();
	} finally {
		await queryClient.invalidateQueries({ queryKey: apiClient.websites.get.key() });

		if (invalidateAgentChat) {
			await queryClient.invalidateQueries({ queryKey: apiClient.websites.agentChat.key() });
		}
	}
};

const applyWebsiteTemplate = async ({
	persisted,
	queryClient,
	snapshot,
	templateId,
}: {
	persisted: WebsiteStateV1;
	queryClient: QueryClient;
	snapshot: WebsiteSnapshotV1;
	templateId: string;
}) => {
	const actions = useWebsiteGenerationStore.getState();
	const input = { templateId, updatedAt: persisted.updatedAt, websiteId: persisted.id };
	actions.startTemplateChange({ baseSnapshot: persisted.snapshot ?? snapshot, snapshot, websiteId: persisted.id });
	await requestWebsiteWorkflow({ queryClient, request: () => client.websites.changeTemplate(input) });
};

export const useWebsiteGenerationController = () => {
	const { can } = useOrganizationPermissions();
	const canWrite = can("workspace.write");
	const queryClient = useQueryClient();

	const state = useWebsiteGenerationStore(
		useShallow(({ snapshot, websiteId, workflow }) => ({
			additionTarget: workflow.kind === "section-addition" ? workflow.target : null,
			snapshot,
			websiteId,
			workflowKind: workflow.kind,
			workflowPhase: workflow.phase,
			workflowRunId: workflow.runId,
			workflowSubscriptionVersion: workflow.subscriptionVersion,
		}))
	);

	const actions = useWebsiteGenerationStore.getState();

	const currentWebsiteQuery = useQuery({
		...apiClient.websites.get.queryOptions(),
		staleTime: 5000,
	});

	useEffect(() => () => useWebsiteGenerationStore.setState(initialWebsiteGenerationState), []);
	const persisted = currentWebsiteQuery.data;
	useEffect(() => {
		if (persisted) {
			resumePersistedWebsiteWorkflow({ persisted });
		}
	}, [persisted]);
	useWebsiteWorkflowSubscription({
		queryClient,
		websiteId: state.websiteId,
		workflowPhase: state.workflowPhase,
		workflowRunId: state.workflowRunId,
		workflowSubscriptionVersion: state.workflowSubscriptionVersion,
	});
	const currentWebsiteId = state.websiteId ?? persisted?.id;

	const generate = async ({ location, name, type }: { location: string; name: string; type: string }) => {
		if (!canWrite || useWebsiteGenerationStore.getState().workflow.kind === "unknown") {
			return;
		}

		actions.startGeneration();
		await requestWebsiteWorkflow({
			invalidateAgentChat: true,
			queryClient,
			request: () =>
				client.websites.generate({
					brief: { location: location.trim(), name: name.trim(), schemaVersion: 1, type: type.trim() },
				}),
		});
	};

	const canStartModification =
		state.workflowPhase === "idle" ||
		isFailedModification({ kind: state.workflowKind, phase: state.workflowPhase });

	const addSection = async ({
		index,
		pageId,
		pattern,
		previewDocument,
	}: SectionInsertionTarget & { pattern: string; previewDocument?: SiteDocument }) => {
		if (!canWrite || !state.snapshot || !persisted || persisted.id !== currentWebsiteId || !canStartModification) {
			return;
		}

		const snapshot = previewDocument
			? {
					...state.snapshot,
					document: insertWebsiteSectionPreview({
						document: state.snapshot.document,
						preview: previewDocument,
						target: { index, pageId },
					}),
				}
			: state.snapshot;

		actions.startSectionAddition({
			baseSnapshot: state.snapshot,
			snapshot,
			target: { index, pageId },
			websiteId: currentWebsiteId,
		});

		await requestWebsiteWorkflow({
			queryClient,
			request: () =>
				client.websites.addSection({
					index,
					pageId,
					pattern,
					updatedAt: persisted.updatedAt,
					websiteId: currentWebsiteId,
				}),
		});
	};

	const generateLayout = async ({
		assetIds,
		baseSnapshot,
		pattern,
		snapshot,
		target,
	}: {
		assetIds: Array<string>;
		baseSnapshot: WebsiteSnapshotV1;
		pattern: string;
		snapshot: WebsiteSnapshotV1;
		target: WebsiteLayoutGenerationTargetV1;
	}) => {
		if (!can("workspace.delete") || !persisted || persisted.id !== currentWebsiteId || !canStartModification) {
			return;
		}

		actions.startLayoutGeneration({
			assetIds,
			baseSnapshot,
			pattern,
			snapshot,
			target,
			websiteId: currentWebsiteId,
		});

		await requestWebsiteWorkflow({
			queryClient,
			request: () =>
				client.websites.generateLayout({
					pattern,
					target,
					updatedAt: persisted.updatedAt,
					websiteId: currentWebsiteId,
				}),
		});
	};

	const changeTemplate = async ({ templateId }: { templateId: string }) => {
		if (
			!can("workspace.delete") ||
			!state.snapshot ||
			!persisted ||
			persisted.id !== currentWebsiteId ||
			!canStartModification ||
			persisted.snapshot?.templateId === templateId
		) {
			return;
		}

		await applyWebsiteTemplate({ persisted, queryClient, snapshot: state.snapshot, templateId });
	};

	const snapshot = state.snapshot ?? persisted?.snapshot ?? null;
	const blocked = state.workflowKind === "unknown";

	const phase = resolveControllerPhase({
		snapshot,
		workflowKind: state.workflowKind,
		workflowPhase: state.workflowPhase,
	});

	const active = ["starting", "streaming", "reconciling"].includes(state.workflowPhase);
	const addition = state.workflowKind === "section-addition";
	const layoutGeneration = state.workflowKind === "layout-generation";

	return {
		additionActive: addition && active,
		additionFailed: addition && state.workflowPhase === "failed",
		additionRecoverable: addition && state.workflowPhase === "disconnected",
		additionTarget: state.additionTarget,
		addSection,
		blocked,
		brief: persisted?.brief ?? null,
		changeTemplate,
		generate,
		generateLayout,
		isLoading: currentWebsiteQuery.isLoading,
		layoutGenerationActive: layoutGeneration && active,
		layoutGenerationFailed: layoutGeneration && state.workflowPhase === "failed",
		layoutGenerationRecoverable: layoutGeneration && state.workflowPhase === "disconnected",
		loadFailed: currentWebsiteQuery.isError,
		phase,
		reconnect: actions.reconnect,
		recoverable: !addition && state.workflowPhase === "disconnected",
		retryLoad: currentWebsiteQuery.refetch,
		snapshot,
		website: persisted,
		websiteId: state.websiteId ?? persisted?.id ?? null,
	};
};
