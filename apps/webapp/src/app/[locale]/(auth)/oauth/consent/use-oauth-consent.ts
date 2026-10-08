"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { authClient } from "@/lib/auth-client";

export const useOauthConsent = ({ clientId }: { clientId?: string }) => {
	const clientQuery = useQuery({
		enabled: Boolean(clientId),
		queryFn: async () => {
			if (!clientId) {
				return null;
			}

			const { data, error } = await authClient.oauth2.publicClient({
				query: { client_id: clientId },
			});

			if (error) {
				throw new Error(error.message);
			}

			return data;
		},
		queryKey: ["oauth-client", clientId],
	});

	const consentMutation = useMutation({
		mutationFn: async ({ accept }: { accept: boolean }) => {
			const { data, error } = await authClient.oauth2.consent({ accept });

			if (error) {
				throw new Error(error.message);
			}

			if (data?.url) {
				window.location.assign(data.url);
			}
		},
	});

	return {
		approve: () => {
			consentMutation.mutate({ accept: true });
		},
		client: clientQuery.data,
		deny: () => {
			consentMutation.mutate({ accept: false });
		},
		error: clientQuery.error ?? consentMutation.error,
		isPending: clientQuery.isPending,
		isSubmitting: consentMutation.isPending,
	};
};
