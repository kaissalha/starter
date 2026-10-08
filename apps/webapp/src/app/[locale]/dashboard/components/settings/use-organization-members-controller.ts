"use client";

import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { authClient } from "@/lib/auth-client";
import type { OrganizationRole } from "@starter/server/permissions";
import { toast } from "@starter/ui/components/toaster";

type MemberAction =
	| { email: string; role: OrganizationRole; type: "invite" }
	| { memberId: string; role: OrganizationRole; type: "role" }
	| { id: string; type: "remove" | "cancel" | "resend" };

type MemberDialog = { type: "invite" } | { memberId: string; type: "role" };

type MemberConfirmation = { id: string; name: string; type: "remove" | "cancel" };

const fetchOptions = { throw: true } as const;

export const useOrganizationMembersController = ({
	organizationId,
	permissions,
}: {
	organizationId: string;
	permissions: ReturnType<typeof useOrganizationPermissions>;
}) => {
	const t = useTranslations("settings.team");
	const queryClient = useQueryClient();
	const [page, setPage] = useState(0);
	const [dialog, setDialog] = useState<MemberDialog | null>(null);
	const [confirmation, setConfirmation] = useState<MemberConfirmation | null>(null);
	const queryKey = ["organization-team", organizationId];

	const members = useQuery({
		enabled: permissions.can("workspace.read") && permissions.organizationId === organizationId,
		queryFn: () =>
			authClient.organization.listMembers({
				fetchOptions,
				query: { limit: 50, offset: page * 50, organizationId },
			}),
		queryKey: [...queryKey, "members", page],
	});

	const invitations = useQuery({
		enabled: permissions.can("workspace.read") && permissions.organizationId === organizationId,
		queryFn: () => authClient.organization.listInvitations({ fetchOptions, query: { organizationId } }),
		queryKey: [...queryKey, "invitations"],
	});

	const memberList =
		members.data?.members.map((member) => {
			const editable = member.role === "admin" || member.role === "member";

			return {
				...member,
				canManage: editable && permissions.can("member.update"),
				canRemove:
					editable &&
					permissions.can("member.delete") &&
					!!permissions.userId &&
					member.userId !== permissions.userId,
			};
		}) ?? [];

	const mutation = useMutation({
		mutationFn: async (action: MemberAction) => {
			if (permissions.organizationId !== organizationId) {
				throw new Error(t("failed"));
			}

			switch (action.type) {
				case "invite":
				case "resend": {
					const invitation =
						action.type === "invite"
							? action
							: invitations.data?.find((item) => item.id === action.id && item.status === "pending");

					if (
						!permissions.can("invitation.create") ||
						!invitation ||
						(invitation.role !== "admin" && invitation.role !== "member")
					) {
						throw new Error(t("failed"));
					}

					return authClient.organization.inviteMember({
						email: invitation.email.trim().toLowerCase(),
						fetchOptions,
						organizationId,
						resend: action.type === "resend",
						role: invitation.role,
					});
				}

				case "role": {
					const member = memberList.find((item) => item.id === action.memberId);

					if (!member || !member.canManage || (action.role !== "admin" && action.role !== "member")) {
						throw new Error(t("failed"));
					}

					return authClient.organization.updateMemberRole({
						fetchOptions,
						memberId: action.memberId,
						organizationId,
						role: action.role,
					});
				}

				case "remove": {
					const member = memberList.find((item) => item.id === action.id);

					if (!member || !member.canRemove) {
						throw new Error(t("failed"));
					}

					return authClient.organization.removeMember({
						fetchOptions,
						memberIdOrEmail: action.id,
						organizationId,
					});
				}

				case "cancel": {
					if (!permissions.can("invitation.cancel")) {
						throw new Error(t("failed"));
					}

					return authClient.organization.cancelInvitation({ fetchOptions, invitationId: action.id });
				}
			}
		},
		onError: () => toast.error(t("failed")),
		onSuccess: async (_, action) => {
			setDialog(null);
			setConfirmation(null);
			toast.success(t(action.type === "invite" || action.type === "resend" ? "sent" : "saved"));
			await queryClient.invalidateQueries({ queryKey });
		},
	});

	return {
		confirmation,
		dialog,
		invitations,
		memberList,
		members,
		mutation,
		page,
		permissions,
		setConfirmation,
		setDialog,
		setPage,
	};
};
