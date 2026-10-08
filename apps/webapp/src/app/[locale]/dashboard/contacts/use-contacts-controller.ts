"use client";

import { useDeferredValue, useState } from "react";

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

import { useDataTableState } from "@/hooks/use-data-table-state";
import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { apiClient } from "@/lib/api-client";

import { defaultContactPageSize, defaultContactSorting, getContactListInput } from "./contact-list-input";

export type ContactRow = Awaited<ReturnType<typeof apiClient.contacts.get.call>>;

export type ContactListRow = Awaited<ReturnType<typeof apiClient.contacts.list.call>>["data"][number];

export const useContactsController = () => {
	const queryClient = useQueryClient();

	const [selection, setSelection] = useQueryStates(
		{
			contact: parseAsString,
			contactTab: parseAsStringLiteral(["details", "messages", "activity"] as const).withDefault("details"),
			messageId: parseAsString,
		},
		{ history: "push" }
	);

	const tableState = useDataTableState({
		defaultPageSize: defaultContactPageSize,
		defaultSorting: defaultContactSorting,
	});

	const [activeSort] = tableState.sorting.sorting;
	const search = useDeferredValue(tableState.search.search);

	const query = useInfiniteQuery({
		...apiClient.contacts.list.infiniteOptions<string | null>({
			getNextPageParam: (page) => page.meta.cursor ?? undefined,
			initialPageParam: null,
			input: (cursor) =>
				getContactListInput({
					cursor,
					filters: tableState.filters.apiFilters,
					pageSize: tableState.pagination.pageSize,
					search,
					sort: activeSort,
				}),
		}),
		placeholderData: keepPreviousData,
	});

	const items = query.data?.pages.flatMap((page) => page.data) ?? [];

	return {
		contact: selection.contact,
		contactTab: selection.contactTab,
		items,
		messageId: selection.messageId,
		open: (contactId: string | null) =>
			setSelection({ contact: contactId, contactTab: "details", messageId: null }),
		openMessage: (row: ContactListRow) => {
			queryClient.setQueryData(apiClient.contacts.get.queryKey({ input: { contactId: row.id } }), row);
			setSelection({ contact: row.id, contactTab: "messages", messageId: row.latestMessage?.id ?? null });
		},
		query,
		select: (row: ContactListRow) => {
			queryClient.setQueryData(apiClient.contacts.get.queryKey({ input: { contactId: row.id } }), row);
			setSelection({ contact: row.id, contactTab: "details", messageId: null });
		},
		setMessageId: (messageId: string | null) => setSelection({ messageId }),
		setTab: (contactTab: "details" | "messages" | "activity") => setSelection({ contactTab, messageId: null }),
		tableState,
		totalCount: query.data?.pages[0]?.meta.totalData ?? 0,
	};
};

export const useContactDrawer = (contactId: string, open = true) =>
	useQuery(apiClient.contacts.get.queryOptions({ enabled: open && contactId !== "new", input: { contactId } }));

export const useContactForm = (onSaved: (id: string) => void) => {
	const { can } = useOrganizationPermissions();
	const [draft, setDraft] = useState({ email: "", name: "", phone: "" });
	const queryClient = useQueryClient();

	const mutation = useMutation(
		apiClient.contacts.create.mutationOptions({
			onSuccess: async (contact) => {
				queryClient.setQueryData(
					apiClient.contacts.get.queryKey({ input: { contactId: contact.id } }),
					contact
				);
				await queryClient.invalidateQueries({ queryKey: apiClient.contacts.list.key() });
				onSaved(contact.id);
			},
		})
	);

	const submit = () =>
		can("workspace.write") &&
		mutation.mutate({
			email: draft.email.trim() || null,
			name: draft.name.trim() || null,
			phone: draft.phone.trim() || null,
		});

	return { draft, mutation, setDraft, submit };
};

export const useContactEditForm = ({ contact, onDeleted }: { contact: ContactRow; onDeleted: () => void }) => {
	const { can } = useOrganizationPermissions();

	const [draft, setDraft] = useState({
		email: contact.email ?? "",
		name: contact.name ?? "",
		phone: contact.phone ?? "",
	});

	const [confirmDelete, setConfirmDelete] = useState(false);
	const queryClient = useQueryClient();

	const update = useMutation(
		apiClient.contacts.update.mutationOptions({
			onSuccess: async (saved) => {
				setDraft({ email: saved.email ?? "", name: saved.name ?? "", phone: saved.phone ?? "" });
				queryClient.setQueryData(apiClient.contacts.get.queryKey({ input: { contactId: contact.id } }), saved);
				await queryClient.invalidateQueries({ queryKey: apiClient.contacts.list.key() });
			},
		})
	);

	const remove = useMutation(
		apiClient.contacts.delete.mutationOptions({
			onSuccess: async () => {
				onDeleted();
				queryClient.removeQueries({
					queryKey: apiClient.contacts.get.queryKey({ input: { contactId: contact.id } }),
				});
				await queryClient.invalidateQueries({ queryKey: apiClient.contacts.list.key() });
			},
		})
	);

	const dirty =
		draft.name !== (contact.name ?? "") ||
		draft.email !== (contact.email ?? "") ||
		draft.phone !== (contact.phone ?? "");

	return {
		cancel: () => {
			setDraft({ email: contact.email ?? "", name: contact.name ?? "", phone: contact.phone ?? "" });
			update.reset();
		},
		confirmDelete,
		dirty,
		draft,
		remove,
		setConfirmDelete,
		setDraft,
		submit: () =>
			can("workspace.write") &&
			update.mutate({
				contactId: contact.id,
				email: draft.email.trim() || null,
				name: draft.name.trim() || null,
				phone: draft.phone.trim() || null,
			}),
		update,
	};
};
