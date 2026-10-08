"use client";

import { useCallback, useRef, useState } from "react";

import {
	type ChatAttachmentErrorCode,
	type ChatFileAttachment,
	isInlineModelAttachment,
} from "@/components/chat/chat-attachments";
import { useChatSession } from "@/components/chat/stores/chat-session-store";
import { useChatFileUpload } from "@/components/chat/use-chat-file-upload";
import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import type { DashboardChatUIMessage as BaseChatUIMessage } from "@starter/server";

export type ChatState = {
	addUploadedMedia: ReturnType<typeof useChatFileUpload>["addUploadedMedia"];
	attachmentError: ChatAttachmentErrorCode | null;
	attachments: Array<ChatFileAttachment>;
	canSubmit: boolean;
	clearAttachmentError: () => void;
	handleFilesAdded: (files: Array<File>) => Promise<void>;
	handleFilesRejected: (error: ChatAttachmentErrorCode) => void;
	handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
	handleSubmit: (e?: React.FormEvent) => Promise<void>;
	input: string;
	isLoading: boolean;
	isReadingAttachments: boolean;
	removeAttachment: (id: string) => void;
	stop?: () => void;
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
};

export const useChatState = (): ChatState => {
	const { can } = useOrganizationPermissions();
	const [input, setInput] = useState("");
	const [isPreparingMessage, setIsPreparingMessage] = useState(false);

	const {
		addUploadedMedia,
		attachmentError,
		attachments,
		clearAttachmentError,
		clearAttachments,
		handleFilesAdded,
		handleFilesRejected,
		hasFailedAttachments,
		isReadingAttachments,
		removeAttachment,
		waitForAttachmentUploads,
	} = useChatFileUpload({ uploadToKnowledgeBase: true });

	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const { sendMessage, status, stop } = useChatSession((state) => ({
		sendMessage: state.actions?.sendMessage,
		status: state.status,
		stop: state.actions?.stop,
	}));

	const handleSubmit = useCallback(
		async (e?: React.FormEvent) => {
			e?.preventDefault();

			const messageAttachments = attachments.filter((attachment) => attachment.uploadStatus !== "error");

			if (
				!can("workspace.write") ||
				(!input.trim() && messageAttachments.length === 0) ||
				!sendMessage ||
				isReadingAttachments ||
				isPreparingMessage
			) {
				return;
			}

			const messageText = input;
			setInput("");
			setIsPreparingMessage(true);
			requestAnimationFrame(() => {
				textareaRef.current?.focus();
			});

			try {
				const submittedAttachments = await waitForAttachmentUploads({
					attachments: messageAttachments,
				});

				const parts: BaseChatUIMessage["parts"] = [
					...submittedAttachments.flatMap((attachment) =>
						attachment.fileId
							? [
									{
										data: {
											fileId: attachment.fileId,
											filename: attachment.filename,
											mediaType: attachment.mediaType,
										},
										type: "data-attachment" as const,
									},
								]
							: []
					),
					...submittedAttachments.flatMap((attachment) =>
						isInlineModelAttachment({ mediaType: attachment.mediaType })
							? [
									{
										filename: attachment.filename,
										mediaType: attachment.mediaType,
										type: "file" as const,
										url: attachment.url,
									},
								]
							: []
					),
					...(messageText.trim() ? [{ text: messageText, type: "text" as const }] : []),
				];

				await sendMessage({
					parts,
					role: "user",
				});

				clearAttachments({ abort: false });
			} catch {
				setInput((current) => (current.trim() ? current : messageText));
			} finally {
				setIsPreparingMessage(false);
			}
		},
		[
			can,
			attachments,
			clearAttachments,
			input,
			isPreparingMessage,
			isReadingAttachments,
			sendMessage,
			waitForAttachmentUploads,
		]
	);

	const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInput(e.target.value);
	}, []);

	const handleRemoveAttachment = useCallback(
		(id: string) => {
			if (!isPreparingMessage) {
				removeAttachment(id);
			}
		},
		[isPreparingMessage, removeAttachment]
	);

	return {
		addUploadedMedia,
		attachmentError,
		attachments,
		canSubmit:
			can("workspace.write") &&
			!isReadingAttachments &&
			!isPreparingMessage &&
			!hasFailedAttachments &&
			(Boolean(input.trim()) || attachments.some((attachment) => attachment.uploadStatus !== "error")),
		clearAttachmentError,
		handleFilesAdded,
		handleFilesRejected,
		handleInputChange,
		handleSubmit,
		input,
		isLoading: status === "streaming" || status === "submitted",
		isReadingAttachments: isReadingAttachments || isPreparingMessage,
		removeAttachment: handleRemoveAttachment,
		stop,
		textareaRef,
	};
};
