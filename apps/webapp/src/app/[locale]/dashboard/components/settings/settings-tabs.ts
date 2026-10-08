"use client";

import type { ComponentType } from "react";

import {
	Building03Icon,
	CommandLineIcon,
	ComputerIcon,
	Notification03Icon,
	UserGroupIcon,
	UserIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import type { Settings } from "@/hooks/use-settings";

import { DevelopersTab } from "./developers-tab";
import { DisplayTab } from "./display-tab";
import { NotificationsTab } from "./notifications-tab";
import { OrganizationMembers } from "./organization-members";
import { OrganizationTab } from "./organization-tab";
import { ProfileTab } from "./profile-tab";

export type SettingsTabConfig = {
	component: ComponentType;
	icon: IconSvgElement;
	label: string;
	name: Exclude<Settings, "list">;
};

export const useSettingsTabs = () => {
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
	] satisfies Array<SettingsTabConfig>;
};
