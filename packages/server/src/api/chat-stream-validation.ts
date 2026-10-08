import { ORPCError } from "@orpc/client";
import { isToolUIPart } from "ai";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";

import { withoutTransientToolParts, type DashboardChatUIMessage } from "../ai/types";
import { getFile } from "../services/storage";

const safeStreamErrorNames = new Set(["AI_InvalidToolInputError", "AI_NoSuchToolError"]);

const streamErrorTextLimit = 2000;

const genericStreamError = "An error occurred.";

const jsonValueSchema = z.compile(z.json());

const parseJson = (value: string) => {
	// oxlint-disable-next-line unicorn(prefer-structured-clone)
	return JSON.parse(value);
};

const canonicalMessagePart = (part: DashboardChatUIMessage["parts"][number]) =>
	jsonValueSchema.parse(
		parseJson(
			JSON.stringify(isToolUIPart(part) && part.state === "output-error" ? { ...part, errorText: "" } : part)
		)
	);

const messagePartsMatch = (
	part: DashboardChatUIMessage["parts"][number],
	persistedPart: DashboardChatUIMessage["parts"][number]
) => isDeepStrictEqual(canonicalMessagePart(part), canonicalMessagePart(persistedPart));

export const hasPendingAssistantContinuation = (message: DashboardChatUIMessage | undefined) =>
	message?.role === "assistant" &&
	message.parts.some(
		(part) =>
			isToolUIPart(part) &&
			(part.state === "approval-requested" ||
				(part.type === "tool-askUserQuestions" && part.state === "input-available"))
	);

export const getPendingApprovalToolCallIds = (message: DashboardChatUIMessage | undefined) =>
	message?.role === "assistant"
		? message.parts.flatMap((part) =>
				isToolUIPart(part) && part.state === "approval-requested" ? [part.toolCallId] : []
			)
		: [];

export const describeSafeStreamError = (cause: unknown): string => {
	if (cause instanceof z.ZodError) {
		return z.prettifyError(cause).slice(0, streamErrorTextLimit);
	}

	if (cause instanceof Error) {
		if (cause.cause !== undefined) {
			const nested = describeSafeStreamError(cause.cause);

			if (nested !== genericStreamError) {
				return nested;
			}
		}

		if (safeStreamErrorNames.has(cause.name)) {
			return cause.message.slice(0, streamErrorTextLimit);
		}
	}

	return genericStreamError;
};

const resolveAssistantContinuation = ({
	persisted,
	submitted,
}: {
	persisted: DashboardChatUIMessage | undefined;
	submitted: DashboardChatUIMessage;
}) => {
	if (!persisted || persisted.role !== "assistant" || submitted.role !== "assistant") {
		return undefined;
	}

	const [canonicalPersisted] = withoutTransientToolParts([persisted], { keepErrors: true });
	const [canonicalSubmitted] = withoutTransientToolParts([submitted], { keepErrors: true });

	if (!canonicalPersisted || !canonicalSubmitted) {
		return undefined;
	}

	const persistedIndexByToolCallId = new Map(
		canonicalPersisted.parts.flatMap((part, index) =>
			isToolUIPart(part) ? [[part.toolCallId, index] as const] : []
		)
	);

	const transitionIds: Array<string> = [];
	const parts = [...canonicalPersisted.parts];

	const partsMatch = canonicalSubmitted.parts.every((part) => {
		if (!isToolUIPart(part)) {
			return true;
		}

		const transition =
			part.state === "approval-responded" ||
			(part.type === "tool-askUserQuestions" && part.state === "output-available");

		const persistedIndex = persistedIndexByToolCallId.get(part.toolCallId);
		const persistedPart = persistedIndex === undefined ? undefined : canonicalPersisted.parts[persistedIndex];

		if (persistedIndex === undefined || !persistedPart || !isToolUIPart(persistedPart)) {
			return !transition;
		}

		if (part.state === "approval-responded" && persistedPart.state === "approval-requested") {
			const approval =
				part.approval.reason === undefined
					? { ...persistedPart.approval, approved: part.approval.approved }
					: { ...persistedPart.approval, approved: part.approval.approved, reason: part.approval.reason };

			if (
				!messagePartsMatch(part, {
					...persistedPart,
					approval,
					state: "approval-responded",
				})
			) {
				return false;
			}

			transitionIds.push(`${part.toolCallId}:approval`);
			parts[persistedIndex] = part;

			return true;
		}

		if (
			part.type === "tool-askUserQuestions" &&
			part.state === "output-available" &&
			persistedPart.type === "tool-askUserQuestions" &&
			persistedPart.state === "input-available"
		) {
			if (
				!messagePartsMatch(part, {
					...persistedPart,
					output: part.output,
					state: "output-available",
				})
			) {
				return false;
			}

			transitionIds.push(`${part.toolCallId}:answer`);
			parts[persistedIndex] = part;

			return true;
		}

		return !transition || messagePartsMatch(part, persistedPart);
	});

	if (!partsMatch || transitionIds.length === 0) {
		return undefined;
	}

	return {
		continuationId: createHash("sha256").update(transitionIds.toSorted().join("\u0000")).digest("hex"),
		message: { ...persisted, parts },
	};
};

export const resolvePersistedAssistantContinuation = (options: {
	persisted: DashboardChatUIMessage | undefined;
	submitted: DashboardChatUIMessage;
}) => resolveAssistantContinuation(options)?.message;

export const resolvePersistedAssistantContinuationClaim = (options: {
	persisted: DashboardChatUIMessage | undefined;
	submitted: DashboardChatUIMessage;
}) => resolveAssistantContinuation(options);

export const matchesPersistedAssistantContinuation = (options: {
	persisted: DashboardChatUIMessage | undefined;
	submitted: DashboardChatUIMessage;
}) => resolvePersistedAssistantContinuation(options) !== undefined;

export const resolveLibraryAssetBinding = async ({
	assetId,
	organizationId,
}: {
	assetId: string | undefined;
	organizationId: string;
}) => {
	if (!assetId) {
		return undefined;
	}

	const file = await getFile({ fileId: assetId, organizationId });

	if (!file || file.deletedAt) {
		throw new ORPCError("BAD_REQUEST", { message: "Library asset not found." });
	}

	return {
		editable: file.content !== null,
		fileId: file.id,
		groupId: file.versionGroupId ?? file.id,
		kind: file.kind,
		name: file.title ?? file.name,
	};
};
