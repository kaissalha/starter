import { ORPCError } from "@orpc/client";
import type { HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";

import {
	detectKind,
	type MediaAccess,
	mediaAccessValues,
	mediaContentTypes,
	uploadClientPayloadSchema,
	uploadPolicies,
	uploadPurposes,
} from "@starter/documents";
import { log, serializeLogError } from "@starter/observability";

import { resolveSession } from "../lib/auth";
import { deleteBlob, getBlob, getBlobSize, handleClientUpload } from "../lib/blob-storage";
import { startFileIngestion } from "../services/documents";
import { requireOrganizationPermission } from "../services/permissions";
import { createFile, findFileByUrl } from "../services/storage";
import { parseJsonValue } from "../utils/json";
import type { OrganizationPermission } from "../utils/permissions";
import { parseJsonPayload } from "./utils/json-payload";

type MutableReference<Value> = { value: Value };

const uploadTokenPayloadSchema = z.compile(
	z.object({
		access: z.enum(mediaAccessValues).default("public"),
		maximumSizeInBytes: z.number().positive(),
		name: z.string().trim().min(1).max(255).optional(),
		organizationId: z.string().min(1),
		purpose: z.enum(uploadPurposes).optional(),
		userId: z.string(),
	})
);

const handleUploadEventSchema = z.compile(
	z.discriminatedUnion("type", [
		z.object({
			payload: z.object({
				clientPayload: z.string().nullable(),
				multipart: z.boolean(),
				pathname: z.string(),
			}),
			type: z.literal("blob.generate-client-token"),
		}),
		z.object({
			payload: z.object({
				blob: z.object({
					contentDisposition: z.string(),
					contentType: z.string(),
					downloadUrl: z.string(),
					etag: z.string(),
					pathname: z.string(),
					url: z.string(),
				}),
				tokenPayload: z.string().nullable().optional(),
			}),
			type: z.literal("blob.upload-completed"),
		}),
	])
);

const handleUploadBodySchema = z.compile(
	z.custom<HandleUploadBody>((value) => handleUploadEventSchema.safeParse(value).success)
);

const getMediaQuerySchema = z.compile(
	z.object({
		organizationId: z.string().min(1),
		url: z.url(),
	})
);

const formatEntityTag = (value: string) => (value.startsWith('"') || value.startsWith("W/") ? value : `"${value}"`);

const mediaContentDisposition = ({ contentType, filename }: { contentType: string; filename?: string }) => {
	const disposition =
		mediaContentTypes.includes(contentType) || contentType === "application/pdf" ? "inline" : "attachment";

	const sanitized = filename?.replaceAll(/["\\\r\n]/g, "").replaceAll(/[^\u0020-\u007e]/g, "");

	return sanitized ? `${disposition}; filename="${sanitized}"` : disposition;
};

const requireOrganizationMembership = async ({
	headers,
	message,
	organizationId,
	permission,
}: {
	headers: Headers;
	message: string;
	organizationId: string;
	permission: OrganizationPermission;
}) => {
	const session = await resolveSession(headers, false);

	if (!session) {
		throw new ORPCError("UNAUTHORIZED", { message });
	}

	await requireOrganizationPermission({ organizationId, permission, userId: session.user.id });

	return session.user.id;
};

const rejectUpload = async ({ access, message, url }: { access: MediaAccess; message?: string; url: string }) => {
	try {
		await deleteBlob({ access, url });
	} catch (error) {
		await log.warn({ error: serializeLogError(error), message: "Rejected upload Blob cleanup failed" });
	}

	return new ORPCError("BAD_REQUEST", { message });
};

export const handleMediaUpload = async (request: Request) => {
	if (process.env.NODE_ENV === "development" && !process.env.VERCEL_BLOB_CALLBACK_URL) {
		throw new Error(
			"VERCEL_BLOB_CALLBACK_URL is required in development (public origin only, no /api/media suffix)"
		);
	}

	const body = handleUploadBodySchema.safeParse(parseJsonValue(await request.text()));

	if (!body.success) {
		throw new ORPCError("BAD_REQUEST", { message: "Invalid upload request." });
	}

	const jsonResponse = await handleClientUpload({
		body: body.data,
		onBeforeGenerateToken: async (_pathname, clientPayload) => {
			const raw = parseJsonPayload(clientPayload, {
				invalidMessage: "Invalid upload payload.",
				missingMessage: "Missing upload payload.",
			});

			const parsed = uploadClientPayloadSchema.safeParse(raw);

			if (!parsed.success) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Invalid client upload payload.",
				});
			}

			const userId = await requireOrganizationMembership({
				headers: request.headers,
				message: "Must be authenticated to upload media.",
				organizationId: parsed.data.organizationId,
				permission: "write",
			});

			const purpose = parsed.data.purpose;
			const policy = uploadPolicies[purpose ?? "logo"];

			if (parsed.data.access !== policy.access) {
				throw new ORPCError("BAD_REQUEST");
			}

			const maxFileSizeMb = Math.min(parsed.data.maxFileSizeMb ?? policy.maxFileSizeMb, policy.maxFileSizeMb);
			const maximumSizeInBytes = Math.floor(maxFileSizeMb * 1024 * 1024);

			return {
				addRandomSuffix: true,
				allowedContentTypes: [...policy.contentTypes],
				maximumSizeInBytes,
				tokenPayload: JSON.stringify({
					access: parsed.data.access,
					maximumSizeInBytes,
					name: parsed.data.name,
					organizationId: parsed.data.organizationId,
					purpose,
					userId,
				}),
			};
		},
		onUploadCompleted: async ({ blob, tokenPayload }) => {
			const raw = parseJsonPayload(tokenPayload, {
				invalidMessage: "Invalid upload token payload.",
				missingMessage: "Missing upload token payload.",
			});

			const parsed = uploadTokenPayloadSchema.safeParse(raw);

			if (!parsed.success) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Invalid upload token payload.",
				});
			}

			await requireOrganizationPermission({
				organizationId: parsed.data.organizationId,
				permission: "write",
				userId: parsed.data.userId,
			});
			const extension = blob.pathname.split(".").pop()?.toLowerCase() ?? "";
			const baseContentType = blob.contentType.split(";")[0]?.trim().toLowerCase();
			const contentType = baseContentType || "application/octet-stream";
			const kind = detectKind({ extension, mediaType: contentType });
			const policy = uploadPolicies[parsed.data.purpose ?? "logo"];

			if (parsed.data.access !== policy.access || !policy.contentTypes.includes(contentType)) {
				throw await rejectUpload({ access: parsed.data.access, url: blob.url });
			}

			const indexable = parsed.data.purpose === "knowledge";

			if (indexable && kind !== "image" && kind !== "document" && kind !== "text") {
				throw await rejectUpload({ access: parsed.data.access, url: blob.url });
			}

			const sizeBytes = await getBlobSize({ access: parsed.data.access, url: blob.url });

			if (sizeBytes > Math.min(parsed.data.maximumSizeInBytes, policy.maxFileSizeMb * 1024 * 1024)) {
				throw await rejectUpload({
					access: parsed.data.access,
					message: "Uploaded file exceeds its size limit.",
					url: blob.url,
				});
			}

			const { created, file: fileRecord } = await createFile({
				access: parsed.data.access,
				contentType,
				kind,
				name: parsed.data.name ?? blob.pathname.split("/").pop() ?? blob.pathname,
				organizationId: parsed.data.organizationId,
				ragStatus: indexable ? "pending" : "none",
				sizeBytes,
				sourceType: "upload",
				uploadedBy: parsed.data.userId,
				url: blob.url,
			});

			if (indexable && created) {
				await startFileIngestion({
					fileId: fileRecord.id,
					organizationId: parsed.data.organizationId,
				});
			}
		},
		request,
	});

	return Response.json(jsonResponse, { status: 200 });
};

export const handleGetMedia = async (request: Request) => {
	const requestUrl = new URL(request.url);

	const parsedQuery = getMediaQuerySchema.safeParse({
		organizationId: requestUrl.searchParams.get("organizationId") ?? undefined,
		url: requestUrl.searchParams.get("url") ?? undefined,
	});

	if (!parsedQuery.success) {
		throw new ORPCError("BAD_REQUEST", { message: "Invalid media request." });
	}

	const { organizationId, url } = parsedQuery.data;

	await requireOrganizationMembership({
		headers: request.headers,
		message: "Must be authenticated to view uploaded media.",
		organizationId,
		permission: "read",
	});

	const stored = await findFileByUrl({ organizationId, url });

	if (!stored?.url) {
		throw new ORPCError("NOT_FOUND", {
			message: "Uploaded media not found.",
		});
	}

	if (stored.access === "public") {
		return Response.redirect(stored.url);
	}

	const pathnameReference: MutableReference<string | undefined> = { value: undefined };

	try {
		pathnameReference.value = decodeURIComponent(new URL(stored.url).pathname).replace(/^\/+/, "");
	} catch {
		throw new ORPCError("BAD_REQUEST", {
			message: "Invalid media URL.",
		});
	}

	const blob = await getBlob({
		access: "private",
		ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
		pathname: pathnameReference.value,
	});

	if (!blob) {
		throw new ORPCError("NOT_FOUND", {
			message: "Blob not found.",
		});
	}

	const responseHeaders = new Headers({
		"Cache-Control": "private, no-cache",
		"Content-Security-Policy": "default-src 'none'; sandbox; frame-ancestors 'none'",
		"X-Content-Type-Options": "nosniff",
	});

	if (blob.etag) {
		responseHeaders.set("ETag", formatEntityTag(blob.etag));
	}

	if (blob.status === 304) {
		return new Response(null, {
			headers: responseHeaders,
			status: 304,
		});
	}

	const contentType = blob.contentType.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
	responseHeaders.set("Content-Type", blob.contentType);
	responseHeaders.set("Content-Disposition", mediaContentDisposition({ contentType, filename: stored.name }));

	return new Response(blob.stream, {
		headers: responseHeaders,
		status: 200,
	});
};
