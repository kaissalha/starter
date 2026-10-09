"use client";

import { type ReactNode } from "react";

import { isToolUIPart } from "ai";

import type { DashboardChatUIMessage as BaseChatUIMessage } from "@starter/server";

import { ChatSteps } from "./chat-steps";
import { getVisibleMessageParts } from "./get-visible-message-parts";
import { ErrorPart } from "./parts/error-part";
import { FilePart } from "./parts/file-part";
import { SourcePart } from "./parts/source-part";
import { TextPart } from "./parts/text-part";
import { ToolPart } from "./parts/tool-part";
import { ThinkingStep, ThinkingSteps } from "./thinking-step";

export type ChatMessagePart = BaseChatUIMessage["parts"][number];

export type ChatMessagePartType = ChatMessagePart["type"];

type ChatMessagePartsProps = {
	isStreaming: boolean;
	isUser: boolean;
	messageId: string;
	parts: BaseChatUIMessage["parts"];
	showThinking?: boolean;
};

const renderMessagePart = ({
	isLast = false,
	isStreamingMessage,
	isStreamingText,
	isUser,
	messageId,
	part,
	partIdx,
}: {
	isLast?: boolean;
	isStreamingMessage: boolean;
	isStreamingText: boolean;
	isUser: boolean;
	messageId: string;
	part: ChatMessagePart;
	partIdx: number;
}) => {
	const key = `message-${messageId}-${part.type}-${partIdx}`;

	if (part.type === "text") {
		return (
			<TextPart
				isAssistant={!isUser}
				isMessageStreaming={isStreamingMessage}
				isTextStreaming={isStreamingText}
				isUser={isUser}
				key={key}
				text={part.text}
			/>
		);
	}

	if (part.type === "source-url") {
		return <SourcePart key={key} title={part.title} url={part.url} />;
	}

	if (part.type === "file") {
		return <FilePart filename={part.filename} key={key} mediaType={part.mediaType} url={part.url} />;
	}

	if (part.type === "data-attachment") {
		return <FilePart filename={part.data.filename} key={key} mediaType={part.data.mediaType} url='' />;
	}

	if (isToolUIPart(part)) {
		return (
			<ToolPart
				approval={part.approval}
				errorText={part.errorText}
				input={part.input}
				isLast={isLast}
				key={key}
				output={part.output}
				state={part.state}
				toolCallId={part.toolCallId}
				toolName={part.type === "dynamic-tool" ? part.toolName : part.type.slice("tool-".length)}
			/>
		);
	}

	if (part.type === "data-error") {
		return <ErrorPart key={key} message={part.data.message} />;
	}

	return null;
};

const isStepPart = (part: ChatMessagePart) => part.type.startsWith("tool-") && part.type !== "tool-askUserQuestions";

type StepBufferItem = { part: ChatMessagePart; partIdx: number };

const renderStepGroup = ({
	isStreamingMessage,
	isUser,
	messageId,
	showThinking = false,
	stepBuffer,
}: {
	isStreamingMessage: boolean;
	isUser: boolean;
	messageId: string;
	showThinking?: boolean;
	stepBuffer: Array<StepBufferItem>;
}) => {
	const lastStepIndex = stepBuffer.length - 1;

	return (
		<ChatSteps key={`message-${messageId}-steps-${stepBuffer[0].partIdx}`}>
			{stepBuffer.map(({ part, partIdx }, stepIndex) =>
				renderMessagePart({
					isLast: !showThinking && stepIndex === lastStepIndex,
					isStreamingMessage,
					isStreamingText: false,
					isUser,
					messageId,
					part,
					partIdx,
				})
			)}
			{showThinking ? <ThinkingStep /> : null}
		</ChatSteps>
	);
};

const buildMessagePartElements = ({
	isStreamingMessage,
	isUser,
	lastTextPartIndex,
	messageId,
	parts,
}: {
	isStreamingMessage: boolean;
	isUser: boolean;
	lastTextPartIndex: number;
	messageId: string;
	parts: BaseChatUIMessage["parts"];
}) => {
	return parts.reduce<{ elements: Array<ReactNode>; stepBuffer: Array<StepBufferItem> }>(
		(acc, part, partIdx) => {
			if (part.type === "step-start" || (part.type === "text" && part.text.trim() === "")) {
				return acc;
			}

			if (isStepPart(part)) {
				return {
					...acc,
					stepBuffer: [...acc.stepBuffer, { part, partIdx }],
				};
			}

			const flushedElements =
				acc.stepBuffer.length > 0
					? [
							...acc.elements,
							renderStepGroup({
								isStreamingMessage,
								isUser,
								messageId,
								stepBuffer: acc.stepBuffer,
							}),
						]
					: acc.elements;

			return {
				elements: [
					...flushedElements,
					renderMessagePart({
						isStreamingMessage,
						isStreamingText: isStreamingMessage && partIdx === lastTextPartIndex,
						isUser,
						messageId,
						part,
						partIdx,
					}),
				],
				stepBuffer: [],
			};
		},
		{ elements: [], stepBuffer: [] }
	);
};

export const ChatMessageParts = ({
	isStreaming,
	isUser,
	messageId,
	parts,
	showThinking = false,
}: ChatMessagePartsProps) => {
	const isStreamingMessage = isStreaming && !isUser;

	const renderedFileAttachments = new Set(
		parts.flatMap((part) => (part.type === "file" ? [`${part.mediaType}\u0000${part.filename ?? ""}`] : []))
	);

	const visibleParts = getVisibleMessageParts({ isUser, parts }).filter(
		(part) =>
			part.type !== "data-attachment" ||
			!renderedFileAttachments.has(`${part.data.mediaType}\u0000${part.data.filename}`)
	);

	const lastTextPartIndex = visibleParts.findLastIndex((part) => part.type === "text");

	const { elements: renderedElements, stepBuffer } = buildMessagePartElements({
		isStreamingMessage,
		isUser,
		lastTextPartIndex,
		messageId,
		parts: visibleParts,
	});

	if (stepBuffer.length > 0) {
		return [
			...renderedElements,
			renderStepGroup({
				isStreamingMessage,
				isUser,
				messageId,
				showThinking,
				stepBuffer,
			}),
		];
	}

	if (showThinking) {
		return [...renderedElements, <ThinkingSteps key={`message-${messageId}-thinking`} />];
	}

	return renderedElements;
};
