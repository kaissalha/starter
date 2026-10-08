"use client";

import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { apiClient } from "@/lib/api-client";

type DnsList = Awaited<ReturnType<typeof apiClient.domains.records.call>>;

export type DnsRecord = DnsList["records"][number];

export const dnsTypes = ["A", "AAAA", "CAA", "CNAME", "MX", "TXT"] as const;

type DnsType = (typeof dnsTypes)[number];

type DnsRecordInput = Parameters<typeof apiClient.domains.saveRecord.call>[0]["record"];

type Draft = { id: string | null; mxPriority: string; name: string; type: DnsType; value: string };

const emptyDraft: Draft = { id: null, mxPriority: "10", name: "", type: "A", value: "" };

export const dnsTypeSchema = z.enum(dnsTypes);

export const useDomainDnsController = ({ domainId }: { domainId: string }) => {
	const [draft, setDraft] = useState<Draft | null>(null);
	const queryClient = useQueryClient();
	const options = apiClient.domains.records.queryOptions({ input: { domainId } });
	const query = useQuery(options);

	const onSuccess = (data: DnsList) => {
		queryClient.setQueryData(options.queryKey, data);
		setDraft(null);
	};

	const save = useMutation(apiClient.domains.saveRecord.mutationOptions({ onSuccess }));
	const remove = useMutation(apiClient.domains.deleteRecord.mutationOptions({ onSuccess }));

	const submit = () => {
		if (!draft || !draft.value.trim()) {
			return;
		}

		const priority = Number.parseInt(draft.mxPriority, 10);
		const record: DnsRecordInput = { name: draft.name.trim(), type: draft.type, value: draft.value.trim() };

		if (draft.type === "MX" && Number.isFinite(priority)) {
			record.mxPriority = priority;
		}

		save.mutate({ domainId, record, recordId: draft.id ?? undefined });
	};

	const edit = (record: DnsRecord) => {
		const type = dnsTypeSchema.safeParse(record.type);

		if (!type.success) {
			return;
		}

		setDraft({
			id: record.id,
			mxPriority: String(record.mxPriority ?? 10),
			name: record.name,
			type: type.data,
			value: record.value,
		});
	};

	return {
		cancel: () => setDraft(null),
		create: () => setDraft(emptyDraft),
		draft,
		edit,
		error: save.isError || remove.isError,
		pending: save.isPending || remove.isPending,
		query,
		remove: (recordId: string) => remove.mutate({ domainId, recordId }),
		save: submit,
		setDraft: (patch: Partial<Draft>) => setDraft((current) => (current ? { ...current, ...patch } : current)),
	};
};
