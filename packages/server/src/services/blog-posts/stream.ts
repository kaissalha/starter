import { streamToEventIterator } from "@orpc/server";
import { getRun } from "workflow/api";
import type { z } from "zod";

import { readBlogPost, requireBlogMember } from "./access";
import {
	BlogPostError,
	blogGenerationPreviewSchema,
	type BlogActor,
	type blogGenerationEnvelopeSchema,
	type blogGenerationStreamInputSchema,
} from "./contracts";

export const streamBlogGeneration = async ({
	actor,
	input,
}: {
	actor: BlogActor;
	input: z.infer<typeof blogGenerationStreamInputSchema>;
}) => {
	await requireBlogMember({ actor });
	const post = await readBlogPost({ organizationId: actor.organizationId, postId: input.postId });

	if (post.generationRunId !== input.runId || post.generationStatus !== "writing") {
		throw new BlogPostError("NOT_FOUND", "The blog generation was not found.");
	}

	const run = getRun(input.runId);

	if (!(await run.exists)) {
		throw new BlogPostError("NOT_FOUND", "The blog generation was not found.");
	}

	const cursor = { value: input.afterCursor === undefined ? 0 : Number(input.afterCursor) + 1 };

	return streamToEventIterator(
		run.getReadable({ startIndex: cursor.value }).pipeThrough(
			new TransformStream<unknown, z.infer<typeof blogGenerationEnvelopeSchema>>({
				transform: (value, controller) => {
					controller.enqueue({
						...blogGenerationPreviewSchema.parse(value),
						cursor: String(cursor.value++),
					});
				},
			})
		)
	);
};
