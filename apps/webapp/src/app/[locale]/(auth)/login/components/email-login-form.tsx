"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import validator from "validator";
import { z } from "zod";

import type { TranslationFunction } from "@/types/translation";
import { Button } from "@starter/ui/components/button";
import { Field, FieldControl, FieldError, FieldLabel } from "@starter/ui/components/field";
import { Form } from "@starter/ui/components/form";

const loginSchema = (t: TranslationFunction<"account.login">) =>
	z.object({
		email: z
			.string()
			.min(1, { message: t("fields.email.validation.required") })
			.refine((value) => validator.isEmail(value), { message: t("fields.email.validation.invalid") }),
	});

type LoginFormValues = z.infer<ReturnType<typeof loginSchema>>;

type EmailLoginFormProps = {
	onBack?: () => void;
	onEmailSubmit: (email: string) => Promise<void>;
};

export const EmailLoginForm = ({ onBack, onEmailSubmit }: EmailLoginFormProps) => {
	const t = useTranslations("account.login");

	const form = useForm<LoginFormValues>({
		defaultValues: {
			email: "",
		},
		resolver: zodResolver(loginSchema(t)),
	});

	const isSubmitting = form.formState.isSubmitting;

	return (
		<Form onSubmit={form.handleSubmit(async (input) => onEmailSubmit(input.email))}>
			<Field name='email'>
				<FieldLabel>{t("fields.email.label")}</FieldLabel>
				<FieldControl
					{...form.register("email")}
					aria-invalid={Boolean(form.formState.errors.email)}
					aria-label={t("fields.email.label")}
					autoComplete='email'
					placeholder={t("fields.email.placeholderAlt")}
					type='email'
				/>
				{form.formState.errors.email && (
					<FieldError role='alert'>{form.formState.errors.email.message}</FieldError>
				)}
			</Field>

			<Button
				aria-busy={isSubmitting}
				className='w-full'
				disabled={isSubmitting}
				loading={isSubmitting}
				size='xl'
				type='submit'
				variant='default'
			>
				{isSubmitting ? t("signingIn") : t("emailContinue")}
			</Button>

			{onBack && (
				<div className='flex justify-center pt-1'>
					<Button onClick={onBack} size='sm' type='button' variant='ghost'>
						{t("backFromEmailStep")}
					</Button>
				</div>
			)}
		</Form>
	);
};
