"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { apiClient, client } from "@/lib/api-client";
import type { Iso6391LanguageCode } from "@starter/infinite-website";
import type { WebsiteEditInput } from "@starter/infinite-website/editing";
import { toast } from "@starter/ui/components/toaster";

export const useWebsiteLanguages = () => {
	const queryClient = useQueryClient();

	const website = useQuery({
		...apiClient.websites.get.queryOptions(),
		refetchInterval: (query) =>
			query.state.data?.workflow?.kind === "translation" && query.state.data.workflow.state === "active"
				? 1500
				: false,
	});

	const { can } = useOrganizationPermissions();
	const t = useTranslations("website.languages");
	const settingsT = useTranslations("website.settings");

	const invalidateDerivedQueries = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: apiClient.linkPages.get.key() }),
			queryClient.invalidateQueries({ queryKey: apiClient.seo.overview.key() }),
		]);

	const mutation = useMutation({
		mutationFn: async (edit: WebsiteEditInput) => {
			const current = await queryClient.query(apiClient.websites.get.queryOptions());

			if (!current?.snapshot || !can("workspace.write")) {
				throw new Error("Website unavailable");
			}

			return client.websites.edit({
				edit,
				updatedAt: current.updatedAt,
				websiteId: current.id,
			});
		},
		onError: (_error, edit) =>
			toast.error(edit.operation === "update-settings" ? settingsT("invalid") : t("failed")),
		onSuccess: async (data) => {
			queryClient.setQueryData(apiClient.websites.get.queryKey(), data);
			await invalidateDerivedQueries();
		},
	});

	const unpublish = useMutation({
		mutationFn: async () => {
			if (!website.data?.snapshot || !can("workspace.write")) {
				throw new Error("Website unavailable");
			}

			return client.websites.unpublish({ updatedAt: website.data.updatedAt, websiteId: website.data.id });
		},
		onError: async () => {
			await queryClient.invalidateQueries({ queryKey: apiClient.websites.get.key() });
			toast.error(settingsT("unpublishFailed"));
		},
		onSuccess: (data) => {
			queryClient.setQueryData(apiClient.websites.get.queryKey(), data);
			toast.success(settingsT("unpublishSuccess"));
		},
	});

	const translation = useMutation({
		mutationFn: async (locale: Iso6391LanguageCode) => {
			const current = await queryClient.query({ ...apiClient.websites.get.queryOptions(), staleTime: 0 });

			if (!current?.snapshot || !can("workspace.write")) {
				throw new Error("Website unavailable");
			}

			const started = await client.websites.edit({
				edit: { locale, operation: "add-language" },
				updatedAt: current.updatedAt,
				websiteId: current.id,
			});

			queryClient.setQueryData(apiClient.websites.get.queryKey(), started);
			const deadline = Date.now() + 10 * 60 * 1000;

			while (Date.now() < deadline) {
				const latest = await queryClient.query({ ...apiClient.websites.get.queryOptions(), staleTime: 0 });

				if (!latest?.workflow) {
					if (!latest?.snapshot?.document.locales.includes(locale)) {
						throw new Error("Translation did not complete");
					}

					return latest;
				}

				if (
					latest.workflow.kind !== "translation" ||
					latest.workflow.locale !== locale ||
					latest.workflow.runId !== started.workflow?.runId ||
					latest.workflow.state === "failed"
				) {
					throw new Error("Translation failed");
				}

				await new Promise((resolve) => setTimeout(resolve, 1500));
			}

			throw new Error("Translation timed out");
		},
		onError: () => toast.error(t("failed")),
		onSuccess: invalidateDerivedQueries,
	});

	const workflow = website.data?.workflow;
	const translating = workflow?.kind === "translation" ? workflow : undefined;

	return {
		add: translation.mutateAsync,
		cancelTranslation: async () => {
			if (!website.data || !translating) {
				return;
			}

			await client.websites.cancelWorkflow({ websiteId: website.data.id, workflowRunId: translating.runId });
			await queryClient.invalidateQueries({ queryKey: apiClient.websites.get.queryKey() });
		},
		document: website.data?.snapshot?.document,
		edit: mutation.mutateAsync,
		enabled:
			can("workspace.write") && Boolean(website.data?.snapshot) && (!workflow || translating?.state === "failed"),
		pending: mutation.isPending || translation.isPending || translating?.state === "active",
		setDefault: (locale: Iso6391LanguageCode) => mutation.mutate({ locale, operation: "set-default-language" }),
		translation: translating,
		unpublish: unpublish.mutate,
		unpublishing: unpublish.isPending,
		website: website.data,
	};
};
