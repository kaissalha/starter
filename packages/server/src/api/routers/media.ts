import { z } from "zod";

import {
	deleteUploadedMedia,
	listUploadedMedia,
	mediaListInputSchema,
	registeredUploadSchema,
	registerUpload,
	registerUploadInputSchema,
	uploadedMediaSchema,
	UploadRejectedError,
} from "../../services/media";
import { authedWithOrganization, organizationPermission } from "../base";

const list = authedWithOrganization
	.input(mediaListInputSchema)
	.output(z.object({ items: z.array(uploadedMediaSchema), nextOffset: z.number().nullable() }))
	.handler(({ context, input, signal }) =>
		listUploadedMedia({ ...input, abortSignal: signal, organizationId: context.organizationId })
	);

const remove = authedWithOrganization
	.use(organizationPermission("delete"))
	.errors({ NOT_FOUND: { message: "The media was not found." } })
	.input(z.compile(z.strictObject({ mediaId: z.uuid() })))
	.output(z.strictObject({ id: z.uuid() }))
	.handler(async ({ context, errors, input }) => {
		const deleted = await deleteUploadedMedia({
			fileId: input.mediaId,
			organizationId: context.organizationId,
			userId: context.session.user.id,
		});

		if (!deleted) {
			throw errors.NOT_FOUND();
		}

		return { id: input.mediaId };
	});

const register = authedWithOrganization
	.use(organizationPermission("write"))
	.errors({ BAD_REQUEST: { message: "The upload was rejected." } })
	.input(registerUploadInputSchema)
	.output(registeredUploadSchema)
	.handler(async ({ context, errors, input }) => {
		try {
			return await registerUpload({
				input,
				organizationId: context.organizationId,
				userId: context.session.user.id,
			});
		} catch (error) {
			if (error instanceof UploadRejectedError) {
				throw errors.BAD_REQUEST({ message: error.message });
			}

			throw error;
		}
	});

export const media = { delete: remove, list, register };
