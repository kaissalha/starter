"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { authClient, setActiveOrganization, signOut } from "@/lib/auth-client";
import { toast } from "@starter/ui/components/toaster";

type InvitationAction = "accept" | "reject" | "signOut";

export const useInvitationController = ({
	canRespond,
	invitationId,
}: {
	canRespond: boolean;
	invitationId: string;
}) => {
	const t = useTranslations("acceptInvitation");
	const router = useRouter();
	const [pending, setPending] = useState<InvitationAction | null>(null);
	const [error, setError] = useState<`${InvitationAction}Error` | "activateError" | null>(null);
	const [acceptedOrganizationId, setAcceptedOrganizationId] = useState<string | null>(null);

	const respond = async (action: InvitationAction) => {
		if (
			pending ||
			(action !== "signOut" && !canRespond && !acceptedOrganizationId) ||
			(action === "reject" && acceptedOrganizationId)
		) {
			return;
		}

		setPending(action);
		setError(null);

		try {
			if (action === "signOut") {
				const result = await signOut();

				if (result.error) {
					throw new Error(result.error.message);
				}

				router.replace(`/login?redirect_url=${encodeURIComponent(window.location.pathname)}`);

				return;
			}

			if (action === "reject") {
				await authClient.organization.rejectInvitation({ fetchOptions: { throw: true }, invitationId });
				toast.success(t("rejected"));
				router.replace("/dashboard");

				return;
			}

			const organizationId =
				acceptedOrganizationId ??
				(await authClient.organization.acceptInvitation({ fetchOptions: { throw: true }, invitationId }))
					.invitation.organizationId;

			setAcceptedOrganizationId(organizationId);

			try {
				const result = await setActiveOrganization({ organizationId });

				if (result.error) {
					throw new Error(result.error.message);
				}
			} catch {
				setError("activateError");

				return;
			}

			toast.success(t("success"));
			router.replace("/dashboard");
		} catch {
			setError(`${action}Error`);
		} finally {
			setPending(null);
		}
	};

	return { acceptedOrganizationId, error, pending, respond };
};
