"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@starter/ui/components/badge";
import { cn } from "@starter/ui/lib/utils";

type LastUsedLoginMethodProps = {
	activeMethod: string | null;
	method: "email" | "google";
};

export const LastUsedLoginMethod = ({ activeMethod, method }: LastUsedLoginMethodProps) => {
	const t = useTranslations("account.login");
	const isLastUsed = activeMethod === method;

	return (
		<Badge
			aria-hidden={!isLastUsed}
			className={cn("justify-self-end", !isLastUsed && "invisible")}
			variant='secondary'
		>
			{t("lastUsed")}
		</Badge>
	);
};
