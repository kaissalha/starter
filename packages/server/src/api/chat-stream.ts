import { handleChatStream, smoothStream } from "@mastra/ai-sdk";
import { ORPCError } from "@orpc/client";
import { waitUntil } from "@vercel/functions";
import {
	createUIMessageStreamResponse,
	isToolUIPart,
	lastAssistantMessageIsCompleteWithApprovalResponses,
	UI_MESSAGE_STREAM_HEADERS,
	validateUIMessages,
} from "ai";
import { createResumableStreamContext } from "resumable-stream/ioredis";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { log, serializeLogError } from "@starter/observability";

import { createDashboardChatRequestContext, type DashboardChatUIMessage } from "../ai/types";
import { resolveSession } from "../lib/auth";
import { checkRateLimit } from "../lib/redis";
import { flushMastraObservability, mastra } from "../mastra";
import {
	chatMessageIdExists,
	ChatOwnershipConflictError,
	convertChatMessagesForUI,
	createChat,
	getChatWithMessages,
	persistChatQuestionAnswers,
	saveChatUserMessage,
} from "../services/chat";
import {
	clearActiveChatStream,
	getActiveChatStream,
	getChatRedisClient,
	setActiveChatStream,
} from "../services/chat-stream-state";
import { libraryChatScope } from "../services/library";
import { requireOrganizationPermission } from "../services/permissions";
import { waitForFilesReady } from "../services/storage";
import {
	decideDashboardRoute,
	describeSafeStreamError,
	getIndexedAttachments,
	hasPendingAssistantRequest,
	loadChatTurnContext,
	resolveDashboardRoute,
	resolveLibraryAssetBinding,
	resolveOwnedChatAttachments,
} from "./chat-stream-context";
import { narrowMastraUIStream } from "./chat-stream-narrow";
import { uiMessageSchema } from "./routers/chats";

const chatIdSchema = z.compile(z.uuid());

const requestBodySchema = z.compile(
	z.object({
		library: z.strictObject({ assetId: z.uuid().optional() }).optional(),
		message: uiMessageSchema,
	})
);

type StreamContextReference = { value?: ReturnType<typeof createResumableStreamContext> };

const streamContextReference: StreamContextReference = {};

const getStreamContext = () => {
	const publisher = getChatRedisClient();

	streamContextReference.value ??= createResumableStreamContext({
		keyPrefix: "resumable-stream",
		publisher,
		subscriber: publisher.duplicate(),
		waitUntil,
	});

	return streamContextReference.value;
};

const badRequest = (message: string) => new ORPCError("BAD_REQUEST", { message });

const requireChatSession = async ({
	headers,
	params,
	permission,
}: {
	headers: Headers;
	params: { chatId: string };
	permission: "read" | "write";
}) => {
	const chatId = chatIdSchema.safeParse(params.chatId);

	if (!chatId.success) {
		throw badRequest("Invalid chat id.");
	}

	const session = await resolveSession(headers, false);

	if (!session) {
		throw new ORPCError("UNAUTHORIZED", { message: "Authentication is required." });
	}

	const organizationId = session.session.activeOrganizationId;

	if (!organizationId) {
		throw badRequest("Organization not found");
	}

	await requireOrganizationPermission({ organizationId, permission, userId: session.user.id });

	return { chatId: chatId.data, organizationId, user: session.user };
};

const parseRequestBody = async (request: Request) => {
	try {
		const text = await request.text();

		if (text.length > 2_000_000) {
			throw new Error("Chat request exceeds the size limit");
		}

		return requestBodySchema.parse(JSON.parse(text));
	} catch {
		throw badRequest("Invalid request.");
	}
};

const validateSubmittedMessage = async ({
	chatId,
	message,
	organizationId,
	persistedMessages,
}: {
	chatId: string;
	message: DashboardChatUIMessage;
	organizationId: string;
	persistedMessages: Array<DashboardChatUIMessage>;
}) => {
	if (message.role === "system") {
		throw badRequest("System messages cannot be submitted by clients.");
	}

	if (message.role === "user") {
		if (hasPendingAssistantRequest(persistedMessages.at(-1))) {
			throw badRequest("Resolve the pending assistant request before starting a new turn.");
		}

		if (await chatMessageIdExists(message.id)) {
			throw badRequest("Chat message id has already been used.");
		}

		return;
	}

	if (message.id !== persistedMessages.at(-1)?.id) {
		throw badRequest("Assistant continuation does not match the pending request.");
	}

	const { runs } = await mastra
		.getAgentById("dashboard-chat-agent")
		.listSuspendedRuns({ resourceId: organizationId, threadId: chatId });

	const suspended = new Set(
		runs.flatMap(({ runId, toolCalls }) => toolCalls.map(({ toolCallId }) => `${runId}::${toolCallId}`))
	);

	if (
		message.parts.some(
			(part) => isToolUIPart(part) && part.state === "approval-responded" && !suspended.has(part.approval.id)
		)
	) {
		throw badRequest("This approval is no longer pending.");
	}
};

export const handleCreateChatStream = async (request: Request, params: { chatId: string }) => {
	const { chatId, organizationId, user } = await requireChatSession({
		headers: request.headers,
		params,
		permission: "write",
	});

	const limits = await Promise.all([
		checkRateLimit({ key: `chat:user:${organizationId}:${user.id}`, max: 30, windowSeconds: 60 }),
		checkRateLimit({ key: `chat:organization:${organizationId}`, max: 600, windowSeconds: 3600 }),
	]);

	if (limits.some(({ allowed }) => !allowed)) {
		throw new ORPCError("TOO_MANY_REQUESTS", { message: "Chat request limit reached. Try again shortly." });
	}

	const body = await parseRequestBody(request);

	const [[submittedMessage], existingChat, libraryAsset, routeDecision] = await Promise.all([
		validateUIMessages<DashboardChatUIMessage>({ messages: [body.message] }),
		getChatWithMessages({ chatId, limit: 40, organizationId }),
		resolveLibraryAssetBinding({ assetId: body.library?.assetId, organizationId }),
		decideDashboardRoute({ abortSignal: request.signal, library: Boolean(body.library), message: body.message }),
	]);

	const message = await resolveOwnedChatAttachments({ message: submittedMessage, organizationId });
	const storedMessages = existingChat?.messages ?? [];
	const persistedMessages = await convertChatMessagesForUI(storedMessages);
	const approvalContinuation = lastAssistantMessageIsCompleteWithApprovalResponses({ messages: [message] });

	await validateSubmittedMessage({ chatId, message, organizationId, persistedMessages });

	try {
		await waitForFilesReady({
			fileIds: getIndexedAttachments(message).flatMap(({ fileId, mediaType }) =>
				mediaType.startsWith("image/") ? [] : [fileId]
			),
			organizationId,
			signal: request.signal,
		});
	} catch (error) {
		throw badRequest(error instanceof Error ? error.message : "Failed to index attachments");
	}

	request.signal.throwIfAborted();

	try {
		if (!existingChat) {
			const metadata = body.library
				? libraryChatScope({ groupId: libraryAsset?.groupId, userId: user.id })
				: undefined;

			await createChat({ id: chatId, metadata, organizationId });
		}
	} catch (error) {
		throw error instanceof ChatOwnershipConflictError ? badRequest(error.message) : error;
	}

	if (message.role === "user") {
		await saveChatUserMessage({ chatId, message, organizationId });
	} else if (
		!approvalContinuation &&
		(await persistChatQuestionAnswers({ message, persistedMessages: storedMessages })) === 0
	) {
		throw badRequest("Assistant continuation does not match the pending request.");
	}

	const uiMessages = [...persistedMessages.filter(({ id }) => id !== message.id), message];

	const hasImageAttachment = uiMessages
		.slice(-3)
		.some(({ parts }) => parts.some((part) => part.type === "file" && part.mediaType.startsWith("image/")));

	const route = resolveDashboardRoute({
		decision: routeDecision,
		editorBound: Boolean(body.library),
		hasImageAttachment,
		library: Boolean(body.library),
	});

	const context = loadChatTurnContext({ editor: { libraryAsset }, route, uiMessages });
	const streamId = uuidv4();
	const stopController = new AbortController();
	const scope = { chatId, organizationId };

	await setActiveChatStream({ ...scope, streamId });

	const stopPoll = setInterval(async () => {
		try {
			if ((await getActiveChatStream(scope)) !== streamId) {
				stopController.abort();
			}
		} catch {}
	}, 1000);

	const finish = () => {
		clearInterval(stopPoll);
		waitUntil(
			(async () => {
				try {
					await Promise.all([clearActiveChatStream({ ...scope, streamId }), flushMastraObservability()]);
				} catch (error) {
					await log.error({
						...scope,
						error: serializeLogError(error),
						message: "Failed to finish chat stream",
					});
				}
			})()
		);
	};

	try {
		const agentStream = await handleChatStream({
			agentId: "dashboard-chat-agent",
			experimentalTransform: smoothStream({ chunking: "word" }),
			mastra,
			onError: (error) => {
				log.error({ ...scope, error: serializeLogError(error), message: "Error in dashboard chat stream" });

				return describeSafeStreamError(error);
			},
			params: {
				abortSignal: AbortSignal.any([stopController.signal, AbortSignal.timeout(5 * 60_000)]),
				context: context ? [{ content: context, role: "system" }] : undefined,
				memory: { resource: organizationId, thread: chatId },
				messages: [message],
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
				savePerStep: true,
				serverless: { waitUntil },
			},
			version: "v7",
		});

		return createUIMessageStreamResponse({
			consumeSseStream: async ({ stream }) => {
				await getStreamContext().createNewResumableStream(streamId, () => stream);
			},
			stream: narrowMastraUIStream(agentStream).pipeThrough(new TransformStream({ flush: finish })),
		});
	} catch (error) {
		finish();
		throw error;
	}
};

export const handleResumeChatStream = async (request: Request, params: { chatId: string }) => {
	const { chatId, organizationId } = await requireChatSession({
		headers: request.headers,
		params,
		permission: "read",
	});

	const streamId = await getActiveChatStream({ chatId, organizationId });
	const stream = streamId ? await getStreamContext().resumeExistingStream(streamId) : null;

	return stream ? new Response(stream, { headers: UI_MESSAGE_STREAM_HEADERS }) : new Response(null, { status: 204 });
};
