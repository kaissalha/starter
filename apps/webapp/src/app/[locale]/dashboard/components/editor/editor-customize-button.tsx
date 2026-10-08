"use client";

import { PaintBoardIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { SidebarTrigger } from "@starter/ui/components/sidebar";

export const EditorCustomizeButton = ({ disabled, isMobile }: { disabled?: boolean; isMobile: boolean }) => {
	const t = useTranslations("website");

	return (
		<SidebarTrigger
			aria-label={t("sidebar.customize")}
			disabled={disabled}
			purpose='details'
			size={isMobile ? "icon" : "default"}
		>
			<HugeiconsIcon aria-hidden='true' className='scale-110' icon={PaintBoardIcon} strokeWidth={1.75} />
			{!isMobile && <span>{t("sidebar.customize")}</span>}
		</SidebarTrigger>
	);
};
