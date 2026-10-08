"use client";

import { useEffect, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { apiClient, client } from "@/lib/api-client";
import type { Iso6391LanguageCode } from "@starter/infinite-website/contracts";

import type { BlogEditorPost } from "./use-blog-editor-controller";

export const useBlogGenerationStream = (post: Pick<BlogEditorPost, "document" | "generationRunId" | "id">) => {
	const queryClient = useQueryClient();

	const [preview, setPreview] = useState<{ document: BlogEditorPost["document"]; locale: Iso6391LanguageCode }>({
		document: post.document,
		locale: "en",
	});

	const { generationRunId: runId, id: postId } = post;
	useEffect(() => {
		if (!runId) {
			return;
		}

		const controller = new AbortController();

		const subscribe = async () => {
			const cursor = { value: "" };

			for (const delay of [0, 400, 800, 1600]) {
				if (delay) {
					await new Promise((resolve) => window.setTimeout(resolve, delay));
				}

				if (controller.signal.aborted) {
					return;
				}

				try {
					const events = await client.blogPosts.streamGeneration(
						{ afterCursor: cursor.value || undefined, postId, runId },
						{ signal: controller.signal }
					);

					for await (const event of events) {
						controller.signal.throwIfAborted();
						cursor.value = event.cursor;
						setPreview({ document: event.document, locale: event.locale });
					}

					break;
				} catch {
					if (controller.signal.aborted) {
						return;
					}
				}
			}

			if (!controller.signal.aborted) {
				await queryClient.invalidateQueries(apiClient.blogPosts.get.queryOptions({ input: { postId } }));
			}
		};

		subscribe();

		return () => controller.abort();
	}, [postId, queryClient, runId]);

	return preview;
};
