import { openapi } from "@orpc/openapi";
import { z } from "zod";

import { getChat, getChats } from "../../services/chat";
import { cancelStream } from "../../services/chat-stream-state";
import { organizationPermission, authedWithOrganization } from "../base";
import { getReconciledChatMessages } from "../chat-approvals";

export const uiMessageSchema = z.compile(
	z
		.looseObject({
			id: z.string().min(1),
			parts: z.array(z.looseObject({ type: z.string() })),
			role: z.enum(["system", "user", "assistant"]),
		})
		.meta({
			description: "An AI SDK UI message. Additional part-specific fields are passed through as-is.",
			id: "UIMessage",
		})
);

const chatIdSchema = z.compile(z.uuid().meta({ examples: ["018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d"] }));

const chatPageSchema = z.compile(z.number().int().nonnegative().meta({ description: "Zero-based page index." }));

const chatSummarySchema = z.compile(
	z
		.object({
			createdAt: z.string(),
			id: z.uuid(),
			title: z.string().nullable(),
			updatedAt: z.string(),
		})
		.meta({ id: "ChatSummary" })
);

const list = authedWithOrganization
	.meta(
		openapi({
			method: "GET",
			operationId: "listChats",
			path: "/chats",
			successDescription: "The organization's chats, most recently updated first.",
			summary: "List chats for the active organization",
			tags: ["chats"],
		})
	)
	.input(z.compile(z.object({ page: chatPageSchema.optional() })))
	.output(
		z.compile(
			z
				.object({ chats: z.array(chatSummarySchema), nextPage: chatPageSchema.nullable() })
				.meta({ id: "ListChatsResponse" })
		)
	)
	.handler(async ({ context, input }) => {
		const page = await getChats({ organizationId: context.organizationId, page: input.page });

		return {
			chats: page.chats.map((chat) => ({
				createdAt: chat.createdAt.toISOString(),
				id: chat.id,
				title: chat.title || null,
				updatedAt: chat.updatedAt.toISOString(),
			})),
			nextPage: page.nextPage,
		};
	});

const cancelStreamProcedure = authedWithOrganization
	.use(organizationPermission("write"))
	.meta(
		openapi({
			method: "DELETE",
			operationId: "cancelChatStream",
			path: "/chats/{chatId}/stream",
			summary: "Cancel the active chat completion stream",
			tags: ["chats"],
		})
	)
	.errors({
		FORBIDDEN: { message: "The authenticated user cannot access this chat." },
	})
	.input(z.compile(z.object({ chatId: chatIdSchema })))
	.handler(async ({ context, errors, input }) => {
		const { chatId } = input;
		const chat = await getChat(chatId, context.organizationId);

		if (!chat) {
			throw errors.FORBIDDEN({ message: "Access to chat forbidden" });
		}

		await cancelStream({ chatId, organizationId: context.organizationId });
	});

const messages = authedWithOrganization
	.meta(
		openapi({
			method: "GET",
			operationId: "getChatMessages",
			path: "/chats/{chatId}/messages",
			summary: "Get the persisted messages of a chat",
			tags: ["chats"],
		})
	)
	.input(z.compile(z.object({ chatId: chatIdSchema })))
	.handler(({ context, input }) =>
		getReconciledChatMessages({ chatId: input.chatId, organizationId: context.organizationId })
	);

export const chats = {
	cancelStream: cancelStreamProcedure,
	list,
	messages,
};
