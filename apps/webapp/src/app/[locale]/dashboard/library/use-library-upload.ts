"use client";

import { useState } from "react";

import { useAuthSession } from "@/components/auth/auth-session-context";
import { uploadFile } from "@/lib/storage";
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

	const uploadOne = async (file: File) => {
		const purpose = getPurpose(file);
		const policy = uploadPolicies[purpose];

		if (!organizationId || file.size === 0 || file.size > policy.maxFileSizeMb * 1024 * 1024) {
			setError("invalid");

			return;
		}

		try {
			await uploadFile({ file, organizationId, purpose });
		} catch {
			setError("failed");
		}
	};

	const upload = async (files: Array<File>) => {
		setError(null);
		setPending((count) => count + files.length);
		await Promise.all(
			files.map(async (file) => {
				await uploadOne(file);
				setPending((count) => count - 1);
			})
		);
		onUploaded();
	};

	return { error, upload, uploading: pending > 0 };
};
