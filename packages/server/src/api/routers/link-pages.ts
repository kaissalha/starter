import { openapi } from "@orpc/openapi";
import { v5 as uuidv5 } from "uuid";
import { z } from "zod";

import { linkPageStateSchema } from "@starter/infinite-links/contracts";

import { convertChatMessagesForUI, getChatWithMessages } from "../../services/chat";
import {
	getLinkPage,
	LinkPageConflictError,
	LinkPageNotFoundError,
	publishLinkPageInputSchema,
	publishLinkPage,
	recommendLinkPageTheme,
	saveLinkPageInputSchema,
	saveLinkPage,
} from "../../services/link-pages";
import { organizationPermission, authedWithOrganization, publicApi } from "../base";

const outputSchema = z.compile(linkPageStateSchema);

const agentChat = authedWithOrganization
	.use(organizationPermission("write"))
	.meta(
		openapi({
			method: "GET",
			operationId: "getCurrentLinkPageAgentChat",
			path: "/link-pages/current/agent-chat",
			summary: "Get the caller's agent chat history for the current organization links page",
			tags: ["link-pages"],
		})
	)
	.handler(async ({ context }) => {
		const chatId = uuidv5(
			JSON.stringify(["starter:links-agent-chat", context.organizationId, context.session.user.id]),
			uuidv5.URL
		);

		const chat = await getChatWithMessages({ chatId, organizationId: context.organizationId });

		return { chatId, messages: chat ? await convertChatMessagesForUI(chat.messages) : [] };
	});

const get = authedWithOrganization
	.meta(publicApi(true))
	.meta(
		openapi({
			method: "GET",
			operationId: "getCurrentLinkPage",
			path: "/link-pages/current",
			summary: "Get the current organization links page",
			tags: ["link-pages"],
		})
	)
	.output(outputSchema)
	.handler(async ({ context }) => getLinkPage({ organizationId: context.organizationId }));

const save = authedWithOrganization
	.use(organizationPermission("write"))
	.meta(publicApi(true))
	.meta(
		openapi({
			method: "PUT",
			operationId: "saveLinkPage",
			path: "/link-pages/current",
			summary: "Save the current organization links page draft",
			tags: ["link-pages"],
		})
	)
	.errors({ CONFLICT: { message: "The links page changed elsewhere." } })
	.input(saveLinkPageInputSchema)
	.output(outputSchema)
	.handler(async ({ context, errors, input }) => {
		try {
			return await saveLinkPage({
				organizationId: context.organizationId,
				userId: context.session.user.id,
				...input,
			});
		} catch (error) {
			if (error instanceof LinkPageConflictError) {
				throw errors.CONFLICT();
			}

			throw error;
		}
	});

const publish = authedWithOrganization
	.use(organizationPermission("write"))
	.meta(publicApi(true))
	.meta(
		openapi({
			method: "POST",
			operationId: "publishLinkPage",
			path: "/link-pages/current/publish",
			summary: "Publish the current organization links page",
			tags: ["link-pages"],
		})
	)
	.errors({
		CONFLICT: { message: "The links page changed elsewhere." },
		NOT_FOUND: { message: "The links page draft was not found." },
	})
	.input(publishLinkPageInputSchema)
	.output(outputSchema)
	.handler(async ({ context, errors, input }) => {
		try {
			return await publishLinkPage({ organizationId: context.organizationId, ...input });
		} catch (error) {
			if (error instanceof LinkPageConflictError) {
				throw errors.CONFLICT();
			}

			if (error instanceof LinkPageNotFoundError) {
				throw errors.NOT_FOUND();
			}

			throw error;
		}
	});

const recommendTheme = authedWithOrganization
	.use(organizationPermission("write"))
	.meta(
		openapi({
			method: "POST",
			operationId: "recommendLinkPageTheme",
			path: "/link-pages/current/recommend-theme",
			summary: "Recommend a Links theme for a natural-language style request",
			tags: ["link-pages"],
		})
	)
	.input(
		z.compile(
			z.strictObject({ request: z.string().trim().min(1).max(2000) }).meta({ id: "RecommendLinkPageThemeInput" })
		)
	)
	.handler(({ input, signal }) => recommendLinkPageTheme({ abortSignal: signal, request: input.request }));

export const linkPages = { agentChat, get, publish, recommendTheme, save };
