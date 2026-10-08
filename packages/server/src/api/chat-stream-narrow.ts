import type { InferUIMessageChunk, UIMessageChunk } from "ai";

import { isDashboardMutationToolName } from "../ai/tools";
import type { DashboardChatUIMessage } from "../ai/types";

type NarrowedChunk = InferUIMessageChunk<DashboardChatUIMessage>;

export const narrowMastraUIStream = (stream: ReadableStream<UIMessageChunk>): ReadableStream<NarrowedChunk> => {
	const held = new Map<string, Array<NarrowedChunk>>();

	const release = ({
		controller,
		toolCallId,
	}: {
		controller: TransformStreamDefaultController<NarrowedChunk>;
		toolCallId: string;
	}) => {
		for (const chunk of held.get(toolCallId) ?? []) {
			controller.enqueue(chunk);
		}

		held.delete(toolCallId);
	};

	return stream.pipeThrough(
		new TransformStream<UIMessageChunk, NarrowedChunk>({
			transform: (chunk, controller) => {
				if ("data" in chunk || chunk.type === "message-metadata") {
					return;
				}

				switch (chunk.type) {
					case "start":
					case "finish": {
						const { messageMetadata: _messageMetadata, ...chunkWithoutMetadata } = chunk;
						controller.enqueue(chunkWithoutMetadata);

						return;
					}

					case "start-step":
						held.clear();
						break;
					case "tool-input-start":
						if (isDashboardMutationToolName(chunk.toolName)) {
							held.set(chunk.toolCallId, [chunk]);

							return;
						}

						break;
					case "tool-input-delta": {
						const chunks = held.get(chunk.toolCallId);

						if (chunks) {
							chunks.push(chunk);

							return;
						}

						break;
					}

					case "tool-input-available":
						if (held.has(chunk.toolCallId) || isDashboardMutationToolName(chunk.toolName)) {
							held.set(chunk.toolCallId, [...(held.get(chunk.toolCallId) ?? []), chunk]);

							return;
						}

						break;
					case "tool-approval-request":
					case "tool-output-available":
					case "tool-output-error":
					case "tool-output-denied":
						release({ controller, toolCallId: chunk.toolCallId });
						break;
					default:
				}

				controller.enqueue(chunk);
			},
		})
	);
};
