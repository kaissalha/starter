"use client";

import { useEffect, useRef } from "react";

import { useRouter } from "@/i18n/navigation";

import type { LibraryAssetDetail } from "./use-library-asset-controller";

export const useFollowNewVersion = ({
	assetId,
	versions,
}: {
	assetId: string;
	versions: LibraryAssetDetail["versions"] | undefined;
}) => {
	const router = useRouter();
	const seen = useRef<Set<string> | null>(null);

	useEffect(() => {
		if (!versions) {
			return;
		}

		const known = seen.current;
		seen.current = new Set([...(known ?? []), ...versions.map(({ id }) => id)]);
		const fresh = known ? versions.find(({ generating, id }) => generating && !known.has(id)) : undefined;

		if (fresh && fresh.id !== assetId) {
			router.replace(`/dashboard/library/${fresh.id}`, { scroll: false });
		}
	}, [assetId, router, versions]);
};
