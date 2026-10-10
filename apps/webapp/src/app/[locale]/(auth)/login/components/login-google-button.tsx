"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";

import { authClient } from "@/lib/auth-client";
import { Button } from "@starter/ui/components/button";
import { toast } from "@starter/ui/components/toaster";

import { LastUsedLoginMethod } from "./last-used-login-method";

type LoginGoogleButtonProps = {
	lastLoginMethod: string | null;
	redirectUrl: string;
};

export const LoginGoogleButton = ({ lastLoginMethod, redirectUrl }: LoginGoogleButtonProps) => {
	const t = useTranslations("account.login");
	const tCommon = useTranslations("common");
	const [isLoading, setIsLoading] = useState(false);

	return (
		<Button
			className='grid w-full grid-cols-[1fr_auto_1fr]'
			loading={isLoading}
			onClick={async () => {
				setIsLoading(true);

				try {
					await authClient.signIn.social({
						callbackURL: redirectUrl,
						fetchOptions: { throw: true },
						newUserCallbackURL: redirectUrl,
						provider: "google",
					});
				} catch {
					toast.error(tCommon("messages.somethingWentWrong"));
				} finally {
					setIsLoading(false);
				}
			}}
			size='xl'
			type='button'
			variant='default'
		>
			<svg
				aria-hidden
				className='size-4 shrink-0 justify-self-start'
				viewBox='0 0 24 24'
				xmlns='http://www.w3.org/2000/svg'
			>
				<path
					d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
					fill='#4285F4'
				/>
				<path
					d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
					fill='#34A853'
				/>
				<path
					d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
					fill='#FBBC05'
				/>
				<path
					d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
					fill='#EA4335'
				/>
			</svg>
			<span>{t("withGoogle")}</span>
			<LastUsedLoginMethod activeMethod={lastLoginMethod} method='google' />
		</Button>
	);
};
