import { z } from "zod";

import { detectKind, getExtensionFromFilename } from "./file";

export const mediaAccessValues = ["public", "private"] as const;

export type MediaAccess = (typeof mediaAccessValues)[number];

export const MAX_INGEST_FILE_SIZE_MB = 5;

export const MAX_INGEST_FILE_SIZE_BYTES = MAX_INGEST_FILE_SIZE_MB * 1024 * 1024;

export const MAX_INGEST_TEXT_LENGTH = 500_000;

export const imageContentTypes: ReadonlyArray<string> = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/avif",
	"image/gif",
];

export const videoContentTypes: ReadonlyArray<string> = ["video/mp4", "video/webm"];

export const mediaContentTypes: ReadonlyArray<string> = [...imageContentTypes, ...videoContentTypes];

const knowledgeContentTypes: ReadonlyArray<string> = [
	...imageContentTypes,
	"application/pdf",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/json",
	"application/xml",
	"application/yaml",
	"application/x-yaml",
	"application/octet-stream",
	"text/plain",
	"text/csv",
	"text/markdown",
	"text/html",
	"text/xml",
	"text/yaml",
	"text/x-yaml",
];

export const uploadPurposes = ["image", "knowledge", "logo", "video"] as const;

export type UploadPurpose = (typeof uploadPurposes)[number];

export const uploadPolicies = {
	image: { access: "public", contentTypes: imageContentTypes, maxFileSizeMb: 10 },
	knowledge: { access: "private", contentTypes: knowledgeContentTypes, maxFileSizeMb: MAX_INGEST_FILE_SIZE_MB },
	logo: { access: "public", contentTypes: [...imageContentTypes, "image/svg+xml"], maxFileSizeMb: 5 },
	video: { access: "public", contentTypes: videoContentTypes, maxFileSizeMb: 100 },
} as const satisfies Record<
	UploadPurpose,
	{ access: MediaAccess; contentTypes: ReadonlyArray<string>; maxFileSizeMb: number }
>;

export const uploadClientPayloadSchema = z.compile(
	z.object({
		access: z.enum(mediaAccessValues).default("public"),
		maxFileSizeMb: z
			.number()
			.positive()
			.max(5 * 1024)
			.optional(),
		name: z.string().trim().min(1).max(255).optional(),
		organizationId: z.string().min(1),
		purpose: z.enum(uploadPurposes).optional(),
	})
);

export type ClientUploadPayload = z.infer<typeof uploadClientPayloadSchema>;

export const normalizeContentType = (mediaType: string) =>
	mediaType.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";

export const isUploadAllowed = ({
	mediaType,
	purpose,
	sizeBytes,
}: {
	mediaType: string;
	purpose: UploadPurpose;
	sizeBytes: number;
}) => {
	const policy = uploadPolicies[purpose];

	return (
		sizeBytes > 0 &&
		sizeBytes <= policy.maxFileSizeMb * 1024 * 1024 &&
		policy.contentTypes.includes(normalizeContentType(mediaType))
	);
};

export const isKnowledgeFile = ({ filename, mediaType }: { filename: string; mediaType: string }) => {
	const contentType = normalizeContentType(mediaType);
	const kind = detectKind({ extension: getExtensionFromFilename({ filename }) ?? undefined, mediaType: contentType });

	return (
		uploadPolicies.knowledge.contentTypes.includes(contentType) &&
		(kind === "image" || kind === "document" || kind === "text")
	);
};

const viewerKinds = new Map<string, "docx" | "pdf" | "xlsx">([
	["application/pdf", "pdf"],
	["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
	["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
]);

export const getDocumentViewerKind = (contentType: string) => viewerKinds.get(normalizeContentType(contentType));
