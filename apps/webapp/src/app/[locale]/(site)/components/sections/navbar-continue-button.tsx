import type { ComponentProps } from "react";

import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getServerSession } from "@/lib/server/auth";
import { Button } from "@starter/ui/components/button";

type NavbarContinueButtonProps = Pick<ComponentProps<typeof Button>, "size">;

export const NavbarContinueButtonFallback = ({ size }: NavbarContinueButtonProps) => {
	return (
		<Button aria-hidden disabled size={size}>
			<span className='h-4 w-16 animate-pulse rounded-sm bg-current/15' />
		</Button>
	);
};

export const NavbarContinueButton = async ({ size }: NavbarContinueButtonProps) => {
	const [session, t] = await Promise.all([getServerSession(), getTranslations("site.navbar")]);

	return (
		<Button
			nativeButton={false}
			render={<Link aria-label={t("continue")} href={session ? "/dashboard" : "/login"} />}
			size={size}
		>
			{t("continue")}
		</Button>
	);
};
