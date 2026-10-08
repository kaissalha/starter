export const getExtensionFromFilename = ({ filename, maxLength = 8 }: { filename: string; maxLength?: number }) => {
	const lastDot = filename.lastIndexOf(".");

	if (lastDot <= 0 || lastDot === filename.length - 1) {
		return null;
	}

	return filename.slice(lastDot + 1, lastDot + 1 + maxLength).toLowerCase();
};

export const getExtensionFromMediaType = ({ mediaType }: { mediaType: string }) => {
	const normalizedMediaType = mediaType.split(";")[0]?.trim().toLowerCase();

	if (!normalizedMediaType) {
		return "bin";
	}

	const subtype = normalizedMediaType.split("/")[1];

	if (!subtype) {
		return "bin";
	}

	return subtype.split("+")[0] || "bin";
};

export const getFileExtension = ({
	fallback = "",
	filename,
	maxNameExtensionLength = 8,
	mediaType = "",
}: {
	fallback?: string;
	filename: string;
	maxNameExtensionLength?: number;
	mediaType?: string;
}) => {
	const fromName = getExtensionFromFilename({ filename, maxLength: maxNameExtensionLength });

	if (fromName) {
		return fromName;
	}

	const subtype =
		mediaType
			.split(";")[0]
			?.trim()
			.toLowerCase()
			.split("/")[1]
			?.replaceAll("+", " ")
			.slice(0, maxNameExtensionLength) ?? "";

	return subtype || fallback;
};

export const getDisplayFileExtension = ({ filename, mediaType }: { filename?: string; mediaType: string }) => {
	if (filename) {
		const lastDot = filename.lastIndexOf(".");

		if (lastDot > 0 && lastDot < filename.length - 1) {
			return filename.slice(lastDot + 1).toUpperCase();
		}
	}

	const subtype = mediaType.split("/").pop();

	if (!subtype) {
		return null;
	}

	if (subtype.includes(".")) {
		const tail = subtype.split(".").pop();

		return tail ? tail.toUpperCase() : null;
	}

	if (subtype.length > 8) {
		return null;
	}

	return subtype.toUpperCase();
};

export type FileKind = "audio" | "document" | "image" | "other" | "text" | "video";

const documentMediaTypes = new Set([
	"application/pdf",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.ms-excel",
	"text/csv",
	"text/html",
	"application/xml",
	"text/xml",
]);

const documentExtensions = new Set(["csv", "doc", "docx", "htm", "html", "pdf", "xls", "xlsx", "xml"]);

const textExtensions = new Set(["json", "log", "md", "mdx", "txt", "yaml", "yml"]);

export const detectKind = ({ extension, mediaType }: { extension?: string; mediaType: string }): FileKind => {
	if (mediaType.startsWith("image/")) {
		return "image";
	}

	if (mediaType.startsWith("video/")) {
		return "video";
	}

	if (mediaType.startsWith("audio/")) {
		return "audio";
	}

	if (documentMediaTypes.has(mediaType)) {
		return "document";
	}

	if (mediaType.startsWith("text/") || mediaType === "application/json") {
		return "text";
	}

	const normalizedExtension = extension?.toLowerCase() ?? "";

	if (documentExtensions.has(normalizedExtension)) {
		return "document";
	}

	return textExtensions.has(normalizedExtension) ? "text" : "other";
};
