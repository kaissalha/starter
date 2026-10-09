import { ORPCError } from "@orpc/client";
import { z } from "zod";

import { mediaContentTypes } from "@starter/documents";

import { resolveSession } from "../lib/auth";
import { getBlob, getPublicBlobUrl } from "../lib/blob-storage";
import { requireOrganizationPermission } from "../services/permissions";
import { getFile } from "../services/storage";

const getMediaQuerySchema = z.compile(
	z.object({
		fileId: z.uuid(),
		organizationId: z.string().min(1),
	})
);

const formatEntityTag = (value: string) => (value.startsWith('"') || value.startsWith("W/") ? value : `"${value}"`);

const mediaContentDisposition = ({ contentType, filename }: { contentType: string; filename?: string }) => {
	const disposition =
		mediaContentTypes.includes(contentType) || contentType === "application/pdf" ? "inline" : "attachment";

	const sanitized = filename?.replaceAll(/["\\\r\n]/g, "").replaceAll(/[^ -~]/g, "");

	return sanitized ? `${disposition}; filename="${sanitized}"` : disposition;
};

export const handleGetMedia = async (request: Request) => {
	const requestUrl = new URL(request.url);

	const parsedQuery = getMediaQuerySchema.safeParse({
		fileId: requestUrl.searchParams.get("fileId") ?? undefined,
		organizationId: requestUrl.searchParams.get("organizationId") ?? undefined,
	});

	if (!parsedQuery.success) {
		throw new ORPCError("BAD_REQUEST", { message: "Invalid media request." });
	}

	const { fileId, organizationId } = parsedQuery.data;
	const session = await resolveSession(request.headers, false);

	if (!session) {
		throw new ORPCError("UNAUTHORIZED", { message: "Must be authenticated to view uploaded media." });
	}

	await requireOrganizationPermission({ organizationId, permission: "read", userId: session.user.id });

	const stored = await getFile({ fileId, organizationId });

	if (!stored?.storageKey || stored.deletedAt) {
		throw new ORPCError("NOT_FOUND", {
			message: "Uploaded media not found.",
		});
	}

	if (stored.access === "public") {
		return Response.redirect(await getPublicBlobUrl(stored.storageKey));
	}

	const blob = await getBlob({
		access: "private",
		ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
		key: stored.storageKey,
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
