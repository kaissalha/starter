import { MAX_INGEST_FILE_SIZE_BYTES } from "@starter/documents";

export const CHAT_ATTACHMENT_MAX_FILES = 6;

export const CHAT_ATTACHMENT_MAX_SIZE_BYTES = MAX_INGEST_FILE_SIZE_BYTES;

export type ChatFileAttachment = {
	fileId?: string;
	filename: string;
	id: string;
	mediaType: string;
	size: number;
	uploadStatus?: "uploading" | "processing" | "uploaded" | "error";
	url: string;
};

export type ChatAttachmentErrorCode = "read-failed" | "too-large" | "too-many" | "unsupported-type" | "upload-failed";

export const isInlineModelAttachment = ({ mediaType }: { mediaType: string }) => {
	return mediaType.startsWith("image/");
};
