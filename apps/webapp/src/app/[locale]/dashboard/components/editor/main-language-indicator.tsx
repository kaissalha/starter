"use client";

import { StarIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { Tooltip, TooltipPopup, TooltipTrigger } from "@starter/ui/components/tooltip";

export const MainLanguageIndicator = () => {
	const t = useTranslations("website.languages");

	return (
		<Tooltip>
			<TooltipTrigger render={<span aria-label={t("main")} className='inline-flex shrink-0' role='img' />}>
				<HugeiconsIcon
					aria-hidden='true'
					className='size-4 scale-110 fill-warning [&_path]:stroke-none'
					icon={StarIcon}
					strokeWidth={1.75}
				/>
			</TooltipTrigger>
			<TooltipPopup>{t("main")}</TooltipPopup>
		</Tooltip>
	);
};
