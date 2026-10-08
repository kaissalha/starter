"use client";

import { useState } from "react";

import { ORPCError } from "@orpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { apiClient } from "@/lib/api-client";
import { authClient, setActiveOrganization } from "@/lib/auth-client";
import { toast } from "@starter/ui/components/toaster";

import { buildOrganizationSlug } from "./onboarding-utils";
import type { OnboardingBusiness } from "./use-create-organization-form";

const USER_INVITATIONS_QUERY_KEY = ["onboarding", "user-invitations"];

export type OnboardingInvitation = {
	createdAt: Date | string;
	email: string;
	expiresAt: Date | string;
	id: string;
	organizationId: string;
	organizationName?: string;
	role: string;
	status: string;
};

const createOrganization = async (name: string) => {
	const result = await authClient.organization.create({ name, slug: buildOrganizationSlug({ name }) });

	if (result?.error?.code !== "ORGANIZATION_ALREADY_EXISTS") {
		return result;
	}

	return authClient.organization.create({
		name,
		slug: buildOrganizationSlug({ name, suffix: crypto.randomUUID().slice(0, 8) }),
	});
};

export const useOnboardingController = ({
	initialInvitations,
	initialOrganization,
	redirectPath,
}: {
	initialInvitations: Array<OnboardingInvitation> | null;
	initialOrganization?: { id: string; name: string };
	redirectPath: string;
}) => {
	const t = useTranslations("onboarding");
	const router = useRouter();
	const queryClient = useQueryClient();

	const [createdOrganization, setCreatedOrganization] = useState<{ id: string; name: string } | null>(
		initialOrganization ?? null
	);

	const generation = useMutation(apiClient.websites.generate.mutationOptions());

	const [isCreating, setIsCreating] = useState(false);
	const [pendingInvitationId, setPendingInvitationId] = useState<string | null>(null);

	const {
		data: invitationsData,
		error: invitationsError,
		isPending: isInvitationsPending,
		refetch: refetchInvitations,
	} = useQuery({
		enabled: !createdOrganization,
		initialData: initialInvitations ?? undefined,
		queryFn: async () => {
			const result = await authClient.organization.listUserInvitations();

			if (result?.error) {
				throw new Error(result.error.message ?? t("messages.loadInvitations"));
			}

			return result?.data ?? [];
		},
		queryKey: USER_INVITATIONS_QUERY_KEY,
		staleTime: 30_000,
	});

	const handleAcceptInvitation = async ({ invitationId }: { invitationId: string }) => {
		setPendingInvitationId(invitationId);

		try {
			const result = await authClient.organization.acceptInvitation({ invitationId });

			if (result?.error) {
				throw new Error(result.error.message ?? t("messages.acceptInvitation"));
			}

			await queryClient.invalidateQueries({ queryKey: USER_INVITATIONS_QUERY_KEY });
			router.replace(redirectPath);
		} catch {
			toast.error(t("messages.acceptInvitation"));
			setPendingInvitationId(null);
		}
	};

	const handleCreateOrganization = async (business: OnboardingBusiness) => {
		setIsCreating(true);

		try {
			const result = createdOrganization
				? { data: createdOrganization, error: null }
				: await createOrganization(business.name);

			if (result?.error || !result?.data) {
				setIsCreating(false);

				return t("messages.createOrganization");
			}

			const organization = result.data;
			setCreatedOrganization({ id: organization.id, name: organization.name });

			if (organization.name !== business.name) {
				const updated = await authClient.organization.update({
					data: { name: business.name },
					organizationId: organization.id,
				});

				if (updated.error) {
					throw new Error("Organization update failed");
				}

				setCreatedOrganization({ id: organization.id, name: business.name });
			}

			const active = await setActiveOrganization({ organizationId: organization.id });

			if (active?.error) {
				throw new Error("Organization activation failed");
			}

			const website = await queryClient.query(apiClient.websites.get.queryOptions({ staleTime: 0 }));

			if (!website?.snapshot && (!website?.workflow || website.workflow.state === "failed")) {
				await generation.mutateAsync({ brief: { ...business, schemaVersion: 1 } });
				queryClient.removeQueries({ queryKey: apiClient.websites.get.key() });
			}

			router.replace("/dashboard/website");

			return null;
		} catch (error) {
			setIsCreating(false);

			return error instanceof ORPCError && error.code === "IMPLAUSIBLE_BRIEF"
				? t("messages.implausibleBrief")
				: t("messages.setupFailed");
		}
	};

	return {
		handleAcceptInvitation,
		handleCreateOrganization,
		hasInvitationLoadError: !createdOrganization && Boolean(invitationsError),
		invitations: createdOrganization ? [] : (invitationsData ?? []),
		isAcceptingInvitation: pendingInvitationId !== null,
		isCreating,
		isLoadingInvitations: !createdOrganization && isInvitationsPending,
		pendingInvitationId,
		retryInvitationLoad: refetchInvitations,
	};
};

export type OnboardingController = ReturnType<typeof useOnboardingController>;
