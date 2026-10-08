"use client";

import { useState } from "react";

import { useAuthSession } from "@/components/auth/auth-session-context";
import { client } from "@/lib/api-client";
import { uploadFromClient } from "@/lib/storage";
import { mediaContentTypes, uploadPolicies } from "@starter/documents";

const getPurpose = (file: File) => {
	if (!mediaContentTypes.includes(file.type)) {
		return "knowledge";
	}

	return file.type.startsWith("video/") ? "video" : "image";
};

export const useLibraryUpload = ({ onUploaded }: { onUploaded: () => void }) => {
	const { data: session } = useAuthSession();
	const organizationId = session?.session.activeOrganizationId;
	const [pending, setPending] = useState(0);
	const [error, setError] = useState<"invalid" | "failed" | null>(null);

	const uploadFile = async (file: File) => {
		const purpose = getPurpose(file);
		const policy = uploadPolicies[purpose];

		if (!organizationId || file.size === 0 || file.size > policy.maxFileSizeMb * 1024 * 1024) {
			setError("invalid");

			return;
		}

		try {
			const blob = await uploadFromClient({
				file,
				handleUploadUrl: "/api/media",
				pathname: `organizations/${organizationId}/media/${crypto.randomUUID()}-${file.name}`,
				payload: {
					access: policy.access,
					maxFileSizeMb: policy.maxFileSizeMb,
					name: file.name,
					organizationId,
					purpose,
				},
			});

			const started = Date.now();

			while (Date.now() - started < 60_000) {
				if (await client.documents.findUpload({ url: blob.url })) {
					return;
				}

				await new Promise((resolve) => setTimeout(resolve, 500));
			}

			setError("failed");
		} catch {
			setError("failed");
		}
	};

	const upload = async (files: Array<File>) => {
		setError(null);
		setPending((count) => count + files.length);
		await Promise.all(
			files.map(async (file) => {
				await uploadFile(file);
				setPending((count) => count - 1);
			})
		);
		onUploaded();
	};

	return { error, upload, uploading: pending > 0 };
};
