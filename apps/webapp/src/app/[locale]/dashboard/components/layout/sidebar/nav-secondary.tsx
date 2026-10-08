"use client";

import { Logout05Icon, Settings01Icon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { useSettings } from "@/hooks/use-settings";
import { useSignOut } from "@/hooks/use-sign-out";
import { SidebarGroup, SidebarMenu, useSidebar } from "@starter/ui/components/sidebar";

import { NotificationBell } from "../../notifications/notification-bell";
import { NavItem } from "./nav-item";

type ActionMenuItem = {
	icon: IconSvgElement;
	key: string;
	onClick: () => void | Promise<void>;
	title: string;
};

export const NavSecondary = () => {
	const t = useTranslations();
	const { isMobile, setOpenMobile } = useSidebar("navigation");
	const [, setActiveSetting] = useSettings();
	const handleSignOut = useSignOut();

	const items: Array<ActionMenuItem> = [
		{
			icon: Settings01Icon,
			key: "settings",
			onClick: () => setActiveSetting("list"),
			title: t("breadcrumbs.settings"),
		},
		{
			icon: Logout05Icon,
			key: "logout",
			onClick: handleSignOut,
			title: t("account.logout"),
		},
	];

	const handleActionItemClick = (item: ActionMenuItem) => {
		item.onClick();

		if (isMobile) {
			setOpenMobile(false);
		}
	};

	return (
		<SidebarGroup>
			<SidebarMenu>
				<NotificationBell />
				{items.map((item) => {
					return (
						<NavItem
							aria-label={item.title}
							icon={item.icon}
							key={item.key}
							onClick={() => handleActionItemClick(item)}
							title={item.title}
						/>
					);
				})}
			</SidebarMenu>
		</SidebarGroup>
	);
};
