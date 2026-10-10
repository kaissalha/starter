"use client";

import { useState, useSyncExternalStore } from "react";

import { useSearchParams } from "next/navigation";

import { AnimatePresence, LazyMotion, domAnimation, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useLocale, useTranslations } from "next-intl";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { Logo } from "@/components/logo";
import { useAuthLoginFlowStore } from "@/hooks/auth-login-flow-store";
import { Link } from "@/i18n/navigation";
import { defaultLocale } from "@/i18n/routing";
import { localizedPath } from "@/i18n/utils/localized-path";
import { authClient } from "@/lib/auth-client";
import { getLoginRedirect } from "@/utils/get-login-redirect";
import { Button } from "@starter/ui/components/button";
import { toast } from "@starter/ui/components/toaster";

import { EmailLoginForm } from "./components/email-login-form";
import { LastUsedLoginMethod } from "./components/last-used-login-method";
import { LoginGoogleButton } from "./components/login-google-button";
import { LoginVideoBackground } from "./components/login-video-background";
import { OTPVerificationForm } from "./components/otp-verification-form";

const subscribeToLastLoginMethod = () => () => undefined;

const enter = {
	opacity: 1,
	transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const },
	y: 0,
};

export const LoginPageClient = () => {
	const t = useTranslations("account.login");
	const locale = useLocale();
	const searchParams = useSearchParams();

	const redirectUrl =
		getLoginRedirect(searchParams.get("redirect_url")) ??
		localizedPath({ defaultLocale, locale, pathname: "/dashboard" });

	const lastLoginMethod = useSyncExternalStore(
		subscribeToLastLoginMethod,
		() => authClient.getLastUsedLoginMethod(),
		() => null
	);

	const [isEmailPath, setIsEmailPath] = useState(false);

	const { beginOtp, email, isOtpSent, otpSentAt, reset } = useAuthLoginFlowStore((s) => ({
		beginOtp: s.beginOtp,
		email: s.email,
		isOtpSent: s.isOtpSent,
		otpSentAt: s.otpSentAt,
		reset: s.reset,
	}));

	const reduceMotion = useReducedMotion();
	const initial = { opacity: 0, y: reduceMotion ? 0 : 8 };

	const exit = {
		opacity: 0,
		transition: { duration: 0.14, ease: [0.22, 1, 0.36, 1] as const },
		y: reduceMotion ? 0 : -4,
	};

	const handleEmailSubmit = async (submittedEmail: string) => {
		try {
			await authClient.emailOtp.sendVerificationOtp({
				email: submittedEmail,
				fetchOptions: { throw: true },
				type: "sign-in",
			});
			beginOtp({ email: submittedEmail });
		} catch {
			toast.error(t("messages.emailFailed"));
		}
	};

	return (
		<div className='bg-background relative flex min-h-dvh'>
			<header className='pointer-events-none fixed inset-inline-0 top-0 z-50 w-full'>
				<div className='relative flex items-center px-4 py-3 sm:px-4 md:px-4 lg:px-4 xl:py-4 xl:px-6 2xl:px-8'>
					<Link
						aria-label={t("homeLink")}
						className='pointer-events-auto flex items-center gap-2 transition-opacity duration-200 hover:opacity-80 active:opacity-80'
						href='/'
						prefetch={true}
					>
						<div className='h-6 w-6'>
							<Logo className='text-foreground h-full w-full size-8' />
						</div>
					</Link>
				</div>
			</header>

			<div className='flex w-full flex-col items-center justify-center p-8 pb-2 lg:w-1/2 lg:p-12'>
				<div className='flex h-full w-full max-w-md flex-col'>
					<div className='flex flex-1 flex-col justify-center space-y-8'>
						<LazyMotion features={domAnimation} strict>
							<AnimatePresence initial={false} mode='wait'>
								{isOtpSent ? (
									<m.div animate={enter} exit={exit} initial={initial} key='otp'>
										<OTPVerificationForm
											email={email}
											onBack={reset}
											otpSentAt={otpSentAt}
											redirectUrl={redirectUrl}
										/>
									</m.div>
								) : (
									<m.div
										animate={enter}
										className='space-y-8'
										exit={exit}
										initial={initial}
										key='methods'
									>
										<div className='space-y-1 text-center'>
											<h1 className='text-foreground font-sans text-2xl font-semibold tracking-tight text-balance sm:text-3xl'>
												{t("heroTitle")}
											</h1>
											<p className='text-muted-foreground font-sans text-sm'>
												{t("heroSubtitle")}
											</p>
										</div>

										<div className='w-full space-y-3'>
											<LoginGoogleButton
												lastLoginMethod={lastLoginMethod}
												redirectUrl={redirectUrl}
											/>
											<AnimatePresence initial={false} mode='wait'>
												{isEmailPath ? (
													<m.div
														animate={enter}
														exit={exit}
														initial={initial}
														key='email-form'
													>
														<EmailLoginForm
															onBack={() => setIsEmailPath(false)}
															onEmailSubmit={handleEmailSubmit}
														/>
													</m.div>
												) : (
													<m.div
														animate={enter}
														exit={exit}
														initial={initial}
														key='email-cta'
													>
														<Button
															className='grid w-full grid-cols-[1fr_auto_1fr]'
															onClick={() => {
																setIsEmailPath(true);
															}}
															size='xl'
															type='button'
															variant='outline'
														>
															<span aria-hidden />
															<span>{t("emailCta")}</span>
															<LastUsedLoginMethod
																activeMethod={lastLoginMethod}
																method='email'
															/>
														</Button>
													</m.div>
												)}
											</AnimatePresence>
										</div>
									</m.div>
								)}
							</AnimatePresence>
						</LazyMotion>
					</div>

					<div className='mt-auto flex flex-col items-center gap-4 text-center'>
						<p className='text-muted-foreground font-sans text-xs leading-relaxed'>
							{t("legal.acknowledge")}{" "}
							<Link
								className='text-muted-foreground underline transition-colors hover:text-foreground'
								href='/terms'
								prefetch={true}
							>
								{t("legal.termsPath")}
							</Link>
							{t("legal.betweenClauses")}
							<Link
								className='text-muted-foreground underline transition-colors hover:text-foreground'
								href='/privacy'
								prefetch={true}
							>
								{t("legal.privacyPath")}
							</Link>
							{t("legal.ending")}
						</p>
						<LocaleSwitcher />
					</div>
				</div>
			</div>

			<LoginVideoBackground />
		</div>
	);
};
