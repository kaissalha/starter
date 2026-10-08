"use client";

import {
	Analytics01Icon,
	FolderLibraryIcon,
	News01Icon,
	PanelsTopLeftIcon,
	Home03Icon,
	Link04Icon,
	Search01Icon,
	UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { SidebarGroup, SidebarMenu, useSidebar } from "@starter/ui/components/sidebar";

import { NavItem } from "./nav-item";
import { useIsMenuItemActive } from "./utils/use-is-menu-item-active";

export const NavMain = () => {
	const t = useTranslations();
	const { isMenuItemActive } = useIsMenuItemActive();
	const { isMobile, setOpenMobile } = useSidebar("navigation");

	const items = [
		{
			icon: Home03Icon,
			title: t("breadcrumbs.home"),
			url: "/dashboard" as const,
		},
		{
			icon: PanelsTopLeftIcon,
			title: t("breadcrumbs.website"),
			url: "/dashboard/website" as const,
		},
		{
			icon: Link04Icon,
			title: t("breadcrumbs.links"),
			url: "/dashboard/links" as const,
		},
		{ icon: Search01Icon, title: t("breadcrumbs.seoGeo"), url: "/dashboard/seo-geo" as const },
		{ icon: UserCircleIcon, title: t("breadcrumbs.contacts"), url: "/dashboard/contacts" as const },
		{ icon: News01Icon, title: t("breadcrumbs.blog"), url: "/dashboard/blog" as const },
		{ icon: FolderLibraryIcon, title: t("breadcrumbs.library"), url: "/dashboard/library" as const },
		{ icon: Analytics01Icon, title: t("breadcrumbs.analytics"), url: "/dashboard/analytics" as const },
	];

	return (
		<SidebarGroup>
			<SidebarMenu>
				{items.map((item) => {
					const isActive = isMenuItemActive(item.url, item.url === "/dashboard");

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
