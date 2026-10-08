import { z } from "zod";

import { client } from "@/lib/api-client";
import type { WebsiteGenerationEnvelopeV1 } from "@starter/infinite-website/contracts";

const retryDelays = [400, 800, 1600];

const workflowSubscriptionErrorSchema = z.compile(z.object({ code: z.string() }));

export const subscribeToWebsiteWorkflow = async ({
	afterCursor,
	onEnded,
	onEnvelope,
	signal,
	websiteId,
	workflowRunId,
}: {
	afterCursor?: string;
	onEnded: () => Promise<void>;
	onEnvelope: (envelope: WebsiteGenerationEnvelopeV1) => void;
	signal: AbortSignal;
	websiteId: string;
	workflowRunId: string;
}) => {
	const cursorReference = { value: afterCursor };

	for (const retryDelay of [undefined, ...retryDelays]) {
		if (retryDelay !== undefined) {
			await new Promise((resolve) => window.setTimeout(resolve, retryDelay));
		}

		if (signal.aborted) {
			return;
		}

		try {
			const events = await client.websites.streamWorkflow(
				{ afterCursor: cursorReference.value, websiteId, workflowRunId },
				{ signal }
			);

			for await (const envelope of events) {
				signal.throwIfAborted();
				cursorReference.value = envelope.cursor;
				onEnvelope(envelope);
			}

			if (!signal.aborted) {
				await onEnded();
			}

			return;
		} catch (error) {
			if (signal.aborted) {
				return;
			}

			const parsedError = workflowSubscriptionErrorSchema.safeParse(error);

			if (parsedError.success && parsedError.data.code === "NOT_FOUND") {
				await onEnded();

				return;
			}
		}
	}

	await onEnded();
};
