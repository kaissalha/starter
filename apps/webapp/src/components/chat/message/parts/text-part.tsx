"use client";

import { parseOpenUIFences } from "@starter/genui";
import { cn } from "@starter/ui/lib/utils";

import { OpenUIBlock } from "../../openui/openui-block";
import { ChatMessageMarkdown } from "../chat-message-markdown";

export type TextPartProps = {
	isAssistant: boolean;
	isMessageStreaming?: boolean;
	isTextStreaming?: boolean;
	isUser: boolean;
	text: string;
};

export const TextPart = ({
	isAssistant,
	isMessageStreaming = false,
	isTextStreaming = false,
	isUser,
	text,
}: TextPartProps) => {
	const segments = isAssistant ? parseOpenUIFences(text) : null;

	return (
		<div
			className={cn(
				"group relative max-w-full rounded-2xl py-2 text-foreground",
				isUser ? "w-fit max-w-3/4 justify-end" : "w-full justify-start",
				isUser ? "bg-muted/50 px-4" : "bg-transparent"
			)}
		>
			<div className={cn("wrap-break-word", isAssistant && "pb-3")}>
				{segments ? (
					segments.map((segment, segmentIdx) =>
						segment.type === "openui" ? (
							<OpenUIBlock
								code={segment.content}
								complete={segment.complete}
								isStreaming={isMessageStreaming}
								key={`openui-${segmentIdx}`}
							/>
						) : (
							<ChatMessageMarkdown key={`markdown-${segmentIdx}`} streaming={isTextStreaming}>
								{segment.content}
							</ChatMessageMarkdown>
						)
					)
				) : (
					<ChatMessageMarkdown streaming={isTextStreaming}>{text}</ChatMessageMarkdown>
				)}
			</div>
		</div>
	);
};

TextPart.displayName = "TextPart";
