"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";

import { authClient } from "@/lib/auth-client";
import { Button } from "@starter/ui/components/button";
import { toast } from "@starter/ui/components/toaster";

import { GoogleColoredMark } from "./google-colored-mark";
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
			<GoogleColoredMark className='justify-self-start' />
			<span>{t("withGoogle")}</span>
			<LastUsedLoginMethod activeMethod={lastLoginMethod} method='google' />
		</Button>
	);
};
