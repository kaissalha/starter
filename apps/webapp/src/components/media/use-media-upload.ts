"use client";

import { useEffect, useRef, useState } from "react";

import { useAuthSession } from "@/components/auth/auth-session-context";
import { client } from "@/lib/api-client";
import { uploadFromClient } from "@/lib/storage";
import { isUploadAllowed, mediaContentTypes, uploadPolicies } from "@starter/documents";

export type UploadedMedia = {
	contentType: string;
	id: string;
	kind: "image" | "video";
	name: string;
	sizeBytes: number | null;
	url: string;
};

export const useMediaUpload = ({ kind, purpose }: { kind?: "image" | "video"; purpose?: "logo" }) => {
	const { data: session } = useAuthSession();
	const organizationId = session?.session.activeOrganizationId;
	const abort = useRef<AbortController | null>(null);
	const [progress, setProgress] = useState<number | null>(null);
	const [error, setError] = useState<"invalid" | "failed" | null>(null);
	useEffect(() => () => abort.current?.abort(), []);

	const upload = async (file: File): Promise<UploadedMedia | null> => {
		const mediaKind = file.type.startsWith("video/") ? "video" : "image";
		const uploadPurpose = purpose ?? mediaKind;

		if (!organizationId || abort.current) {
			return null;
		}

		if (
			(kind && kind !== mediaKind) ||
			!isUploadAllowed({ mediaType: file.type, purpose: uploadPurpose, sizeBytes: file.size })
		) {
			setError("invalid");

			return null;
		}

		const controller = new AbortController();
		abort.current = controller;
		setProgress(0);
		setError(null);

		try {
			const blob = await uploadFromClient({
				file,
				handleUploadUrl: "/api/media",
				onUploadProgress: ({ percentage }) => setProgress(percentage),
				pathname: `organizations/${organizationId}/media/${crypto.randomUUID()}-${file.name}`,
				payload: {
					access: "public",
					maxFileSizeMb: uploadPolicies[uploadPurpose].maxFileSizeMb,
					name: file.name,
					organizationId,
					purpose: uploadPurpose,
				},
				signal: controller.signal,
			});

			setProgress(100);
			const started = Date.now();

			while (Date.now() - started < 60_000) {
				const registered = await client.documents.findUpload({ url: blob.url }, { signal: controller.signal });

				if (registered) {
					return {
						contentType: file.type,
						id: registered.id,
						kind: mediaKind,
						name: file.name,
						sizeBytes: file.size,
						url: blob.url,
					};
				}

				await new Promise((resolve) => setTimeout(resolve, 500));
			}

			throw new Error("Upload registration timed out");
		} catch {
			if (!controller.signal.aborted) {
				setError("failed");
			}

			return null;
		} finally {
			abort.current = null;

			if (!controller.signal.aborted) {
				setProgress(null);
			}
		}
	};

	const policy = purpose ?? kind;

	return {
		accept: (policy ? uploadPolicies[policy].contentTypes : mediaContentTypes).join(","),
		error,
		progress,
		upload,
	};
};
