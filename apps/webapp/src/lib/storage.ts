import { createFilesClient } from "files-sdk/client";

import { client } from "@/lib/api-client";
import type { UploadPurpose } from "@starter/documents";

type UploadFileOptions = {
	file: File;
	onProgress?: (percentage: number) => void;
	organizationId: string;
	purpose: UploadPurpose;
	signal?: AbortSignal;
};

export const uploadFile = async ({ file, onProgress, organizationId, purpose, signal }: UploadFileOptions) => {
	const files = createFilesClient({ endpoint: `/api/files?${new URLSearchParams({ organizationId, purpose })}` });
	const { key } = await files.upload(file, { onProgress: ({ fraction }) => onProgress?.(fraction * 100), signal });

	return client.media.register({ key, name: file.name, purpose }, { signal });
};
