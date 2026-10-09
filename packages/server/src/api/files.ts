import { ORPCError } from "@orpc/client";
import { FilesError } from "files-sdk";
import { createFilesRouter, type FilesApi } from "files-sdk/api";
import { z } from "zod";

import { uploadPolicies, type UploadPurpose, uploadPurposes } from "@starter/documents";

import { resolveSession } from "../lib/auth";
import { getFilesClient, getStorageKeyPrefix } from "../lib/blob-storage";
import { requireOrganizationPermission } from "../services/permissions";

const UPLOAD_URL_TTL_SECONDS = 10 * 60;

const uploadScopeSchema = z.compile(
	z.object({
		organizationId: z.string().min(1),
		purpose: z.enum(uploadPurposes),
	})
);

const routers = new Map<UploadPurpose, FilesApi>();

const parseUploadScope = (request: Request) => {
	const { searchParams } = new URL(request.url);

	const scope = uploadScopeSchema.safeParse({
		organizationId: searchParams.get("organizationId"),
		purpose: searchParams.get("purpose"),
	});

	if (!scope.success) {
		throw new ORPCError("BAD_REQUEST", { message: "Invalid upload scope." });
	}

	return scope.data;
};

const createUploadRouter = (purpose: UploadPurpose) => {
	const policy = uploadPolicies[purpose];

	return createFilesRouter({
		authorize: async ({ key, req }) => {
			if (key) {
				throw new FilesError("ReadOnly", "Only server-keyed uploads are allowed.");
			}

			const { organizationId } = parseUploadScope(req);
			const session = await resolveSession(req.headers, false);

			if (!session) {
				throw new FilesError("Unauthorized", "Must be authenticated to upload files.");
			}

			try {
				await requireOrganizationPermission({ organizationId, permission: "write", userId: session.user.id });
			} catch {
				throw new FilesError("ReadOnly", "Missing permission to upload files.");
			}

			return {
				keyPrefix: getStorageKeyPrefix({ organizationId, purpose }),
				maxExpiresIn: UPLOAD_URL_TTL_SECONDS,
			};
		},
		files: () => getFilesClient(policy.access),
		maxUploadSize: policy.maxFileSizeMb * 1024 * 1024,
		operations: ["upload"],
		secret: process.env.FILES_API_SECRET,
	});
};

export const handleFilesRequest = (request: Request) => {
	const { purpose } = parseUploadScope(request);
	const router = routers.get(purpose) ?? createUploadRouter(purpose);
	routers.set(purpose, router);

	return router.handle(request);
};
