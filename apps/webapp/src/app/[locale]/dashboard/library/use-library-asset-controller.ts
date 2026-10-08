"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import { ORPCError } from "@orpc/client";
import { useQueryClient } from "@tanstack/react-query";

import { apiClient, client } from "@/lib/api-client";

export type LibraryAssetDetail = Awaited<ReturnType<typeof client.library.get>>;

type LibraryAssetPatch = { content?: string; name?: string };

export const useLibraryAssetController = ({
	asset,
	onConflict,
}: {
	asset: LibraryAssetDetail;
	onConflict: () => void;
}) => {
	const queryClient = useQueryClient();
	const [status, setStatus] = useState<"conflict" | "saved" | "saveFailed" | "saving">("saved");
	const revision = useRef(asset.updatedAt);
	const pending = useRef<LibraryAssetPatch | null>(null);
	const saving = useRef(false);
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

	const flush = async () => {
		while (pending.current && !saving.current) {
			const patch = pending.current;
			pending.current = null;
			saving.current = true;
			setStatus("saving");

			try {
				const updated = await client.library.update({
					...patch,
					assetId: asset.id,
					updatedAt: revision.current,
				});

				revision.current = updated.updatedAt;
				queryClient.setQueryData(apiClient.library.get.queryKey({ input: { assetId: asset.id } }), updated);
				queryClient.invalidateQueries({ queryKey: apiClient.library.list.key() });
				setStatus("saved");
			} catch (error) {
				saving.current = false;

				if (error instanceof ORPCError && error.code === "CONFLICT") {
					setStatus("conflict");
					onConflict();

					return;
				}

				pending.current = Object.assign({}, patch, pending.current);
				setStatus("saveFailed");

				return;
			}

			saving.current = false;
		}
	};

	const flushOnUnmount = useEffectEvent(() => {
		clearTimeout(timer.current);
		flush();
	});

	useEffect(() => () => flushOnUnmount(), []);

	return {
		change: (patch: LibraryAssetPatch) => {
			pending.current = { ...pending.current, ...patch };
			clearTimeout(timer.current);
			timer.current = setTimeout(() => flush(), 800);
		},
		status,
	};
};
