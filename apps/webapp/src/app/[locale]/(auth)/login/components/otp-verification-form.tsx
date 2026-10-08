"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";
import { followAuthRedirect } from "@/utils/follow-auth-redirect";
import { Button } from "@starter/ui/components/button";
import { Form } from "@starter/ui/components/form";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@starter/ui/components/input-otp";

const otpFormSchema = (invalidMessage: string) =>
	z.object({
		otp: z.string().length(6, { message: invalidMessage }).regex(/^\d+$/, { message: invalidMessage }),
	});

type OtpFormValues = z.infer<ReturnType<typeof otpFormSchema>>;

type OTPVerificationFormProps = {
	email: string;
	onBack?: () => void;
	otpSentAt: Date | null;
	redirectUrl: string;
};

export const OTPVerificationForm = ({ email, onBack, otpSentAt, redirectUrl }: OTPVerificationFormProps) => {
	const t = useTranslations("account.login");
	const tCommon = useTranslations("common");
	const format = useFormatter();
	const now = useNow({ updateInterval: 30_000 });

	const form = useForm<OtpFormValues>({
		defaultValues: { otp: "" },
		resolver: zodResolver(otpFormSchema(t("messages.invalidOtp"))),
	});

	const onSubmit = form.handleSubmit(async (values) => {
		try {
			const result = await authClient.signIn.emailOtp({
				email,
				otp: values.otp,
			});

			if (result.error) {
				form.setError("root", { message: t("messages.invalidOtp") });

				return;
			}

			if (followAuthRedirect(result.data)) {
				return;
			}

			window.location.assign(redirectUrl);
		} catch {
			form.setError("root", { message: tCommon("messages.somethingWentWrong") });
		}
	});

	return (
		<Form className='items-center justify-center' onSubmit={onSubmit}>
			<div className='space-y-2 text-center'>
				<h1 className='text-foreground mb-2 font-display text-lg text-balance lg:text-xl'>{t("titleOtp")}</h1>
				<p className='font-sans text-sm text-muted-foreground'>{t("otpDescription")}</p>
				<p className='text-foreground text-sm font-medium'>{email}</p>
				{otpSentAt ? (
					<p className='font-sans text-xs text-muted-foreground'>
						{t("otpRequestedRelative", { relativeTime: format.relativeTime(otpSentAt, now) })}
					</p>
				) : null}
			</div>

			<Controller
				control={form.control}
				name='otp'
				render={({ field: { onChange, value } }) => (
					<InputOTP
						aria-label={t("fields.otp.label")}
						containerClassName='flex items-center justify-center'
						maxLength={6}
						onChange={onChange}
						value={value}
					>
						<InputOTPGroup>
							<InputOTPSlot index={0} />
							<InputOTPSlot index={1} />
							<InputOTPSlot index={2} />
						</InputOTPGroup>
						<InputOTPSeparator />
						<InputOTPGroup>
							<InputOTPSlot index={3} />
							<InputOTPSlot index={4} />
							<InputOTPSlot index={5} />
						</InputOTPGroup>
					</InputOTP>
				)}
			/>

			{form.formState.errors.otp && (
				<p className='text-destructive text-center text-sm' role='alert'>
					{form.formState.errors.otp.message}
				</p>
			)}
			{form.formState.errors.root && (
				<p className='text-destructive text-center text-sm' role='alert'>
					{form.formState.errors.root.message}
				</p>
			)}

			<Button
				aria-busy={form.formState.isSubmitting}
				className='w-full'
				disabled={form.formState.isSubmitting}
				loading={form.formState.isSubmitting}
				size='xl'
				type='submit'
				variant='default'
			>
				{form.formState.isSubmitting ? t("verifying") : t("verify")}
			</Button>

			{onBack && (
				<Button onClick={onBack} size='sm' type='button' variant='ghost'>
					{t("backToEmail")}
				</Button>
			)}
		</Form>
	);
};
