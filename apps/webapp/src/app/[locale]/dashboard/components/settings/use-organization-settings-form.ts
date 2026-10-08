"use client";

import { useReducer } from "react";

import { useTranslations } from "next-intl";

import { authClient } from "@/lib/auth-client";
import { toast } from "@starter/ui/components/toaster";

type OrganizationSettingsState = {
	isSaving: boolean;
	name: string;
};

type OrganizationSettingsAction = { type: "set-name"; value: string } | { type: "set-saving"; value: boolean };

type EditableOrganization = {
	id: string;
	logo?: string | null;
	name: string;
};

const createInitialState = ({ organization }: { organization: EditableOrganization }): OrganizationSettingsState => ({
	isSaving: false,
	name: organization.name,
});

const organizationSettingsReducer = (state: OrganizationSettingsState, action: OrganizationSettingsAction) => {
	switch (action.type) {
		case "set-name":
			return {
				...state,
				name: action.value,
			};
		case "set-saving":
			return {
				...state,
				isSaving: action.value,
			};
		default:
			return state;
	}
};

export const useOrganizationSettingsForm = ({
	canEdit,
	organization,
}: {
	canEdit: boolean;
	organization: EditableOrganization;
}) => {
	const t = useTranslations("settings.organization");
	const tCommon = useTranslations("common");
	const [state, dispatch] = useReducer(organizationSettingsReducer, { organization }, createInitialState);
	const hasChanges = state.name.trim() !== organization.name;
	const isValid = state.name.trim().length > 0;

	const setName = (value: string) => {
		dispatch({ type: "set-name", value });
	};

	const handleSave = async () => {
		if (!canEdit || !isValid || !hasChanges) {
			return;
		}

		dispatch({ type: "set-saving", value: true });

		const nextName = state.name.trim();

		try {
			const result = await authClient.organization.update({
				data: { name: nextName },
				organizationId: organization.id,
			});

			if (result.error) {
				if (result.error.code === "YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_ORGANIZATION") {
					toast.error(t("messages.forbidden"));

					return;
				}

				toast.error(tCommon("saveError"));

				return;
			}

			toast.success(tCommon("saved"));
		} catch {
			toast.error(tCommon("saveError"));
		} finally {
			dispatch({ type: "set-saving", value: false });
		}
	};

	return {
		canSave: canEdit && hasChanges && isValid,
		handleSave,
		isSaving: state.isSaving,
		name: state.name,
		setName,
	};
};
