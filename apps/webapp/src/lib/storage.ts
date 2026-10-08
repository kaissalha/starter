import type { PutBlobResult } from "@vercel/blob";
import { upload } from "@vercel/blob/client";

import type { ClientUploadPayload } from "@starter/documents";

type UploadFromClientOptions = {
	file: File;
	handleUploadUrl: string;
	onUploadProgress?: (event: { percentage: number }) => void;
	pathname: string;
	payload: ClientUploadPayload;
	signal?: AbortSignal;
};

export const uploadFromClient = async ({
	file,
	handleUploadUrl,
	onUploadProgress,
	pathname,
	payload,
	signal,
}: UploadFromClientOptions): Promise<PutBlobResult> =>
	upload(pathname, file, {
		abortSignal: signal,
		access: payload.access,
		clientPayload: JSON.stringify(payload),
		handleUploadUrl,
		multipart: file.size > 5 * 1024 * 1024,
		onUploadProgress,
	});
