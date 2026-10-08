"use client";

import { useEffect } from "react";

import { log } from "evlog/next/client";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";

import { toast } from "@starter/ui/components/toaster";

type MutableReference<Value> = { value: Value };

export const ErrorToaster = () => {
	const t = useTranslations("common");
	const [error, setError] = useQueryState("error", parseAsString);

	useEffect(() => {
		const timeoutIdReference: MutableReference<NodeJS.Timeout | null> = { value: null };

		if (error) {
			log.info({
				error,
				message: "Showing URL error toast",
			});

			timeoutIdReference.value = setTimeout(() => {
				toast.error(t("messages.somethingWentWrong"));
				setError(null);
			}, 1500);
		}

		return () => {
			if (timeoutIdReference.value) {
				clearTimeout(timeoutIdReference.value);
			}
		};
	}, [error, setError, t]);

	return null;
};
