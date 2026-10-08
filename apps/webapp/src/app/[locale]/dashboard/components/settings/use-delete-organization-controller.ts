"use client";

import { useReducer } from "react";

import { useTranslations } from "next-intl";

import { authClient } from "@/lib/auth-client";
import { toast } from "@starter/ui/components/toaster";

type DeleteOrganizationState = { confirmation: string; isDeleting: boolean; open: boolean };

type DeleteOrganizationAction =
	| { type: "set-confirmation"; value: string }
	| { type: "set-deleting"; value: boolean }
	| { type: "set-open"; value: boolean };

const deleteOrganizationReducer = (state: DeleteOrganizationState, action: DeleteOrganizationAction) => {
	switch (action.type) {
		case "set-confirmation":
			return { ...state, confirmation: action.value };
		case "set-deleting":
			return { ...state, isDeleting: action.value };
		case "set-open":
			return state.isDeleting ? state : { ...state, confirmation: "", open: action.value };
		default:
			return state;
	}
};

export const useDeleteOrganizationController = ({ organization }: { organization: { id: string; name: string } }) => {
	const t = useTranslations("settings.organization.delete");

	const [state, dispatch] = useReducer(deleteOrganizationReducer, {
		confirmation: "",
		isDeleting: false,
		open: false,
	});

	const canConfirm = state.confirmation.trim() === organization.name && !state.isDeleting;

	const handleDelete = async () => {
		if (!canConfirm) {
			return;
		}

		dispatch({ type: "set-deleting", value: true });
		const result = await authClient.organization.delete({ organizationId: organization.id });

		if (result.error) {
			dispatch({ type: "set-deleting", value: false });
			toast.error(t("error"));

			return;
		}

		window.location.assign("/dashboard");
	};

	return {
		canConfirm,
		confirmation: state.confirmation,
		handleDelete,
		isDeleting: state.isDeleting,
		open: state.open,
		setConfirmation: (value: string) => dispatch({ type: "set-confirmation", value }),
		setOpen: (value: boolean) => dispatch({ type: "set-open", value }),
	};
};
