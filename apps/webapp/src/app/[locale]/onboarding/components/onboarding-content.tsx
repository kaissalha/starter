"use client";

import { useTranslations } from "next-intl";

import { CreateOrganizationForm } from "./create-organization-form";
import { InvitationList } from "./invitation-list";
import { OnboardingErrorState } from "./onboarding-error-state";
import { OnboardingLoadingState } from "./onboarding-loading-state";
import type { OnboardingBusiness } from "./use-create-organization-form";
import type { OnboardingController } from "./use-onboarding-controller";

export const OnboardingContent = ({
	controller,
	initialBusiness,
}: {
	controller: OnboardingController;
	initialBusiness?: OnboardingBusiness;
}) => {
	const t = useTranslations("onboarding");
	const tCommon = useTranslations("common");

	if (controller.isLoadingInvitations) {
		return <OnboardingLoadingState label={t("loadingInvitations")} />;
	}

	if (controller.hasInvitationLoadError) {
		return (
			<OnboardingErrorState
				actionLabel={tCommon("retry")}
				description={t("messages.loadInvitations")}
				onAction={() => controller.retryInvitationLoad()}
				title={t("inviteTitle")}
			/>
		);
	}

	if (controller.invitations.length > 0) {
		return (
			<InvitationList
				invitations={controller.invitations}
				isAcceptingInvitation={controller.isAcceptingInvitation}
				onAcceptInvitation={controller.handleAcceptInvitation}
				pendingInvitationId={controller.pendingInvitationId}
			/>
		);
	}

	return (
		<CreateOrganizationForm
			initialBusiness={initialBusiness}
			isCreating={controller.isCreating}
			onCreate={controller.handleCreateOrganization}
		/>
	);
};
