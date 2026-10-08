"use client";

import { useEffect, useState, type FormEvent } from "react";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useForm as useHookForm, useWatch } from "react-hook-form";
import { z } from "zod";

export type OnboardingBusiness = { location: string; name: string; type: string };

const businessFields = ["name", "location", "type"] as const;

export const useCreateOrganizationForm = ({
	initialBusiness,
	onCreate,
}: {
	initialBusiness?: OnboardingBusiness;
	onCreate: (business: OnboardingBusiness) => Promise<string | null>;
}) => {
	const t = useTranslations("onboarding");
	const [step, setStep] = useState(0);
	const fieldName = businessFields[step] ?? "name";

	const form = useHookForm<OnboardingBusiness>({
		defaultValues: initialBusiness ?? { location: "", name: "", type: "" },
		mode: "onChange",
		resolver: standardSchemaResolver(
			z.object({
				location: z
					.string()
					.max(200, t("messages.locationTooLong"))
					.refine((value) => value.trim().length > 0, t("messages.invalidLocation")),
				name: z
					.string()
					.max(100, t("messages.nameTooLong"))
					.refine((value) => value.trim().length > 0, t("messages.invalidName")),
				type: z
					.string()
					.max(120, t("messages.typeTooLong"))
					.refine((value) => value.trim().length > 0, t("messages.invalidType")),
			})
		),
	});

	const answer = useWatch({ control: form.control, name: fieldName });
	const { getValues, setFocus, setValue } = form;
	useEffect(() => {
		setFocus(fieldName);
	}, [fieldName, setFocus]);
	useEffect(() => {
		try {
			const draft = sessionStorage.getItem("hero-prompt-draft");
			sessionStorage.removeItem("hero-prompt-draft");

			if (draft && !initialBusiness && getValues("type") === "") {
				setValue("type", draft);
			}
		} catch {}
	}, [getValues, initialBusiness, setValue]);

	const submit = form.handleSubmit(async ({ location, name, type }) => {
		const submissionError = await onCreate({ location: location.trim(), name: name.trim(), type: type.trim() });

		if (submissionError) {
			form.setError("root", { message: submissionError });
		}
	});

	const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
		event?.preventDefault();

		if (step === businessFields.length - 1) {
			await submit();
		} else if (await form.trigger(fieldName)) {
			setStep(step + 1);
		}
	};

	return {
		back: () => setStep(Math.max(0, step - 1)),
		canContinue: answer.trim().length > 0,
		fieldName,
		form,
		handleSubmit,
		step,
	};
};
