import { get as getVercelBlob } from "@vercel/blob";
import { handleUpload, type HandleUploadBody, type HandleUploadOptions } from "@vercel/blob/client";
import { Files } from "files-sdk";
import { vercelBlob } from "files-sdk/vercel-blob";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import {
	getExtensionFromMediaType,
	MAX_INGEST_FILE_SIZE_BYTES,
	type MediaAccess,
	mediaAccessValues,
} from "@starter/documents";
import { log, serializeLogError } from "@starter/observability";

import { parseJsonRecord } from "../utils/json";

const blobAccessPayloadSchema = z.compile(
	z.object({
		access: z.enum(mediaAccessValues).default("public"),
	})
);

type PutBase64Options = {
	access?: MediaAccess;
	prefix?: string;
};

type HandleClientUploadOptions = {
	body: HandleUploadBody;
	onBeforeGenerateToken: HandleUploadOptions["onBeforeGenerateToken"];
	onUploadCompleted?: HandleUploadOptions["onUploadCompleted"];
	request: Request;
};

type GetBlobOptions = {
	access: MediaAccess;
	ifNoneMatch?: string;
	pathname: string;
};

export type BlobUploadResult = {
	contentType: string;
	key: string;
	size: number;
	url: string | null;
};

export type GetBlobResult =
	| { etag: string; status: 304 }
	| { contentType: string; etag?: string; size: number; status: 200; stream: ReadableStream<Uint8Array> };

const readAccessFromHandleUploadBody = (body: HandleUploadBody): MediaAccess => {
	if (body.type === "blob.generate-client-token") {
		const payload = parseJsonRecord(body.payload.clientPayload);
		const access = blobAccessPayloadSchema.safeParse(payload);

		return access.success ? access.data.access : "public";
	}

	const payload = parseJsonRecord(body.payload.tokenPayload);
	const access = blobAccessPayloadSchema.safeParse(payload);

	return access.success ? access.data.access : "public";
};

const getPathKey = (value: string) => {
	try {
		return decodeURIComponent(new URL(value).pathname).replace(/^\/+/, "");
	} catch {
		return value.replace(/^\/+/, "");
	}
};

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

const filesClients: Partial<Record<MediaAccess, Files>> = {};

const getFilesClient = (access: MediaAccess): Files => {
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

export const uploadBufferToBlob = async (
	buffer: Buffer,
	mediaType: string,
	options: PutBase64Options = {}
): Promise<BlobUploadResult> => {
	const access = options.access ?? "public";
	const ext = getExtensionFromMediaType({ mediaType });
	const key = `${process.env.VERCEL_ENV ?? "development"}/${options.prefix ?? ""}${uuidv4()}.${ext}`;

	try {
		const files = getFilesClient(access);
		const uploaded = await files.upload(key, buffer, { contentType: mediaType });

		return {
			contentType: uploaded.contentType,

			key: uploaded.key,
			size: uploaded.size,
			url: access === "public" ? await files.url(uploaded.key) : null,
		};
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

export const uploadBase64ToBlob = (
	base64Data: string,
	mediaType: string,
	options: PutBase64Options = {}
): Promise<BlobUploadResult> => uploadBufferToBlob(Buffer.from(base64Data, "base64"), mediaType, options);

export const handleClientUpload = async ({
	body,
	onBeforeGenerateToken,
	onUploadCompleted,
	request,
}: HandleClientUploadOptions) => {
	const access = readAccessFromHandleUploadBody(body);

	return handleUpload({
		body,
		onBeforeGenerateToken,
		onUploadCompleted,
		request,
		token: getBlobTokenForAccess(access),
	});
};

export const getBlob = async ({ access, ifNoneMatch, pathname }: GetBlobOptions): Promise<GetBlobResult | null> => {
	const key = pathname.replace(/^\/+/, "");

	if (!key) {
		return null;
	}

	const result = await getVercelBlob(key, { access, ifNoneMatch, token: getBlobTokenForAccess(access) });

	if (!result) {
		return null;
	}

	if (result.statusCode === 304) {
		return { etag: result.blob.etag, status: 304 };
	}

	return {
		contentType: result.blob.contentType,
		etag: result.blob.etag,
		size: result.blob.size,
		status: 200,
		stream: result.stream,
	};
};

export const getBlobSize = async ({ access, url }: { access: MediaAccess; url: string }) => {
	const stored = await getFilesClient(access).head(getPathKey(url));

	return stored.size;
};

export const downloadBlob = async ({ access, url }: { access: MediaAccess; url: string }) => {
	const blob = await getBlob({ access, pathname: getPathKey(url) });

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

export const deleteBlob = async ({ access, url }: { access: MediaAccess; url: string }) => {
	await getFilesClient(access).delete(getPathKey(url));
};
