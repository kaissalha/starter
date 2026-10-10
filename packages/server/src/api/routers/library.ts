import { z } from "zod";

import {
	generateLibraryLogo,
	libraryAssetSchema,
	LibraryError,
	libraryListInputSchema,
	libraryLogoGenerateSchema,
	listLibraryAssets,
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

const libraryListResultSchema = z.strictObject({
	counts: z.strictObject({ all: z.int(), document: z.int(), image: z.int(), video: z.int() }),
	items: z.array(libraryAssetSchema),
	nextOffset: z.int().nullable(),
});

const writeProcedure = procedure.use(organizationPermission("write"));

const list = procedure
	.input(libraryListInputSchema)
	.output(libraryListResultSchema)
	.handler(({ context, input }) => listLibraryAssets({ input, organizationId: context.organizationId }));

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

export const library = {
	generateLogo,
	list,
};
