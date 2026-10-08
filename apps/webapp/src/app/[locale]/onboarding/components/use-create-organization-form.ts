"use client";

import { useEffect } from "react";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useForm as useHookForm, useWatch } from "react-hook-form";
import { z } from "zod";

export const useCreateOrganizationForm = ({ onCreate }: { onCreate: (name: string) => Promise<string | null> }) => {
	const t = useTranslations("onboarding");

	const form = useHookForm<{ name: string }>({
		defaultValues: { name: "" },
		mode: "onChange",
		resolver: standardSchemaResolver(
			z.object({
				name: z
					.string()
					.max(100, t("messages.nameTooLong"))
					.refine((value) => value.trim().length > 0, t("messages.invalidName")),
			})
		),
	});

	const name = useWatch({ control: form.control, name: "name" });
	const { setFocus } = form;
	useEffect(() => {
		setFocus("name");
	}, [setFocus]);

	const handleSubmit = form.handleSubmit(async (values) => {
		const submissionError = await onCreate(values.name.trim());

		if (submissionError) {
			form.setError("root", { message: submissionError });
		}
	});

	return { canContinue: name.trim().length > 0, form, handleSubmit };
};
