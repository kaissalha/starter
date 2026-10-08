"use client";

import { Cancel01Icon, PanelLeftIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { Logo } from "@/components/logo";
import { SidebarTrigger, useSidebar } from "@starter/ui/components/sidebar";

export const AppSidebarHeader = () => {
	const t = useTranslations("common");
	const { isMobile, open } = useSidebar("navigation");

	if (open || isMobile) {
		return (
			<div className='flex items-center justify-between gap-2'>
				<div className='flex size-8 shrink-0 items-center justify-center'>
					<Logo className='size-7 text-foreground' />
				</div>
				<SidebarTrigger
					aria-label={isMobile ? t("close") : t("toggleNavigation")}
					className='shrink-0'
					purpose='navigation'
				>
					{isMobile ? (
						<HugeiconsIcon
							aria-hidden='true'
							className='scale-110'
							icon={Cancel01Icon}
							strokeWidth={1.75}
						/>
					) : undefined}
				</SidebarTrigger>
			</div>
		);
	}

	return (
		<SidebarTrigger
			aria-label={t("toggleNavigation")}
			className='group/logo-toggle shrink-0 max-md:hidden'
			purpose='navigation'
		>
			<span aria-hidden className='grid place-items-center'>
				<Logo className='size-7 text-foreground transition-opacity duration-150 [grid-area:1/1] group-hover/logo-toggle:opacity-0 group-focus-within/logo-toggle:opacity-0' />
				<HugeiconsIcon
					aria-hidden='true'
					className='opacity-0 transition-opacity duration-150 [grid-area:1/1] group-hover/logo-toggle:opacity-100 group-focus-within/logo-toggle:opacity-100 scale-110'
					icon={PanelLeftIcon}
					strokeWidth={1.75}
				/>
			</span>
		</SidebarTrigger>
	);
};
