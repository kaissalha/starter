import { createElement } from "react";

import { ORPCError } from "@orpc/client";
import { z } from "zod";

import { MarkdownDocument, renderToBuffer } from "@starter/pdf";

import { resolveSession } from "../lib/auth";
import { requireOrganizationPermission } from "../services/permissions";
import { getFile } from "../services/storage";

const assetIdSchema = z.compile(z.uuid());

export const handleGetLibraryDocumentPdf = async (request: Request, params: { assetId: string }) => {
	const assetId = assetIdSchema.safeParse(params.assetId);
	const session = await resolveSession(request.headers, false);
	const organizationId = session?.session.activeOrganizationId;

	if (!session || !organizationId) {
		throw new ORPCError("UNAUTHORIZED", { message: "Authentication is required." });
	}

	await requireOrganizationPermission({ organizationId, permission: "read", userId: session.user.id });
	const file = assetId.success ? await getFile({ fileId: assetId.data, organizationId }) : null;

	if (!file || file.deletedAt || file.content === null) {
		throw new ORPCError("NOT_FOUND", { message: "Document not found." });
	}

	const buffer = await renderToBuffer(createElement(MarkdownDocument, { markdown: file.content, title: file.name }));
	const filename = file.name.replaceAll(/[^\u0020-\u007e]|["\\]/g, "").trim() || "document";

	return new Response(new Uint8Array(buffer), {
		headers: {
			"Cache-Control": "private, no-cache",
			"Content-Disposition": `${new URL(request.url).searchParams.has("download") ? "attachment" : "inline"}; filename="${filename}.pdf"`,
			"Content-Type": "application/pdf",
			"X-Content-Type-Options": "nosniff",
		},
	});
};
