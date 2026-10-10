import { createFilesClient } from "files-sdk/client";

import type { UploadPurpose } from "@starter/documents";
import type { FilesUploadData } from "@starter/server/api";

type UploadFileOptions = {
	file: File;
	onProgress?: (percentage: number) => void;
	organizationId: string;
	purpose: UploadPurpose;
	signal?: AbortSignal;
};

export const uploadFile = async ({ file, onProgress, organizationId, purpose, signal }: UploadFileOptions) => {
	const files = createFilesClient<FilesUploadData>({
		endpoint: `/api/files?${new URLSearchParams({ name: file.name, organizationId, purpose })}`,
	});

	const { data } = await files.upload(file, {
		onProgress: ({ fraction }) => onProgress?.(fraction * 100),
		signal,
	});

	if (!data) {
		throw new Error("Upload was not registered");
	}

	return data;
};
