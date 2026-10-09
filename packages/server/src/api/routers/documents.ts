import { openapi } from "@orpc/openapi";
import { z } from "zod";

import {
	createDocument,
	createDocumentInputSchema,
	createDocumentResponseSchema,
	documentSchema,
	toDocumentResponse,
} from "../../services/documents";
import { deleteFile, getFile } from "../../services/storage";
import { organizationPermission, authedWithOrganization } from "../base";

const create = authedWithOrganization
	.use(organizationPermission("write"))
	.meta(
		openapi({
			description: "Creates a text document and queues it for knowledge-base ingestion.",
			method: "POST",
			operationId: "createDocument",
			path: "/documents",
			successDescription: "The document was accepted for ingestion.",
			successStatus: 202,
			summary: "Create a knowledge-base text document",
			tags: ["documents"],
		})
	)
	.input(createDocumentInputSchema)
	.output(createDocumentResponseSchema)
	.handler(({ context, input }) =>
		createDocument({ input, organizationId: context.organizationId, userId: context.session.user.id })
	);

const get = authedWithOrganization
	.meta(
		openapi({
			method: "GET",
			operationId: "getDocument",
			path: "/documents/{documentId}",
			summary: "Get a knowledge-base document",
			tags: ["documents"],
		})
	)
	.errors({
		NOT_FOUND: { message: "The document was not found." },
	})
	.input(z.compile(z.object({ documentId: z.uuid().meta({ examples: ["018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d"] }) })))
	.output(documentSchema)
	.handler(async ({ context, errors, input }) => {
		const file = await getFile({ fileId: input.documentId, organizationId: context.organizationId });

		if (!file || file.deletedAt) {
			throw errors.NOT_FOUND({ message: "Document not found" });
		}

		return toDocumentResponse(file);
	});

const remove = authedWithOrganization
	.use(organizationPermission("delete"))
	.meta(
		openapi({
			method: "DELETE",
			operationId: "deleteDocument",
			path: "/documents/{documentId}",
			summary: "Delete a knowledge-base document",
			tags: ["documents"],
		})
	)
	.errors({ NOT_FOUND: { message: "The document was not found." } })
	.input(
		z.compile(z.strictObject({ documentId: z.uuid().meta({ examples: ["018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d"] }) }))
	)
	.output(z.strictObject({ id: z.uuid() }))
	.handler(async ({ context, errors, input }) => {
		const deleted = await deleteFile({
			deletedBy: context.session.user.id,
			fileId: input.documentId,
			organizationId: context.organizationId,
		});

		if (!deleted) {
			throw errors.NOT_FOUND({ message: "Document not found" });
		}

		return { id: input.documentId };
	});

export const documents = {
	create,
	delete: remove,
	get,
};
