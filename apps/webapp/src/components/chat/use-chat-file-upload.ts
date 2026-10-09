"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { z } from "zod";

import { useAuthSession } from "@/components/auth/auth-session-context";
import {
	CHAT_ATTACHMENT_MAX_FILES,
	CHAT_ATTACHMENT_MAX_SIZE_BYTES,
	type ChatAttachmentErrorCode,
	type ChatFileAttachment,
	isInlineModelAttachment,
} from "@/components/chat/chat-attachments";
import type { UploadedMedia } from "@/components/media/use-media-upload";
import { client } from "@/lib/api-client";
import { uploadFile } from "@/lib/storage";
import { isKnowledgeFile } from "@starter/documents";

type MutableReference<Value> = { value: Value };

const stringSchema = z.compile(z.string());

const STATUS_POLL_INTERVAL_MS = 1500;

const STATUS_POLL_TIMEOUT_MS = 5 * 60 * 1000;

type AttachmentUploadMode = "inline" | "knowledge" | "inline-and-knowledge" | "unsupported";

type ClearAttachmentsOptions = {
	abort?: boolean;
};

const createAttachmentFromFile = async ({
	file,
	uploadStatus,
}: {
	file: File;
	uploadStatus?: ChatFileAttachment["uploadStatus"];
}): Promise<ChatFileAttachment> => ({
	filename: file.name,
	id: crypto.randomUUID(),
	mediaType: file.type || "application/octet-stream",
	size: file.size,
	uploadStatus,
	url: await new Promise<string>((resolve, reject) => {
		const reader = new FileReader();

		reader.onerror = () => {
			reject(new Error("Failed to read file"));
		};

		reader.onload = () => {
			const result = stringSchema.safeParse(reader.result);

			if (result.success) {
				resolve(result.data);

				return;
			}

			reject(new Error("Failed to read file"));
		};

		reader.readAsDataURL(file);
	}),
});

const getAttachmentUploadMode = ({
	file,
	uploadToKnowledgeBase,
}: {
	file: File;
	uploadToKnowledgeBase: boolean;
}): AttachmentUploadMode => {
	if (!uploadToKnowledgeBase) {
		return "inline";
	}

	const mediaType = file.type || "application/octet-stream";
	const canUseInline = isInlineModelAttachment({ mediaType });
	const canUseKnowledgeBase = isKnowledgeFile({ filename: file.name, mediaType });

	if (canUseInline && canUseKnowledgeBase) {
		return "inline-and-knowledge";
	}

	if (canUseKnowledgeBase) {
		return "knowledge";
	}

	if (canUseInline) {
		return "inline";
	}

	return "unsupported";
};

const pollKnowledgeBaseStatus = async ({
	fileId,
	signal,
}: {
	fileId: string;
	signal?: AbortSignal;
}): Promise<"ready" | "failed"> => {
	const start = Date.now();

	while (Date.now() - start < STATUS_POLL_TIMEOUT_MS) {
		if (signal?.aborted) {
			throw new Error("Upload cancelled");
		}

		const document = await client.documents.get({ documentId: fileId }, { signal });

		if (document) {
			if (document.ragStatus === "ready" || document.ragStatus === "none") {
				return "ready";
			}

			if (document.ragStatus === "failed") {
				throw new Error(document.processingError ?? "Indexing failed");
			}
		}

		await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_INTERVAL_MS));
	}

	throw new Error("Indexing timed out");
};

const startKnowledgeBaseUploadTask = ({
	abortControllers,
	attachment,
	documentUploadPromises,
	file,
	organizationId,
	setAttachmentError,
	updateAttachment,
}: {
	abortControllers: Map<string, AbortController>;
	attachment: ChatFileAttachment;
	documentUploadPromises: Map<string, Promise<string>>;
	file: File;
	organizationId: string;
	setAttachmentError: React.Dispatch<React.SetStateAction<ChatAttachmentErrorCode | null>>;
	updateAttachment: (id: string, patch: Partial<ChatFileAttachment>) => void;
}) => {
	const controller = new AbortController();
	abortControllers.set(attachment.id, controller);

	const fileIdPromise = (async () => {
		const uploaded = await uploadFile({ file, organizationId, purpose: "knowledge", signal: controller.signal });

		updateAttachment(attachment.id, {
			fileId: uploaded.id,
			uploadStatus: "processing",
		});

		return uploaded.id;
	})();

	documentUploadPromises.set(attachment.id, fileIdPromise);

	(async () => {
		try {
			const fileId = await fileIdPromise;
			const finalStatus = await pollKnowledgeBaseStatus({ fileId, signal: controller.signal });

			updateAttachment(attachment.id, {
				uploadStatus: finalStatus === "ready" ? "uploaded" : "error",
			});
		} catch (error) {
			if (error instanceof Error && (error.name === "AbortError" || error.message === "Upload cancelled")) {
				return;
			}

			setAttachmentError("upload-failed");
			updateAttachment(attachment.id, { uploadStatus: "error" });
		} finally {
			abortControllers.delete(attachment.id);
			documentUploadPromises.delete(attachment.id);
		}
	})();
};

const uploadedMediaAttachment = (media: UploadedMedia): ChatFileAttachment => ({
	fileId: media.id,
	filename: media.name,
	id: crypto.randomUUID(),
	mediaType: media.contentType,
	size: media.sizeBytes ?? 0,
	uploadStatus: "uploaded",
	url: media.url,
});

export const useChatFileUpload = ({ uploadToKnowledgeBase = false }: { uploadToKnowledgeBase?: boolean } = {}) => {
	const { data: session } = useAuthSession();
	const organizationId = session?.session.activeOrganizationId;
	const [attachments, setAttachments] = useState<Array<ChatFileAttachment>>([]);
	const [attachmentError, setAttachmentError] = useState<ChatAttachmentErrorCode | null>(null);
	const [isReadingAttachments, setIsReadingAttachments] = useState(false);

	const attachmentsRef = useRef<Array<ChatFileAttachment>>([]);
	const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
	const documentUploadPromisesRef = useRef<Map<string, Promise<string>>>(new Map());

	useEffect(
		() => () => {
			for (const controller of abortControllersRef.current.values()) {
				controller.abort();
			}

			abortControllersRef.current.clear();
			documentUploadPromisesRef.current.clear();
		},
		[]
	);

	const addUploadedMedia = (media: UploadedMedia) => {
		if (attachmentsRef.current.length >= CHAT_ATTACHMENT_MAX_FILES) {
			setAttachmentError("too-many");

			return;
		}

		const next = [...attachmentsRef.current, uploadedMediaAttachment(media)];
		attachmentsRef.current = next;
		setAttachments(next);
	};

	const updateAttachment = useCallback((id: string, patch: Partial<ChatFileAttachment>) => {
		const nextAttachments = attachmentsRef.current.map((attachment) =>
			attachment.id === id ? { ...attachment, ...patch } : attachment
		);

		attachmentsRef.current = nextAttachments;
		setAttachments(nextAttachments);
	}, []);

	const startKnowledgeBaseUpload = useCallback(
		({ attachment, file }: { attachment: ChatFileAttachment; file: File }) => {
			if (!organizationId) {
				setAttachmentError("upload-failed");
				updateAttachment(attachment.id, { uploadStatus: "error" });

				return;
			}

			startKnowledgeBaseUploadTask({
				abortControllers: abortControllersRef.current,
				attachment,
				documentUploadPromises: documentUploadPromisesRef.current,
				file,
				organizationId,
				setAttachmentError,
				updateAttachment,
			});
		},
		[organizationId, updateAttachment]
	);

	const handleFilesAdded = useCallback(
		async (files: Array<File>) => {
			if (files.length === 0) {
				return;
			}

			const remainingSlots = CHAT_ATTACHMENT_MAX_FILES - attachments.length;

			if (remainingSlots <= 0) {
				setAttachmentError("too-many");

				return;
			}

			const filesWithinLimit = files.slice(0, remainingSlots);

			const { acceptedFiles, hasUnsupportedFile } = filesWithinLimit.reduce<{
				acceptedFiles: Array<{ file: File; mode: AttachmentUploadMode }>;
				hasUnsupportedFile: boolean;
			}>(
				(result, file) => {
					const mode = getAttachmentUploadMode({ file, uploadToKnowledgeBase });

					if (mode === "unsupported") {
						result.hasUnsupportedFile = true;
					} else if (file.size <= CHAT_ATTACHMENT_MAX_SIZE_BYTES) {
						result.acceptedFiles.push({ file, mode });
					}

					return result;
				},
				{ acceptedFiles: [], hasUnsupportedFile: false }
			);

			if (acceptedFiles.length < filesWithinLimit.length || filesWithinLimit.length < files.length) {
				const attachmentErrorReference: MutableReference<
					"too-large" | "unsupported-type" | "too-many" | undefined
				> = {
					value: undefined,
				};

				if (files.some((file) => file.size > CHAT_ATTACHMENT_MAX_SIZE_BYTES)) {
					attachmentErrorReference.value = "too-large";
				} else if (hasUnsupportedFile) {
					attachmentErrorReference.value = "unsupported-type";
				} else {
					attachmentErrorReference.value = "too-many";
				}

				setAttachmentError(attachmentErrorReference.value);
			} else {
				setAttachmentError(null);
			}

			if (acceptedFiles.length === 0) {
				return;
			}

			setIsReadingAttachments(true);

			const nextAttachments = await (async () => {
				try {
					return await Promise.all(
						acceptedFiles.map(({ file, mode }) =>
							createAttachmentFromFile({
								file,
								uploadStatus:
									mode === "knowledge" || mode === "inline-and-knowledge" ? "uploading" : undefined,
							})
						)
					);
				} catch {
					setAttachmentError("read-failed");

					return null;
				}
			})();

			setIsReadingAttachments(false);

			if (!nextAttachments) {
				return;
			}

			const updatedAttachments = [...attachmentsRef.current, ...nextAttachments].slice(
				0,
				CHAT_ATTACHMENT_MAX_FILES
			);

			attachmentsRef.current = updatedAttachments;
			setAttachments(updatedAttachments);

			nextAttachments.forEach((attachment, index) => {
				const preparedFile = acceptedFiles[index];

				if (
					!preparedFile ||
					(preparedFile.mode !== "knowledge" && preparedFile.mode !== "inline-and-knowledge")
				) {
					return;
				}

				startKnowledgeBaseUpload({ attachment, file: preparedFile.file });
			});
		},
		[attachments.length, startKnowledgeBaseUpload, uploadToKnowledgeBase]
	);

	const removeAttachment = useCallback((id: string) => {
		const controller = abortControllersRef.current.get(id);
		controller?.abort();
		abortControllersRef.current.delete(id);
		documentUploadPromisesRef.current.delete(id);
		const nextAttachments = attachmentsRef.current.filter((attachment) => attachment.id !== id);
		attachmentsRef.current = nextAttachments;
		setAttachments(nextAttachments);
		setAttachmentError(null);
	}, []);

	const clearAttachments = useCallback((options: ClearAttachmentsOptions = {}) => {
		if (options.abort ?? true) {
			for (const controller of abortControllersRef.current.values()) {
				controller.abort();
			}

			abortControllersRef.current.clear();
			documentUploadPromisesRef.current.clear();
		}

		attachmentsRef.current = [];
		setAttachments([]);
		setAttachmentError(null);
	}, []);

	const waitForAttachmentUploads = useCallback(
		async ({ attachments: attachmentsToWait }: { attachments: Array<ChatFileAttachment> }) => {
			return Promise.all(
				attachmentsToWait.map(async (attachment) => {
					if (!attachment.uploadStatus || attachment.fileId) {
						return attachment;
					}

					if (attachment.uploadStatus === "error") {
						throw new Error("Attachment upload failed");
					}

					const fileIdPromise = documentUploadPromisesRef.current.get(attachment.id);

					if (!fileIdPromise) {
						const currentAttachment = attachmentsRef.current.find((item) => item.id === attachment.id);

						if (currentAttachment?.fileId) {
							return currentAttachment;
						}

						throw new Error("Attachment upload is not available");
					}

					const fileId = await fileIdPromise;

					return {
						...attachment,
						fileId,
						uploadStatus: "processing" as const,
					};
				})
			);
		},
		[]
	);

	const clearAttachmentError = useCallback(() => {
		setAttachmentError(null);
	}, []);

	const handleFilesRejected = useCallback((error: ChatAttachmentErrorCode) => {
		setAttachmentError(error);
	}, []);

	return {
		addUploadedMedia,
		attachmentError,
		attachments,
		clearAttachmentError,
		clearAttachments,
		handleFilesAdded,
		handleFilesRejected,
		hasFailedAttachments: attachments.some((attachment) => attachment.uploadStatus === "error"),
		hasPendingAttachments: attachments.some(
			(attachment) => attachment.uploadStatus === "uploading" || attachment.uploadStatus === "processing"
		),
		isReadingAttachments,
		removeAttachment,
		waitForAttachmentUploads,
	};
};
