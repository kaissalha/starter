"use client";

import { useReducer } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { apiClient } from "@/lib/api-client";
import { toast } from "@starter/ui/components/toaster";

type DomainList = Awaited<ReturnType<typeof apiClient.domains.list.call>>;

export type WebsiteDomain = DomainList["domains"][number];

export type DomainRegistration = DomainList["registrations"][number];

export type DomainOffer = { domain: string; purchasePrice: number; renewalPrice: number };

export type DomainGroup = {
	apex: string;
	domains: Array<WebsiteDomain>;
	key: string;
	lead: WebsiteDomain;
	registration: DomainRegistration | null;
	status: "disconnecting" | "live" | "dns" | "ownership" | "tls";
};

type View =
	| { name: "overview" }
	| { name: "search" }
	| { name: "connect" }
	| { name: "checkout"; offer: DomainOffer }
	| { domain: WebsiteDomain; name: "dns" };

type ViewAction = View | { name: "back" };

const viewReducer = (state: View, action: ViewAction): View => {
	if (action.name !== "back") {
		return action;
	}

	return state.name === "checkout" ? { name: "search" } : { name: "overview" };
};

const groupKey = (hostname: string) => hostname.replace(/^www\./u, "");

const groupStatus = (domains: Array<WebsiteDomain>): DomainGroup["status"] => {
	if (domains.some((domain) => domain.status === "disconnecting")) {
		return "disconnecting";
	}

	if (domains.some((domain) => !domain.ownershipVerified)) {
		return "ownership";
	}

	if (domains.some((domain) => !domain.dnsReady)) {
		return "dns";
	}

	return domains.every((domain) => domain.tlsReady) ? "live" : "tls";
};

export const groupWebsiteDomains = (list: DomainList | undefined) => {
	const domains = list?.domains ?? [];

	const keyOf = (hostname: string) =>
		domains.some((other) => other.hostname === groupKey(hostname)) ? groupKey(hostname) : hostname;

	const keys = [...new Set(domains.map((domain) => keyOf(domain.hostname)))];

	return keys.flatMap((key): Array<DomainGroup> => {
		const members = domains.filter((domain) => keyOf(domain.hostname) === key);
		const lead = members.find((domain) => domain.hostname === key) ?? members[0];

		if (!lead) {
			return [];
		}

		return [
			{
				apex: key,
				domains: members,
				key: lead.id,
				lead,
				registration:
					list?.registrations.find((registration) => registration.id === lead.registrationId) ?? null,
				status: groupStatus(members),
			},
		];
	});
};

const isSettling = (list: DomainList | undefined) =>
	Boolean(
		list?.domains.some((domain) => domain.status !== "connected" || !domain.tlsReady) ||
		list?.registrations.some((registration) => registration.status === "registering")
	);

export const useWebsiteDomainsController = () => {
	const [view, dispatchView] = useReducer(viewReducer, { name: "overview" });
	const queryClient = useQueryClient();
	const tCommon = useTranslations("common");
	const options = apiClient.domains.list.queryOptions();

	const query = useQuery({
		...options,
		refetchInterval: (current) => (isSettling(current.state.data) ? 10_000 : false),
	});

	const update = (data: DomainList) => queryClient.setQueryData(options.queryKey, data);
	const refresh = () => queryClient.invalidateQueries({ queryKey: options.queryKey });

	const connect = useMutation(
		apiClient.domains.connect.mutationOptions({
			onSuccess: (data) => {
				update(data);
				dispatchView({ name: "overview" });
			},
		})
	);

	const verify = useMutation(apiClient.domains.verify.mutationOptions({ onSettled: refresh }));
	const changeMethod = useMutation(apiClient.domains.changeMethod.mutationOptions({ onSuccess: update }));
	const disconnect = useMutation(apiClient.domains.disconnect.mutationOptions({ onSettled: refresh }));
	const primary = useMutation(apiClient.domains.setPrimary.mutationOptions({ onSuccess: update }));
	const subdomain = useMutation(apiClient.domains.updateSubdomain.mutationOptions({ onSuccess: refresh }));
	const autoRenew = useMutation(apiClient.domains.setAutoRenew.mutationOptions({ onSettled: refresh }));

	const transferCode = useMutation(
		apiClient.domains.transferCode.mutationOptions({
			onError: () => toast.error(tCommon("messages.somethingWentWrong")),
		})
	);

	const purchase = useMutation(
		apiClient.domains.purchase.mutationOptions({
			onSuccess: (data) => {
				update(data);
				dispatchView({ name: "overview" });
			},
		})
	);

	const mutations = [connect, verify, changeMethod, disconnect, primary, autoRenew];

	const latest = mutations.reduce((current, mutation) =>
		mutation.submittedAt > current.submittedAt ? mutation : current
	);

	return {
		autoRenew,
		changeMethod,
		connect,
		disconnect,
		error: latest.isError ? latest.error : null,
		groups: groupWebsiteDomains(query.data),
		pending: mutations.some((mutation) => mutation.isPending),
		pendingRegistrations: (query.data?.registrations ?? []).filter(
			(registration) =>
				registration.status !== "active" &&
				!query.data?.domains.some((domain) => domain.registrationId === registration.id)
		),
		primary,
		purchase,
		query,
		setView: dispatchView,
		subdomain,
		transferCode,
		verify,
		view,
	};
};

export const useWebsitePublicUrl = ({ fallback, websiteId }: { fallback?: string; websiteId?: string }) => {
	const { data } = useQuery(apiClient.domains.list.queryOptions({ enabled: Boolean(websiteId) }));
	const primary = data?.domains.find((domain) => domain.primary && domain.status === "connected");

	if (process.env.NODE_ENV === "development" || !data) {
		return fallback;
	}

	if (primary) {
		return `https://${primary.hostname}`;
	}

	return data.address ? `https://${data.address}` : fallback;
};
