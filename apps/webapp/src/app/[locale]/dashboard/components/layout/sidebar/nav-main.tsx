"use client";

import { Home03Icon } from "@hugeicons/core-free-icons";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { SidebarGroup, SidebarMenu, useSidebar } from "@starter/ui/components/sidebar";

import { NavItem } from "./nav-item";

export const NavMain = () => {
	const t = useTranslations();
	const pathname = usePathname();
	const { isMobile, setOpenMobile } = useSidebar("navigation");

	const items = [
		{
			icon: Home03Icon,
			title: t("breadcrumbs.home"),
			url: "/dashboard" as const,
		},
	];

	return (
		<SidebarGroup>
			<SidebarMenu>
				{items.map((item) => {
					const isActive = pathname === item.url;

					return (
						<NavItem
							icon={item.icon}
							isActive={isActive}
							key={item.title}
							render={
								<Link
									aria-current={isActive ? "page" : undefined}
									aria-label={item.title}
									href={item.url}
									onClick={() => {
										if (isMobile) {
											setOpenMobile(false);
										}
									}}
									prefetch={true}
								/>
							}
							title={item.title}
						/>
					);
				})}
			</SidebarMenu>
		</SidebarGroup>
	);
};
