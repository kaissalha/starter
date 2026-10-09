import { handleChatStream, smoothStream, toAISdkStream } from "@mastra/ai-sdk";
import { ORPCError } from "@orpc/client";
import { waitUntil } from "@vercel/functions";
import {
	createUIMessageStream,
	JsonToSseTransformStream,
	lastAssistantMessageIsCompleteWithApprovalResponses,
	lastAssistantMessageIsCompleteWithToolCalls,
	validateUIMessages,
} from "ai";
import { createResumableStreamContext } from "resumable-stream/ioredis";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { createRedisClient } from "@starter/cache";
import { log, serializeLogError } from "@starter/observability";

import { createDashboardChatRequestContext, type DashboardChatUIMessage } from "../ai/types";
import { resolveSession } from "../lib/auth";
import { flushMastraObservability, mastra } from "../mastra";
import {
	chatMessageIdExists,
	ChatOwnershipConflictError,
	convertChatMessagesForUI,
	createChat,
	getChatMessages,
	getChatWithMessages,
	persistChatQuestionAnswers,
} from "../services/chat";
import {
	ChatCapacityError,
	consumeChatRequestBudget,
	claimChatContinuation,
	claimChatMessage,
	clearActiveChatStreamId,
	clearResumableChatStreamId,
	getActiveChatStreamId,
	getResumableChatStreamId,
	releaseChatContinuation,
	releaseChatMessage,
	setChatStreamId,
} from "../services/chat-stream-state";
import { libraryChatScope } from "../services/library";
import { requireOrganizationPermission } from "../services/permissions";
import { waitForFilesReady } from "../services/storage";
import { loadReconciledPersistedMessages, reconcileExpiredToolApprovals } from "./chat-approvals";
import {
	decideDashboardRoute,
	hasRecentImageAttachment,
	getIndexedAttachments,
	loadChatTurnContext,
	resolveDashboardRoute,
	resolveOwnedChatAttachments,
} from "./chat-stream-context";
import { narrowMastraUIStream } from "./chat-stream-narrow";
import {
	describeSafeStreamError,
	hasPendingAssistantContinuation,
	resolveLibraryAssetBinding,
	resolvePersistedAssistantContinuationClaim,
} from "./chat-stream-validation";
import { uiMessageSchema } from "./routers/chats";

type MutableReference<Value> = { value: Value };

type ValidatedSubmittedMessage = {
	continuationId?: string;
	message: DashboardChatUIMessage;
};

const chatIdSchema = z.compile(z.uuid());

const createStreamPartErrorHandler =
	({ chatId, organizationId }: { chatId: string; organizationId: string }) =>
	(cause: unknown) => {
		log.error({
			chatId,
			error: serializeLogError(cause),
			message: "Error in dashboard chat tool stream",
			organizationId,
		});

		return describeSafeStreamError(cause);
	};

const createObservabilityFlushScheduler = ({ chatId, organizationId }: { chatId: string; organizationId: string }) => {
	const scheduledReference = { value: false };

	return () => {
		if (scheduledReference.value) {
			return;
		}

		scheduledReference.value = true;
		waitUntil(
			(async () => {
				try {
					await flushMastraObservability();
				} catch (error) {
					await log.error({
						chatId,
						error: serializeLogError(error),
						message: "Failed to flush dashboard chat observability",
						organizationId,
					});
				}
			})()
		);
	};
};

const cleanupFailedResumableStream = async ({
	chatId,
	organizationId,
	releaseUnusedClaims,
	streamId,
}: {
	chatId: string;
	organizationId: string;
	releaseUnusedClaims: () => Promise<void>;
	streamId: string;
}) => {
	await Promise.all([
		clearActiveChatStreamId({ chatId, organizationId, streamId }),
		clearResumableChatStreamId({ chatId, organizationId, streamId }),
		releaseUnusedClaims(),
	]);
};

const cleanupFailedActiveStream = async ({
	chatId,
	organizationId,
	releaseUnusedClaims,
	streamId,
}: {
	chatId: string;
	organizationId: string;
	releaseUnusedClaims: () => Promise<void>;
	streamId: string;
}) => {
	await Promise.all([clearActiveChatStreamId({ chatId, organizationId, streamId }), releaseUnusedClaims()]);
};

const sseResponseInit = {
	headers: { "content-type": "text/event-stream" },
	status: 200,
} satisfies ResponseInit;

const createStreamBodySchema = z.compile(
	z.object({
		library: z.strictObject({ assetId: z.uuid().optional() }).optional(),
		message: uiMessageSchema,
	})
);

const createAgentTurnInput = ({
	body,
	chatId,
	chatMessage,
	hasImageAttachment,
	libraryAsset,
	organizationId,
	routeDecision,
	uiMessages,
	user,
}: {
	body: z.infer<typeof createStreamBodySchema>;
	chatId: string;
	chatMessage: DashboardChatUIMessage;
	hasImageAttachment: boolean;
	libraryAsset: Awaited<ReturnType<typeof resolveLibraryAssetBinding>>;
	organizationId: string;
	routeDecision: Awaited<ReturnType<typeof decideDashboardRoute>>;
	uiMessages: Array<DashboardChatUIMessage>;
	user: { email?: string | null; id: string; name?: string | null };
}) => {
	const route = resolveDashboardRoute({
		decision: routeDecision,
		editorBound: Boolean(body.library),
		hasImageAttachment,
		library: Boolean(body.library),
	});

	const approvalContinuation =
		chatMessage.role === "assistant" &&
		lastAssistantMessageIsCompleteWithApprovalResponses({ messages: [chatMessage] });

	return {
		approvalContinuation,
		context: loadChatTurnContext({ editor: { libraryAsset }, route, uiMessages }),
		requestContext: createDashboardChatRequestContext({
			approvalContinuation,
			chatId,
			currentUser: { email: user.email ?? undefined, name: user.name ?? undefined },
			modelTier: route.modelTier,
			organizationId,
			routedSkill: route.routedSkill,
			userId: user.id,
			useVisionModel: hasImageAttachment,
		}),
	};
};

const validateSubmittedMessage = ({
	chatMessage,
	existingMessages,
	persistedMessages,
}: {
	chatMessage: DashboardChatUIMessage;
	existingMessages: Array<{ id: string; parts: Array<object> }>;
	persistedMessages: Array<DashboardChatUIMessage>;
}): ValidatedSubmittedMessage => {
	if (chatMessage.role === "system") {
		throw new ORPCError("BAD_REQUEST", { message: "System messages cannot be submitted by clients." });
	}

	if (chatMessage.role === "user") {
		if (hasPendingAssistantContinuation(persistedMessages.at(-1))) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Resolve the pending assistant request before starting a new turn.",
			});
		}

		if (existingMessages.some(({ id }) => id === chatMessage.id)) {
			throw new ORPCError("BAD_REQUEST", { message: "Chat message id has already been used." });
		}

		return { message: chatMessage };
	}

	const complete =
		lastAssistantMessageIsCompleteWithToolCalls({ messages: [chatMessage] }) ||
		lastAssistantMessageIsCompleteWithApprovalResponses({ messages: [chatMessage] });

	if (!complete) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Submitted assistant message must contain tool results or approval responses",
		});
	}

	const continuation = resolvePersistedAssistantContinuationClaim({
		persisted: persistedMessages.at(-1),
		submitted: chatMessage,
	});

	if (!continuation) {
		throw new ORPCError("BAD_REQUEST", { message: "Assistant continuation does not match the pending request." });
	}

	return continuation;
};

const releaseChatClaims = async ({
	continuationClaim,
	messageClaim,
}: {
	continuationClaim: Parameters<typeof releaseChatContinuation>[0] | undefined;
	messageClaim: Parameters<typeof releaseChatMessage>[0] | undefined;
}) => {
	await Promise.all([
		continuationClaim ? releaseChatContinuation(continuationClaim) : Promise.resolve(),
		messageClaim ? releaseChatMessage(messageClaim) : Promise.resolve(),
	]);
};

const releaseSuspendedContinuation = async ({
	claim,
	started,
}: {
	claim: Parameters<typeof releaseChatContinuation>[0] | undefined;
	started: MutableReference<boolean>;
}) => {
	if (!claim || !started.value) {
		return;
	}

	const existingMessages = await getChatMessages({ chatId: claim.chatId, organizationId: claim.organizationId });

	const { expired } = await reconcileExpiredToolApprovals({
		chatId: claim.chatId,
		existingMessages,
		organizationId: claim.organizationId,
		persistedMessages: await convertChatMessagesForUI(existingMessages),
	});

	if (!expired) {
		await releaseChatContinuation(claim);
	}
};

const streamContextReference: MutableReference<ReturnType<typeof createResumableStreamContext> | undefined> = {
	value: undefined,
};

const getStreamContext = () => {
	if (streamContextReference.value) {
		return streamContextReference.value;
	}

	const redisUrl = process.env.REDIS_URL;

	if (!redisUrl) {
		throw new Error("REDIS_URL is not set");
	}

	streamContextReference.value = createResumableStreamContext({
		keyPrefix: "resumable-stream",
		publisher: createRedisClient(redisUrl),
		subscriber: createRedisClient(redisUrl),
		waitUntil,
	});

	return streamContextReference.value;
};

const requireOrganizationSession = async ({ headers, params }: { headers: Headers; params: { chatId: string } }) => {
	const chatId = chatIdSchema.safeParse(params.chatId);

	if (!chatId.success) {
		throw new ORPCError("BAD_REQUEST", { message: "Invalid chat id." });
	}

	const session = await resolveSession(headers, false);

	if (!session) {
		throw new ORPCError("UNAUTHORIZED", { message: "Authentication is required." });
	}

	const organizationId = session.session.activeOrganizationId;

	if (!organizationId) {
		throw new ORPCError("BAD_REQUEST", { message: "Organization not found" });
	}

	return { chatId: chatId.data, organizationId, session };
};

export const handleResumeChatStream = async (request: Request, params: { chatId: string }) => {
	const { chatId, organizationId, session } = await requireOrganizationSession({ headers: request.headers, params });
	await requireOrganizationPermission({ organizationId, permission: "read", userId: session.user.id });
	const resumeRequestedAt = new Date();
	const recentStreamId = await getResumableChatStreamId({ chatId, organizationId });

	if (!recentStreamId) {
		return new Response(null, { status: 204 });
	}

	const emptyDataStream = createUIMessageStream<DashboardChatUIMessage>({
		execute: () => undefined,
	});

	const stream = await getStreamContext().resumableStream(recentStreamId, () =>
		emptyDataStream.pipeThrough(new JsonToSseTransformStream())
	);

	if (!stream) {
		await clearResumableChatStreamId({ chatId, organizationId, streamId: recentStreamId });
		const messages = await getChatMessages({ chatId, organizationId });
		const mostRecentMessage = messages.at(-1);

		if (!mostRecentMessage || mostRecentMessage.role !== "assistant") {
			return new Response(emptyDataStream.pipeThrough(new JsonToSseTransformStream()), sseResponseInit);
		}

		const messageCreatedAt = new Date(mostRecentMessage.createdAt);
		const ageInSeconds = (resumeRequestedAt.getTime() - messageCreatedAt.getTime()) / 1000;

		if (ageInSeconds > 15) {
			return new Response(emptyDataStream.pipeThrough(new JsonToSseTransformStream()), sseResponseInit);
		}

		const [restoredMessage] = await convertChatMessagesForUI([mostRecentMessage]);

		const restoredStream = createUIMessageStream<DashboardChatUIMessage>({
			execute: ({ writer }) => {
				writer.write({
					data: JSON.stringify(restoredMessage),
					transient: true,
					type: "data-append-message",
				});
			},
		});

		return new Response(restoredStream.pipeThrough(new JsonToSseTransformStream()), sseResponseInit);
	}

	return new Response(stream, sseResponseInit);
};

const parseCreateStreamBody = async (request: Request, budget: { organizationId: string; userId: string }) => {
	if (!(await consumeChatRequestBudget(budget))) {
		throw new ORPCError("TOO_MANY_REQUESTS", { message: "Chat request limit reached. Try again shortly." });
	}

	try {
		const size = { bytes: 0 };

		const body = request.body?.pipeThrough(
			new TransformStream<Uint8Array, Uint8Array>({
				transform(chunk, controller) {
					size.bytes += chunk.byteLength;

					if (size.bytes > 2_000_000) {
						throw new Error("Chat request exceeds the byte limit");
					}

					controller.enqueue(chunk);
				},
			})
		);

		return createStreamBodySchema.parse(await new Response(body).json());
	} catch {
		throw new ORPCError("BAD_REQUEST", { message: "Invalid request." });
	}
};

const createDashboardAgentUIStream = async ({
	approvalContinuation,
	chatId,
	context,
	message,
	organizationId,
	persistedMessages,
	requestContext,
	signal,
}: {
	approvalContinuation: boolean;
	chatId: string;
	context: string;
	message: DashboardChatUIMessage;
	organizationId: string;
	persistedMessages: Awaited<ReturnType<typeof getChatMessages>>;
	requestContext: ReturnType<typeof createDashboardChatRequestContext>;
	signal: AbortSignal;
}) => {
	const dashboardChatAgent = mastra.getAgentById("dashboard-chat-agent");
	const streamErrorHandler = createStreamPartErrorHandler({ chatId, organizationId });

	const sharedOptions = {
		experimentalTransform: smoothStream({ chunking: "word" }),
		onError: streamErrorHandler,
		sendReasoning: false,
		version: "v7" as const,
	};

	const params = {
		abortSignal: signal,
		context: context ? [{ content: context, role: "system" as const }] : undefined,
		memory: { resource: organizationId, thread: chatId },
		requestContext,
		serverless: { waitUntil },
	};

	if (approvalContinuation) {
		return narrowMastraUIStream(
			await handleChatStream({
				...sharedOptions,
				agentId: dashboardChatAgent.id,
				mastra,
				params: {
					...params,
					messages: [message],
				},
			})
		);
	}

	if (message.role === "assistant") {
		await persistChatQuestionAnswers({ message, persistedMessages });
	}

	const result = await dashboardChatAgent.stream([message], params);

	return narrowMastraUIStream(toAISdkStream(result, { ...sharedOptions, from: "agent" }));
};

const waitForIndexedAttachments = async ({
	chatId,
	message,
	organizationId,
	signal,
}: {
	chatId: string;
	message: DashboardChatUIMessage;
	organizationId: string;
	signal: AbortSignal;
}) => {
	const fileIds = getIndexedAttachments(message).flatMap((attachment) =>
		attachment.mediaType.startsWith("image/") ? [] : [attachment.fileId]
	);

	if (fileIds.length === 0) {
		return;
	}

	try {
		await waitForFilesReady({ fileIds, organizationId, signal });
	} catch (error) {
		log.error({
			chatId,
			error: serializeLogError(error),
			fileIds,
			message: "Failed waiting for dashboard chat attachments",
			organizationId,
		});

		throw new ORPCError("BAD_REQUEST", {
			message: error instanceof Error ? error.message : "Failed to index attachments",
		});
	}
};

const assertUnusedUserMessageId = async (message: DashboardChatUIMessage) => {
	if (message.role === "user" && (await chatMessageIdExists(message.id))) {
		throw new ORPCError("BAD_REQUEST", { message: "Chat message id has already been used." });
	}
};

export const handleCreateChatStream = async (request: Request, params: { chatId: string }) => {
	const { chatId, organizationId, session } = await requireOrganizationSession({ headers: request.headers, params });
	await requireOrganizationPermission({ organizationId, permission: "write", userId: session.user.id });

	const body = await parseCreateStreamBody(request, { organizationId, userId: session.user.id });

	const [[unresolvedChatMessage], existingChat, libraryAsset, routeDecision] = await Promise.all([
		validateUIMessages<DashboardChatUIMessage>({ messages: [body.message] }),
		getChatWithMessages({ chatId, limit: 40, organizationId }),
		resolveLibraryAssetBinding({ assetId: body.library?.assetId, organizationId }),
		decideDashboardRoute({
			abortSignal: request.signal,
			library: Boolean(body.library),
			message: body.message,
		}),
	]);

	const submittedChatMessage = await resolveOwnedChatAttachments({
		message: unresolvedChatMessage,
		organizationId,
	});

	const persistedMessages = await loadReconciledPersistedMessages({
		chatId,
		existingMessages: existingChat?.messages ?? [],
		organizationId,
		rejectExpiredApproval: submittedChatMessage.role === "assistant",
	});

	const validatedMessage = validateSubmittedMessage({
		chatMessage: submittedChatMessage,
		existingMessages: persistedMessages,
		persistedMessages,
	});

	const chatMessage = validatedMessage.message;

	await assertUnusedUserMessageId(chatMessage);

	const streamId = uuidv4();
	const userStopSignal = new AbortController();

	const uiMessages =
		chatMessage.role === "assistant"
			? [...persistedMessages.slice(0, -1), chatMessage]
			: [...persistedMessages, chatMessage];

	const chatHasImageAttachment = hasRecentImageAttachment(uiMessages);

	await waitForIndexedAttachments({
		chatId,
		message: chatMessage,
		organizationId,
		signal: request.signal,
	});
	request.signal.throwIfAborted();
	await requireOrganizationPermission({ organizationId, permission: "write", userId: session.user.id });

	if (!existingChat) {
		const metadata = body.library
			? libraryChatScope({ groupId: libraryAsset?.groupId, userId: session.user.id })
			: undefined;

		try {
			await createChat({ id: chatId, metadata, organizationId });
		} catch (error) {
			if (error instanceof ChatOwnershipConflictError) {
				throw new ORPCError("BAD_REQUEST", { message: error.message });
			}

			throw error;
		}
	}

	const responseMessageId = chatMessage.role === "assistant" ? chatMessage.id : uuidv4();

	const { approvalContinuation, context, requestContext } = createAgentTurnInput({
		body,
		chatId,
		chatMessage,
		hasImageAttachment: chatHasImageAttachment,
		libraryAsset,
		organizationId,
		routeDecision,
		uiMessages,
		user: session.user,
	});

	const continuationClaim = validatedMessage.continuationId
		? {
				chatId,
				claimId: streamId,
				continuationId: validatedMessage.continuationId,
				messageId: chatMessage.id,
				organizationId,
			}
		: undefined;

	const messageClaim = chatMessage.role === "user" ? { claimId: streamId, messageId: chatMessage.id } : undefined;
	const agentExecutionStartedReference = { value: false };
	const releaseUnusedClaimsReference: MutableReference<Promise<void> | undefined> = { value: undefined };

	const releaseUnusedClaims = () => {
		if (agentExecutionStartedReference.value) {
			return Promise.resolve();
		}

		releaseUnusedClaimsReference.value ??= releaseChatClaims({ continuationClaim, messageClaim });

		return releaseUnusedClaimsReference.value;
	};

	try {
		if (messageClaim && !(await claimChatMessage(messageClaim))) {
			throw new ORPCError("BAD_REQUEST", { message: "This chat message has already been submitted." });
		}

		if (continuationClaim && !(await claimChatContinuation(continuationClaim))) {
			throw new ORPCError("BAD_REQUEST", {
				message: "This assistant continuation has already been submitted.",
			});
		}

		if (!(await setChatStreamId({ chatId, organizationId, streamId }))) {
			throw new ORPCError("BAD_REQUEST", { message: "This organization is being deleted." });
		}
	} catch (error) {
		await releaseUnusedClaims();
		throw error instanceof ChatCapacityError
			? new ORPCError("TOO_MANY_REQUESTS", { message: error.message })
			: error;
	}

	const shouldRunCancellationLoopReference = { value: true };
	const scheduleObservabilityFlush = createObservabilityFlushScheduler({ chatId, organizationId });

	const stream = createUIMessageStream<DashboardChatUIMessage>({
		execute: async ({ writer }) => {
			const checkCancellation = async () => {
				if ((await getActiveChatStreamId({ chatId, organizationId })) !== streamId) {
					userStopSignal.abort();
				}
			};

			const runCancellationLoop = async () => {
				while (shouldRunCancellationLoopReference.value && !userStopSignal.signal.aborted) {
					try {
						await checkCancellation();
					} catch (error) {
						log.error({
							chatId,
							error: serializeLogError(error),
							message: "Failed to check dashboard chat stream cancellation",
							streamId,
						});
					}

					if (!shouldRunCancellationLoopReference.value || userStopSignal.signal.aborted) {
						break;
					}

					await new Promise((resolve) => setTimeout(resolve, 500));
				}
			};

			if (!existingChat) {
				writer.write({
					data: { chatId },
					transient: true,
					type: "data-chat-created",
				});
			}

			runCancellationLoop();

			await requireOrganizationPermission({ organizationId, permission: "write", userId: session.user.id });

			const agentStream = await createDashboardAgentUIStream({
				approvalContinuation,
				chatId,
				context,
				message: chatMessage,
				organizationId,
				persistedMessages: existingChat?.messages ?? [],
				requestContext,
				signal: AbortSignal.any([userStopSignal.signal, AbortSignal.timeout(5 * 60_000)]),
			});

			agentExecutionStartedReference.value = true;
			writer.merge(agentStream);
		},
		generateId: () => responseMessageId,
		onError: (error) => {
			shouldRunCancellationLoopReference.value = false;
			scheduleObservabilityFlush();
			waitUntil(
				(async () => {
					try {
						await cleanupFailedActiveStream({ chatId, organizationId, releaseUnusedClaims, streamId });
						await releaseSuspendedContinuation({
							claim: continuationClaim,
							started: agentExecutionStartedReference,
						});
					} catch (cleanupError) {
						await log.error({
							chatId,
							error: serializeLogError(cleanupError),
							message: "Failed to clean up dashboard chat stream state",
							organizationId,
						});
					}
				})()
			);

			log.error({
				chatId,
				error: serializeLogError(error),
				message: "Error in dashboard chat stream",
				organizationId,
			});

			return "Oops, an error occurred!";
		},
		onFinish: async () => {
			shouldRunCancellationLoopReference.value = false;

			try {
				await clearActiveChatStreamId({ chatId, organizationId, streamId });
			} finally {
				scheduleObservabilityFlush();
			}
		},
		originalMessages: uiMessages,
	});

	const createEncodedStream = () => stream.pipeThrough(new JsonToSseTransformStream());

	try {
		return new Response(await getStreamContext().resumableStream(streamId, createEncodedStream), sseResponseInit);
	} catch (error) {
		try {
			await cleanupFailedResumableStream({ chatId, organizationId, releaseUnusedClaims, streamId });
		} finally {
			scheduleObservabilityFlush();
		}

		throw error;
	}
};
