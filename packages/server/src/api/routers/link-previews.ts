import { z } from "zod";

import { getLinkPreview, LinkPreviewRateLimitError } from "../../services/link-preview";
import { authed } from "../base";

const linkPreviewResponseSchema = z.compile(
	z
		.object({
			description: z.string(),
			favicon: z.url().nullable(),
			siteName: z.string(),
			title: z.string(),
			url: z.url(),
		})
		.meta({ id: "UrlMetadata" })
		.nullable()
);

const get = authed
	.input(z.compile(z.object({ url: z.url() })))
	.output(linkPreviewResponseSchema)
	.handler(async ({ context, errors, input }) => {
		try {
			return await getLinkPreview({ url: input.url, userId: context.session.user.id });
		} catch (error) {
			if (error instanceof LinkPreviewRateLimitError) {
				throw errors.TOO_MANY_REQUESTS();
			}

			throw error;
		}
	});

export const linkPreviews = {
	get,
};
