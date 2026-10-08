"use client";

import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { signOut } from "@/lib/auth-client";
import { toast } from "@starter/ui/components/toaster";

export const useSignOut = () => {
	const t = useTranslations("common");
	const router = useRouter();

	return async () => {
		try {
			const result = await signOut();

			if (result.error) {
				toast.error(t("messages.somethingWentWrong"));

				return;
			}

			router.push("/login");
		} catch {
			toast.error(t("messages.somethingWentWrong"));
		}
	};
};
