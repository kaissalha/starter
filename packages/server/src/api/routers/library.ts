import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { convertChatMessagesForUI, findLatestChat, getChatWithMessages } from "../../services/chat";
import {
	deleteLibraryAsset,
	generateLibraryLogo,
	getLibraryAsset,
	libraryAssetDetailSchema,
	libraryAssetIdSchema,
	libraryAssetSchema,
	libraryAssetUpdateSchema,
	libraryChatScope,
	LibraryError,
	libraryListInputSchema,
	libraryListResultSchema,
	libraryLogoGenerateSchema,
	listLibraryAssets,
	updateLibraryAsset,
} from "../../services/library";
import { authedWithOrganization, organizationPermission } from "../base";

const procedure = authedWithOrganization
	.errors({
		CONFLICT: { message: "The asset changed elsewhere." },
		NOT_FOUND: { message: "The asset was not found." },
		TOO_MANY_REQUESTS: { message: "Too many logos generated. Try again later." },
	})
	.use(async ({ errors, next }) => {
		try {
			return await next();
		} catch (error) {
			if (error instanceof LibraryError) {
				if (error.code === "RATE_LIMITED") {
					throw errors.TOO_MANY_REQUESTS();
				}

				throw error.code === "NOT_FOUND" ? errors.NOT_FOUND() : errors.CONFLICT({ message: error.message });
			}

			throw error;
		}
	});

const writeProcedure = procedure.use(organizationPermission("write"));

const list = procedure
	.input(libraryListInputSchema)
	.output(libraryListResultSchema)
	.handler(({ context, input }) => listLibraryAssets({ input, organizationId: context.organizationId }));

const get = procedure
	.input(libraryAssetIdSchema)
	.output(libraryAssetDetailSchema)
	.handler(({ context, input }) =>
		getLibraryAsset({ assetId: input.assetId, organizationId: context.organizationId })
	);

const agentChat = writeProcedure
	.input(z.strictObject({ assetId: z.uuid().optional() }))
	.handler(async ({ context, input }) => {
		const asset = input.assetId
			? await getLibraryAsset({ assetId: input.assetId, organizationId: context.organizationId })
			: null;

		const chat = await findLatestChat({
			metadata: libraryChatScope({
				groupId: asset?.groupId,
				userId: context.session.user.id,
			}),
			organizationId: context.organizationId,
		});

		const saved = chat
			? await getChatWithMessages({ chatId: chat.id, organizationId: context.organizationId })
			: null;

		return {
			chatId: chat?.id ?? uuidv4(),
			messages: saved ? await convertChatMessagesForUI(saved.messages) : [],
		};
	});

const update = writeProcedure
	.input(libraryAssetUpdateSchema)
	.output(libraryAssetDetailSchema)
	.handler(({ context, input }) =>
		updateLibraryAsset({
			actor: { organizationId: context.organizationId, userId: context.session.user.id },
			input,
		})
	);

const generateLogo = writeProcedure
	.input(libraryLogoGenerateSchema)
	.output(libraryAssetSchema)
	.handler(({ context, input, signal }) =>
		generateLibraryLogo({
			abortSignal: signal,
			actor: { organizationId: context.organizationId, userId: context.session.user.id },
			input,
		})
	);

const remove = procedure
	.use(organizationPermission("delete"))
	.input(libraryAssetIdSchema)
	.output(z.strictObject({ id: z.uuid() }))
	.handler(async ({ context, errors, input }) => {
		const deleted = await deleteLibraryAsset({
			actor: { organizationId: context.organizationId, userId: context.session.user.id },
			assetId: input.assetId,
		});

		if (!deleted) {
			throw errors.NOT_FOUND();
		}

		return { id: input.assetId };
	});

export const library = {
	agentChat,
	delete: remove,
	generateLogo,
	get,
	list,
	update,
};
