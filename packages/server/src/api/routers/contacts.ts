import { openapi } from "@orpc/openapi";
import { z } from "zod";

import {
	ContactError,
	contactCreateSchema,
	contactInquirySummaryInputSchema,
	contactListInputSchema,
	contactListResultSchema,
	contactMessagesInputSchema,
	contactMessagesResultSchema,
	contactMessageSchema,
	contactMessageTriageInputSchema,
	contactMessageTriageSchema,
	contactSchema,
	contactUpdateSchema,
	updateContact,
	deleteContact,
	createContact,
	getContact,
	getContactInquirySummary,
	getContactMessage,
	listContacts,
	listContactMessages,
	triageContactMessage,
} from "../../services/contacts";
import { organizationPermission, authedWithOrganization, publicApi } from "../base";

const procedure = authedWithOrganization
	.meta(publicApi(true))
	.errors({
		CONFLICT: { message: "A contact with this email already exists." },
		FORBIDDEN: { message: "Organization membership is required." },
		NOT_FOUND: { message: "Contact not found." },
	})
	.use(async ({ context, errors, next }) => {
		try {
			return await next({
				context: {
					contactActor: { organizationId: context.organizationId, userId: context.session.user.id },
					contactSource:
						context.authMode === "session-or-api-key" ? ("api" as const) : ("dashboard" as const),
				},
			});
		} catch (error) {
			if (error instanceof ContactError) {
				throw errors[error.code]({ message: error.message });
			}

			throw error;
		}
	});

const list = procedure
	.meta(
		openapi({
			method: "GET",
			operationId: "listContacts",
			path: "/contacts",
			summary: "List contacts",
			tags: ["contacts"],
		})
	)
	.input(z.compile(contactListInputSchema))
	.output(contactListResultSchema)
	.handler(({ context, input }) => listContacts({ actor: context.contactActor, input }));

const get = procedure
	.meta(
		openapi({
			method: "GET",
			operationId: "getContact",
			path: "/contacts/{contactId}",
			summary: "Get a contact",
			tags: ["contacts"],
		})
	)
	.input(z.compile(z.strictObject({ contactId: z.uuid() })))
	.output(contactSchema)
	.handler(({ context, input }) => getContact({ actor: context.contactActor, contactId: input.contactId }));

const create = procedure
	.use(organizationPermission("write"))
	.meta(
		openapi({
			method: "POST",
			operationId: "createContact",
			path: "/contacts",
			summary: "Add a contact",
			tags: ["contacts"],
		})
	)
	.input(z.compile(contactCreateSchema))
	.output(contactSchema)
	.handler(({ context, input }) =>
		createContact({ actor: context.contactActor, input, source: context.contactSource })
	);

const update = procedure
	.use(organizationPermission("write"))
	.meta(
		openapi({
			method: "PUT",
			operationId: "updateContact",
			path: "/contacts/{contactId}",
			summary: "Update a contact",
			tags: ["contacts"],
		})
	)
	.input(z.compile(contactUpdateSchema))
	.output(contactSchema)
	.handler(({ context, input }) =>
		updateContact({ actor: context.contactActor, input, source: context.contactSource })
	);

const remove = procedure
	.use(organizationPermission("delete"))
	.meta(
		openapi({
			method: "DELETE",
			operationId: "deleteContact",
			path: "/contacts/{contactId}",
			summary: "Delete a contact",
			tags: ["contacts"],
		})
	)
	.input(z.compile(z.strictObject({ contactId: z.uuid() })))
	.output(z.strictObject({ id: z.uuid() }))
	.handler(({ context, input }) =>
		deleteContact({ actor: context.contactActor, contactId: input.contactId, source: context.contactSource })
	);

const messages = procedure
	.meta(
		openapi({
			method: "GET",
			operationId: "listContactMessages",
			path: "/contacts/{contactId}/messages",
			summary: "List contact messages",
			tags: ["contacts"],
		})
	)
	.input(z.compile(contactMessagesInputSchema))
	.output(contactMessagesResultSchema)
	.handler(({ context, input }) => listContactMessages({ actor: context.contactActor, input }));

const message = procedure
	.meta(
		openapi({
			method: "GET",
			operationId: "getContactMessage",
			path: "/contacts/{contactId}/messages/{messageId}",
			summary: "Get a contact message",
			tags: ["contacts"],
		})
	)
	.input(z.compile(contactMessageTriageInputSchema))
	.output(contactMessageSchema)
	.handler(({ context, input }) => getContactMessage({ actor: context.contactActor, ...input }));

const triage = procedure
	.meta(
		openapi({
			method: "POST",
			operationId: "triageContactMessage",
			path: "/contacts/{contactId}/messages/{messageId}/triage",
			summary: "Suggest a contact message category and urgency",
			tags: ["contacts"],
		})
	)
	.input(z.compile(contactMessageTriageInputSchema))
	.output(contactMessageTriageSchema)
	.handler(({ context, input, signal }) =>
		triageContactMessage({ abortSignal: signal, actor: context.contactActor, input, source: context.contactSource })
	);

const inquirySummary = procedure
	.meta(
		openapi({
			method: "GET",
			operationId: "getContactInquirySummary",
			path: "/contacts/inquiry-summary",
			summary: "Summarize recent website inquiries by category and urgency",
			tags: ["contacts"],
		})
	)
	.input(z.compile(contactInquirySummaryInputSchema))
	.handler(({ context, input }) => getContactInquirySummary({ actor: context.contactActor, input }));

export const contacts = { create, delete: remove, get, inquirySummary, list, message, messages, triage, update };
