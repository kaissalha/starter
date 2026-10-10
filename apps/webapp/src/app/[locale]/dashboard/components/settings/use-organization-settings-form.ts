"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";

import { authClient } from "@/lib/auth-client";
import { toast } from "@starter/ui/components/toaster";

type EditableOrganization = {
	id: string;
	logo?: string | null;
	name: string;
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
	const [name, setName] = useState(organization.name);
	const [isSaving, setIsSaving] = useState(false);
	const hasChanges = name.trim() !== organization.name;
	const isValid = name.trim().length > 0;

	const handleSave = async () => {
		if (!canEdit || !isValid || !hasChanges) {
			return;
		}

		setIsSaving(true);

		const nextName = name.trim();

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
			setIsSaving(false);
		}
	};

	return {
		canSave: canEdit && hasChanges && isValid,
		handleSave,
		isSaving,
		name,
		setName,
	};
};
