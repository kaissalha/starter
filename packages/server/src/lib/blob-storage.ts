import { Files, FilesError } from "files-sdk";
import { vercelBlob } from "files-sdk/vercel-blob";
import { v4 as uuidv4 } from "uuid";

import {
	getExtensionFromMediaType,
	MAX_INGEST_FILE_SIZE_BYTES,
	type MediaAccess,
	type UploadPurpose,
} from "@starter/documents";
import { log, serializeLogError } from "@starter/observability";

type BlobReference = { access: MediaAccess; key: string };

export type BlobUploadResult = {
	contentType: string;
	key: string;
	size: number;
};

export type GetBlobResult =
	| { etag: string; status: 304 }
	| { contentType: string; etag?: string; size: number; status: 200; stream: ReadableStream<Uint8Array> };

const getBlobTokenForAccess = (access: MediaAccess): string | undefined => {
	if (access === "public") {
		const publicToken = process.env.BLOB_PUBLIC_READ_WRITE_TOKEN ?? process.env.BLOB_READ_WRITE_TOKEN;

		if (!publicToken) {
			throw new Error(
				"BLOB_PUBLIC_READ_WRITE_TOKEN or BLOB_READ_WRITE_TOKEN is required for public blob operations."
			);
		}

		return publicToken;
	}

	const privateToken = process.env.BLOB_READ_WRITE_TOKEN;

	if (!privateToken) {
		throw new Error("BLOB_READ_WRITE_TOKEN is required for private blob operations.");
	}

	return privateToken;
};

const normalizeEntityTag = (value: string) => value.replace(/^W\//, "").replaceAll('"', "");

const filesClients: Partial<Record<MediaAccess, Files>> = {};

export const getFilesClient = (access: MediaAccess): Files => {
	const cached = filesClients[access];

	if (cached) {
		return cached;
	}

	const client = new Files({
		adapter: vercelBlob({
			access,
			token: getBlobTokenForAccess(access),
		}),
	});

	filesClients[access] = client;

	return client;
};

export const getStorageKeyPrefix = ({ organizationId, purpose }: { organizationId: string; purpose: UploadPurpose }) =>
	`${process.env.VERCEL_ENV ?? "development"}/${organizationId}/${purpose}/`;

export const uploadBufferToBlob = async ({
	access,
	buffer,
	mediaType,
	prefix,
}: {
	access: MediaAccess;
	buffer: Buffer;
	mediaType: string;
	prefix: string;
}): Promise<BlobUploadResult> => {
	const key = `${prefix}${uuidv4()}.${getExtensionFromMediaType({ mediaType })}`;

	try {
		const uploaded = await getFilesClient(access).upload(key, buffer, { contentType: mediaType });

		return { contentType: uploaded.contentType, key: uploaded.key, size: uploaded.size };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";

		log.error({
			access,
			error: serializeLogError(error),
			key,
			mediaType,
			message: "Failed to upload media to Blob",
		});

		throw new Error(`Failed to upload media to Blob: ${errorMessage}`, { cause: error });
	}
};

export const getPublicBlobUrl = (key: string) => getFilesClient("public").url(key);

export const getBlob = async ({
	access,
	ifNoneMatch,
	key,
}: BlobReference & { ifNoneMatch?: string }): Promise<GetBlobResult | null> => {
	try {
		const client = getFilesClient(access);
		const info = await client.head(key);

		if (ifNoneMatch && info.etag && normalizeEntityTag(ifNoneMatch) === normalizeEntityTag(info.etag)) {
			return { etag: info.etag, status: 304 };
		}

		const stored = await client.download(key, { as: "stream" });

		return {
			contentType: stored.contentType,
			etag: stored.etag,
			size: stored.size,
			status: 200,
			stream: stored.stream(),
		};
	} catch (error) {
		if (error instanceof FilesError && error.code === "NotFound") {
			return null;
		}

		throw error;
	}
};

export const downloadBlob = async ({ access, key }: BlobReference) => {
	const blob = await getBlob({ access, key });

	if (!blob || blob.status !== 200) {
		throw new Error("Blob not found");
	}

	if (blob.size > MAX_INGEST_FILE_SIZE_BYTES) {
		await blob.stream.cancel();
		throw new Error("File exceeds the ingestion byte limit");
	}

	const chunks: Array<Uint8Array> = [];
	const size = { bytes: 0 };

	for await (const chunk of blob.stream) {
		size.bytes += chunk.byteLength;

		if (size.bytes > MAX_INGEST_FILE_SIZE_BYTES) {
			throw new Error("File exceeds the ingestion byte limit");
		}

		chunks.push(chunk);
	}

	return {
		body: Buffer.concat(chunks, size.bytes),
	};
};

export const deleteBlob = async ({ access, key }: BlobReference) => {
	await getFilesClient(access).delete(key);
};
