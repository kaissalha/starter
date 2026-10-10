"use client";

import {
	ArrowLeft02Icon,
	Building03Icon,
	CommandLineIcon,
	ComputerIcon,
	Logout05Icon,
	Notification03Icon,
	UserGroupIcon,
	UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { useSettings } from "@/hooks/use-settings";
import { useSignOut } from "@/hooks/use-sign-out";
import { Button } from "@starter/ui/components/button";
import { ScrollArea } from "@starter/ui/components/scroll-area";

import { DevelopersTab } from "./developers-tab";
import { DisplayTab } from "./display-tab";
import { NotificationsTab } from "./notifications-tab";
import { OrganizationMembers } from "./organization-members";
import { OrganizationTab } from "./organization-tab";
import { ProfileTab } from "./profile-tab";

const useSettingsTabs = () => {
	const t = useTranslations("settings");

	return [
		{ component: ProfileTab, icon: UserIcon, label: t("tabs.profile"), name: "profile" },
		{ component: DisplayTab, icon: ComputerIcon, label: t("tabs.display"), name: "display" },
		{ component: OrganizationTab, icon: Building03Icon, label: t("tabs.organization"), name: "organization" },
		{ component: OrganizationMembers, icon: UserGroupIcon, label: t("tabs.team"), name: "team" },
		{
			component: NotificationsTab,
			icon: Notification03Icon,
			label: t("tabs.notifications"),
			name: "notifications",
		},
		{ component: DevelopersTab, icon: CommandLineIcon, label: t("tabs.developers"), name: "developers" },
	] as const;
};

const SettingsNav = ({ tabs }: { tabs: ReturnType<typeof useSettingsTabs> }) => {
	const [activeSetting, setActiveSetting] = useSettings();
	const t = useTranslations("account");
	const handleSignOut = useSignOut();

	return (
		<nav className='flex flex-1 flex-col overflow-y-auto'>
			<ul className='flex flex-1 flex-col gap-0.5 px-2 py-1'>
				{tabs.map((tab) => (
					<li key={tab.name}>
						<Button
							aria-current={activeSetting === tab.name ? "page" : undefined}
							className='w-full justify-start'
							onClick={() => setActiveSetting(tab.name)}
							type='button'
							variant={activeSetting === tab.name ? "secondary" : "ghost"}
						>
							<HugeiconsIcon
								aria-hidden='true'
								className='scale-110'
								icon={tab.icon}
								strokeWidth={1.75}
							/>
							<span>{tab.label}</span>
						</Button>
					</li>
				))}
			</ul>
			<ul className='px-2 py-2'>
				<li>
					<Button
						className='h-auto w-full justify-start'
						onClick={handleSignOut}
						type='button'
						variant='ghost'
					>
						<HugeiconsIcon
							aria-hidden='true'
							className='scale-110'
							icon={Logout05Icon}
							strokeWidth={1.75}
						/>
						<span>{t("logout")}</span>
					</Button>
				</li>
			</ul>
		</nav>
	);
};

export const SettingsPanels = ({ isMobile }: { isMobile: boolean }) => {
	const tabs = useSettingsTabs();
	const [activeSetting, setActiveSetting] = useSettings();
	const t = useTranslations("breadcrumbs");
	const activeTab = tabs.find((tab) => tab.name === activeSetting);

	if (!isMobile) {
		return (
			<div className='flex max-h-full overflow-hidden'>
				<aside className='flex h-full w-50 flex-col bg-sidebar'>
					<div className='px-4 py-5'>
						<p className='px-2 text-sm font-semibold text-sidebar-foreground'>{t("settings")}</p>
					</div>
					<SettingsNav tabs={tabs} />
				</aside>
				<div className='flex flex-1 flex-col'>
					<ScrollArea className='flex flex-1 flex-col'>
						<div className='p-10 pb-24'>{activeTab && <activeTab.component />}</div>
					</ScrollArea>
				</div>
			</div>
		);
	}

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
