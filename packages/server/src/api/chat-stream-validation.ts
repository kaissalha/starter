import { ORPCError } from "@orpc/client";
import { getToolName, isToolUIPart } from "ai";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";

import { resolveLocalizedPageSlug } from "@starter/infinite-website/editing";

import { isWebsiteMutationToolName } from "../ai/tools";
import {
	withoutTransientToolParts,
	type DashboardChatUIMessage,
	type WebsiteEditorBinding,
	type WebsiteEditorContext,
} from "../ai/types";
import { getFile } from "../services/storage";
import { getWebsite } from "../services/websites/service";

const safeStreamErrorNames = new Set([
	"AI_InvalidToolInputError",
	"AI_NoSuchToolError",
	"BehaviorSectionError",
	"SiteDocumentValidationError",
	"WebsiteEditError",
	"WebsiteInspectionError",
]);

const nestedStreamErrorNames = [
	"BehaviorSectionError",
	"SiteDocumentValidationError",
	"WebsiteEditError",
	"WebsiteInspectionError",
];

const streamErrorTextLimit = 2000;

const genericStreamError = "An error occurred.";

const stringSchema = z.compile(z.string());

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
	const parsedString = stringSchema.safeParse(cause);

	if (parsedString.success) {
		for (const name of nestedStreamErrorNames) {
			const marker = `${name}: `;
			const offset = parsedString.data.lastIndexOf(marker);

			if (offset >= 0) {
				return parsedString.data.slice(offset + marker.length, offset + marker.length + streamErrorTextLimit);
			}
		}

		return genericStreamError;
	}

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

	const approvedWebsiteMutationCount = parts.filter(
		(part) =>
			isToolUIPart(part) &&
			part.state === "approval-responded" &&
			part.approval.approved &&
			isWebsiteMutationToolName(getToolName(part))
	).length;

	if (!partsMatch || transitionIds.length === 0 || approvedWebsiteMutationCount > 1) {
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

export const resolveWebsiteEditorBinding = async ({
	binding,
	organizationId,
}: {
	binding?: WebsiteEditorBinding;
	organizationId: string;
}): Promise<WebsiteEditorContext | undefined> => {
	if (!binding) {
		return undefined;
	}

	const website = await getWebsite({ organizationId });

	if (!website?.snapshot || website.id !== binding.websiteId) {
		throw new ORPCError("BAD_REQUEST", { message: "Website editor context is no longer available." });
	}

	const { document } = website.snapshot;

	if (!document.locales.includes(binding.locale)) {
		throw new ORPCError("BAD_REQUEST", { message: "Website editor locale is no longer available." });
	}

	const pages = document.structure.pages.map((page) => ({
		home: page.home,
		pageId: page.id,
		pageSlug: resolveLocalizedPageSlug({
			content: document.content,
			defaultLocale: document.defaultLocale,
			locale: binding.locale,
			pageId: page.id,
		}),
	}));

	const page = binding.pageSlug
		? pages.find(({ pageSlug }) => pageSlug === binding.pageSlug)
		: (pages.find(({ home }) => home) ?? pages[0]);

	if (!page) {
		throw new ORPCError("BAD_REQUEST", { message: "Website editor page is no longer available." });
	}

	if (
		binding.sectionId &&
		!document.structure.pages
			.find(({ id }) => id === page.pageId)
			?.sections.some(({ id }) => id === binding.sectionId)
	) {
		throw new ORPCError("BAD_REQUEST", { message: "Website editor section is no longer available." });
	}

	return {
		locale: binding.locale,
		pageId: page.pageId,
		pageSlug: page.pageSlug,
		sectionId: binding.sectionId,
		websiteId: binding.websiteId,
	};
};
