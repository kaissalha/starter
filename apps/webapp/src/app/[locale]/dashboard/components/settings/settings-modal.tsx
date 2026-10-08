"use client";

import dynamic from "next/dynamic";

import { useTranslations } from "next-intl";

import { useSettings } from "@/hooks/use-settings";
import {
	Credenza,
	CredenzaContent,
	CredenzaDescription,
	CredenzaHeader,
	CredenzaTitle,
} from "@starter/ui/components/credenza";
import { useIsMobile } from "@starter/ui/hooks/use-is-mobile";

const DesktopSettings = dynamic(async () => (await import("./desktop-settings")).DesktopSettings);

const MobileSettings = dynamic(async () => (await import("./mobile-settings")).MobileSettings);

export const SettingsModal = () => {
	const t = useTranslations("breadcrumbs");
	const tCommon = useTranslations("common");
	const [activeSetting, setActiveSetting] = useSettings();
	const isMobile = useIsMobile();

	return (
		<Credenza onOpenChange={(open) => !open && setActiveSetting(null)} open={!!activeSetting}>
			<CredenzaContent
				aria-label={t("settings")}
				className='h-160 max-h-[90dvh] w-240 max-w-full overflow-hidden sm:max-w-full md:max-w-[90vw]'
				closeLabel={tCommon("close")}
				padding='none'
			>
				<CredenzaHeader className='sr-only'>
					<CredenzaTitle>{t("settings")}</CredenzaTitle>
					<CredenzaDescription>{t("settings")}</CredenzaDescription>
				</CredenzaHeader>
				{isMobile ? <MobileSettings /> : <DesktopSettings />}
			</CredenzaContent>
		</Credenza>
	);
};
