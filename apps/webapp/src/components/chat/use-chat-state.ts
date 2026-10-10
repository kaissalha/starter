"use client";

import { useCallback, useRef, useState } from "react";

import { isInlineModelAttachment } from "@/components/chat/chat-attachments";
import { useChatSession } from "@/components/chat/chat-session";
import { useChatFileUpload } from "@/components/chat/use-chat-file-upload";
import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import type { DashboardChatUIMessage as BaseChatUIMessage } from "@starter/server";

export const useChatState = () => {
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
	} = useChatFileUpload();

	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const {
		actions: { sendMessage, stop },
		isLoading,
	} = useChatSession();

	const handleSubmit = useCallback(
		async (e?: React.FormEvent) => {
			e?.preventDefault();

			const messageAttachments = attachments.filter((attachment) => attachment.uploadStatus !== "error");

			if (
				!can("workspace.write") ||
				(!input.trim() && messageAttachments.length === 0) ||
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

				clearAttachments();
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
		isLoading,
		isReadingAttachments: isReadingAttachments || isPreparingMessage,
		removeAttachment: handleRemoveAttachment,
		stop,
		textareaRef,
	};
};
