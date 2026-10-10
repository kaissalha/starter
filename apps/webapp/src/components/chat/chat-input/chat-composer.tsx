"use client";

import type React from "react";
import { useRef } from "react";

import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { CHAT_ATTACHMENT_MAX_FILES, CHAT_ATTACHMENT_MAX_SIZE_BYTES } from "@/components/chat/chat-attachments";
import {
	ChatAskUserQuestionsPanel,
	usePendingAskUserQuestions,
} from "@/components/chat/chat-input/chat-ask-user-questions-panel";
import { ChatAttachmentTile } from "@/components/chat/chat-input/chat-attachment-tile";
import {
	ChatInput,
	ChatInputAttachments,
	ChatInputBody,
	ChatInputControls,
	ChatInputSubmit,
	ChatInputTextArea,
} from "@/components/chat/chat-input/chat-input";
import { useChatDropHandlers } from "@/components/chat/use-chat-drop-handlers";
import { useChatState } from "@/components/chat/use-chat-state";
import { MediaPicker } from "@/components/media/media-picker";
import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Skeleton } from "@starter/ui/components/skeleton";
import { cn } from "@starter/ui/lib/utils";

const ATTACHMENT_ERROR_MESSAGE_KEYS = {
	"read-failed": "fileReadFailed",
	"too-large": "fileTooLarge",
	"too-many": "tooManyFiles",
	"unsupported-type": "unsupportedFileType",
	"upload-failed": "fileUploadFailed",
} as const;

const ATTACHMENT_MAX_SIZE_LABEL =
	CHAT_ATTACHMENT_MAX_SIZE_BYTES < 1024 * 1024
		? `${Math.max(1, Math.round(CHAT_ATTACHMENT_MAX_SIZE_BYTES / 1024))} KB`
		: `${Math.round(CHAT_ATTACHMENT_MAX_SIZE_BYTES / (1024 * 1024))} MB`;

type ChatComposerProps = {
	accept?: string;
	className?: string;
	containerClassName?: string;
	isDisabled?: boolean;
	media?: boolean;
	placeholder?: string;
};

export const ChatComposer = ({
	accept,
	className,
	containerClassName,
	isDisabled = false,
	media = false,
	placeholder,
}: ChatComposerProps) => {
	const {
		addUploadedMedia,
		attachmentError,
		attachments,
		canSubmit,
		handleFilesAdded: onFilesAdded,
		handleFilesRejected: onAttachmentError,
		handleInputChange: onInputChange,
		handleSubmit: onSubmit,
		input,
		isLoading,
		isReadingAttachments,
		removeAttachment: onRemoveAttachment,
		stop: onStop,
		textareaRef,
	} = useChatState();

	const { can, isLoading: permissionsLoading, role } = useOrganizationPermissions();
	const tPermissions = useTranslations("permissions");
	const tChats = useTranslations("chats");
	const inputT = useTranslations("components.chat.input");
	const plusMenuT = useTranslations("components.chat.chatInput.plusMenu");
	const fileInputRef = useRef<HTMLInputElement>(null);
	const pendingQuestions = usePendingAskUserQuestions();

	const attachmentSlotsRemaining = Math.max(CHAT_ATTACHMENT_MAX_FILES - attachments.length, 0);

	const isAttachDisabled =
		!can("workspace.write") || isLoading || isReadingAttachments || isDisabled || attachmentSlotsRemaining === 0;

	const handleFiles = (files: Array<File>) => {
		const tooLarge = files.filter((file) => file.size > CHAT_ATTACHMENT_MAX_SIZE_BYTES);

		if (tooLarge.length > 0 && tooLarge.length === files.length) {
			onAttachmentError("too-large");

			return;
		}

		onFilesAdded(files);
	};

	const { handleDragEnter, handleDragLeave, handleDragOver, handleDrop, isDraggingOver } = useChatDropHandlers({
		disabled: isAttachDisabled,
		onFiles: handleFiles,
	});

	const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files ? Array.from(event.target.files) : [];
		event.target.value = "";

		if (files.length > 0) {
			handleFiles(files);
		}
	};

	if (permissionsLoading) {
		return (
			<div className={containerClassName}>
				<div className={cn("relative z-10 mx-auto w-full max-w-3xl", className)}>
					<Skeleton className='h-28 w-full' corners='rounded' />
				</div>
			</div>
		);
	}

	if (role === "member") {
		return <p className='px-4 py-3 text-sm text-muted-foreground'>{tPermissions("readOnly")}</p>;
	}

	if (!can("workspace.write")) {
		return null;
	}

	return (
		<div
			className={cn(
				containerClassName,
				"transition-[min-height] duration-200 ease-out-quint motion-reduce:transition-none"
			)}
			onDragEnter={handleDragEnter}
			onDragLeave={handleDragLeave}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
		>
			{!pendingQuestions && (
				<Input
					accept={accept}
					aria-hidden
					aria-label={inputT("chooseFiles")}
					className='hidden'
					multiple
					onChange={handleFileInputChange}
					ref={fileInputRef}
					tabIndex={-1}
					type='file'
					unstyled
				/>
			)}
			<div className={cn("relative z-10 mx-auto w-full max-w-3xl", className)}>
				<div
					aria-hidden
					className={cn(
						"pointer-events-none absolute inset-0 z-20 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 opacity-0 transition-opacity duration-150 ease-out-quint",
						isDraggingOver && "opacity-100"
					)}
				/>
				<div
					className='animate-fade-in-only motion-reduce:animate-none'
					key={pendingQuestions ? pendingQuestions.toolCallId : "composer"}
				>
					{pendingQuestions ? (
						<ChatAskUserQuestionsPanel
							questions={pendingQuestions.questions}
							toolCallId={pendingQuestions.toolCallId}
						/>
					) : (
						<ChatInput
							canSubmit={canSubmit}
							disabled={isDisabled || isReadingAttachments}
							loading={isLoading}
							onChange={onInputChange}
							onMessageSubmit={onSubmit}
							onStop={onStop}
							textareaRef={textareaRef}
							value={input}
						>
							{attachments.length > 0 && (
								<ChatInputAttachments>
									{attachments.map((attachment) => (
										<div
											className='shrink-0 transition-[scale,opacity] duration-200 ease-out-quint starting:scale-97 starting:opacity-0'
											key={attachment.id}
										>
											<ChatAttachmentTile
												attachment={attachment}
												disabled={isReadingAttachments}
												onRemove={(id) => onRemoveAttachment(id)}
											/>
										</div>
									))}
								</ChatInputAttachments>
							)}
							{attachmentError && (
								<p className='px-4 pb-1 text-destructive text-xs'>
									{inputT(ATTACHMENT_ERROR_MESSAGE_KEYS[attachmentError], {
										count: CHAT_ATTACHMENT_MAX_FILES,
										size: ATTACHMENT_MAX_SIZE_LABEL,
									})}
								</p>
							)}
							<ChatInputBody>
								<ChatInputTextArea autoFocus placeholder={placeholder ?? tChats("placeholder")} />
								<ChatInputControls>
									<div className='flex items-center gap-1'>
										<Button
											aria-label={plusMenuT("addFiles")}
											disabled={isAttachDisabled}
											onClick={() => fileInputRef.current?.click()}
											size='icon-sm'
											type='button'
											variant='ghost'
										>
											<HugeiconsIcon
												aria-hidden
												className='scale-110'
												icon={Add01Icon}
												strokeWidth={1.75}
											/>
										</Button>
										{media && (
											<MediaPicker disabled={isAttachDisabled} onSelect={addUploadedMedia} />
										)}
									</div>
									<ChatInputSubmit />
								</ChatInputControls>
							</ChatInputBody>
						</ChatInput>
					)}
				</div>
			</div>
		</div>
	);
};
