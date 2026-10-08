"use client";

import { useEffect, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { createStore, type StoreApi } from "zustand/vanilla";

import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";

type EditorDraftSession<State extends object> = {
	connect: () => (() => void) | undefined;
	isActive: () => boolean;
	store: StoreApi<State>;
};

export const useEditorDraftSession = <State extends object>({
	create,
	id,
	resume,
	retain,
}: {
	create: (isActive: () => boolean, previous?: State) => State;
	id: string;
	resume: (state: State) => boolean;
	retain: (state: State) => boolean;
}) => {
	const queryClient = useQueryClient();
	const { organizationId, userId } = useOrganizationPermissions();

	const [session] = useState<EditorDraftSession<State>>(() => {
		const key = ["editor-draft", userId, organizationId, id];
		const cache = queryClient.getQueryCache();
		const cached = queryClient.getQueryData<EditorDraftSession<State>>(key);

		if (cached && resume(cached.store.getState())) {
			return cached;
		}

		const isActive = () => queryClient.getQueryData<EditorDraftSession<State>>(key)?.store === store;
		const store = createStore<State>()(() => create(isActive, cached?.store.getState()));
		const lifecycle = { consumers: 0, discarded: false, disconnect: () => {} };

		const warn = (event: BeforeUnloadEvent) => {
			if (retain(store.getState())) {
				event.preventDefault();
				event.returnValue = "";
			}
		};

		const release = () => {
			if (!isActive()) {
				lifecycle.discarded = true;
				lifecycle.disconnect();
			} else if (lifecycle.consumers === 0 && !retain(store.getState())) {
				lifecycle.disconnect();
				queryClient.removeQueries({ exact: true, queryKey: key });
			}
		};

		const entry: EditorDraftSession<State> = {
			connect: () => {
				if (lifecycle.discarded) {
					return;
				}

				lifecycle.consumers += 1;
				queryClient.setQueryDefaults(["editor-draft"], { gcTime: Infinity });
				queryClient.setQueryData(key, entry);
				lifecycle.disconnect();
				const unsubscribeStore = store.subscribe(release);
				const unsubscribeCache = cache.subscribe(release);
				window.addEventListener("beforeunload", warn);
				lifecycle.disconnect = () => {
					unsubscribeStore();
					unsubscribeCache();
					window.removeEventListener("beforeunload", warn);
				};

				return () => {
					lifecycle.consumers -= 1;
					release();
				};
			},
			isActive,
			store,
		};

		return entry;
	});

	useEffect(() => session.connect(), [session]);

	return session;
};
