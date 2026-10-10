import { ORPCError } from "@orpc/client";
import { FilesError } from "files-sdk";
import { createFilesRouter, UploadRejectedError } from "files-sdk/api";
import { z } from "zod";

import { normalizeContentType, uploadPolicies, type UploadPurpose, uploadPurposes } from "@starter/documents";
import { log, serializeLogError } from "@starter/observability";

import { resolveSession } from "../lib/auth";
import { getFilesClient, getStorageKeyPrefix } from "../lib/blob-storage";
import { registerUpload, UploadRejectedError as RegistrationRejectedError } from "../services/media";
import { requireOrganizationPermission } from "../services/permissions";

const UPLOAD_URL_TTL_SECONDS = 10 * 60;

const uploadScopeSchema = z.compile(
	z.object({
		name: z.string().trim().min(1).max(255),
		organizationId: z.string().min(1),
		purpose: z.enum(uploadPurposes),
	})
);

const declaredFilesSchema = z.compile(
	z.array(z.object({ size: z.number().nonnegative(), type: z.string() })).default([])
);

const parseUploadScope = (request: Request) => {
	const { searchParams } = new URL(request.url);

	const scope = uploadScopeSchema.safeParse({
		name: searchParams.get("name"),
		organizationId: searchParams.get("organizationId"),
		purpose: searchParams.get("purpose"),
	});

	if (!scope.success) {
		throw new ORPCError("BAD_REQUEST", { message: "Invalid upload scope." });
	}

	return scope.data;
};

type UploadContext = z.infer<typeof uploadScopeSchema> & { userId: string };

const createUploadRouter = (purpose: UploadPurpose) => {
	const policy = uploadPolicies[purpose];

	return createFilesRouter({
		authorize: async ({ key, params, req }) => {
			if (key) {
				throw new FilesError("ReadOnly", "Only server-keyed uploads are allowed.");
			}

			const scope = parseUploadScope(req);
			const session = await resolveSession(req.headers, false);

			if (!session) {
				throw new FilesError("Unauthorized", "Must be authenticated to upload files.");
			}

			try {
				await requireOrganizationPermission({
					organizationId: scope.organizationId,
					permission: "write",
					userId: session.user.id,
				});
			} catch {
				throw new FilesError("ReadOnly", "Missing permission to upload files.");
			}

			const declared = declaredFilesSchema.safeParse(params.files);

			if (
				!declared.success ||
				declared.data.some(
					({ size, type }) => size === 0 || !policy.contentTypes.includes(normalizeContentType(type))
				)
			) {
				throw new UploadRejectedError("Unsupported upload type.");
			}

			return {
				context: { ...scope, userId: session.user.id } satisfies UploadContext,
				keyPrefix: getStorageKeyPrefix({ organizationId: scope.organizationId, purpose }),
				maxExpiresIn: UPLOAD_URL_TTL_SECONDS,
			};
		},
		files: () => getFilesClient(policy.access),
		maxUploadSize: policy.maxFileSizeMb * 1024 * 1024,
		onError: (error, req) => {
			void log.error({
				error: serializeLogError(error),
				message: "Files gateway request failed",
				path: new URL(req.url).pathname,
			});
		},
		onUploadComplete: async ({ context, file, storageKey }) => {
			if (!context) {
				throw new FilesError("Unauthorized", "Upload context is missing.");
			}

			try {
				return await registerUpload({
					contentType: file.contentType,
					key: storageKey,
					name: context.name,
					organizationId: context.organizationId,
					purpose,
					sizeBytes: file.size,
					userId: context.userId,
				});
			} catch (error) {
				if (error instanceof RegistrationRejectedError) {
					throw new UploadRejectedError(error.message);
				}

				throw error;
			}
		},
		operations: ["upload"],
		secret: process.env.FILES_API_SECRET,
	});
};

const routers = new Map<UploadPurpose, ReturnType<typeof createUploadRouter>>();

export type FilesUploadData = Awaited<ReturnType<typeof registerUpload>>;

export const handleFilesRequest = (request: Request) => {
	const { purpose } = parseUploadScope(request);
	const router = routers.get(purpose) ?? createUploadRouter(purpose);
	routers.set(purpose, router);

	return router.handle(request);
};
