"use client";

import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { useSettings } from "@/hooks/use-settings";
import { Button } from "@starter/ui/components/button";
import { ScrollArea } from "@starter/ui/components/scroll-area";

import { SettingsNav } from "./settings-nav";
import { useSettingsTabs } from "./settings-tabs";

export const MobileSettings = () => {
	const tabs = useSettingsTabs();
	const [activeSetting, setActiveSetting] = useSettings();
	const t = useTranslations("breadcrumbs");
	const isListView = !activeSetting || activeSetting === "list";
	const activeTab = isListView ? null : tabs.find((tab) => tab.name === activeSetting);

	return (
		<div className='flex min-h-0 flex-1 flex-col'>
			{activeTab ? (
				<ScrollArea className='flex-1' key={activeSetting}>
					<div className='flex flex-col gap-4 px-4 pb-4'>
						<Button
							className='-ms-2 w-fit'
							onClick={() => setActiveSetting("list")}
							size='sm'
							type='button'
							variant='ghost'
						>
							<HugeiconsIcon
								aria-hidden
								className='scale-110'
								icon={ArrowLeft02Icon}
								strokeWidth={1.75}
							/>
							{t("settings")}
						</Button>
						<activeTab.component />
					</div>
				</ScrollArea>
			) : (
				<div className='flex h-full flex-col bg-sidebar'>
					<p className='px-6 pb-2 pt-4 text-2xl font-semibold text-sidebar-foreground'>{t("settings")}</p>
					<SettingsNav tabs={tabs} />
				</div>
			)}
		</div>
	);
};
