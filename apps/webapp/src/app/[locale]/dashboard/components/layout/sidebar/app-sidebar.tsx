import type * as React from "react";

import { useTranslations } from "next-intl";

import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@starter/ui/components/sidebar";

import { AppSidebarHeader } from "./app-sidebar-header";
import { NavMain } from "./nav-main";
import { NavSecondary } from "./nav-secondary";

export const AppSidebar = (props: React.ComponentProps<typeof Sidebar>) => {
	const t = useTranslations("common");

	return (
		<Sidebar aria-label={t("navigation")} collapsible='icon' purpose='navigation' {...props}>
			<SidebarHeader variant='navigation'>
				<AppSidebarHeader />
			</SidebarHeader>
			<SidebarContent variant='navigation'>
				<NavMain />
			</SidebarContent>
			<SidebarFooter className='relative' variant='navigation'>
				<div className='pointer-events-none absolute inset-inline-0 top-0 hidden h-10 w-full -translate-y-full bg-linear-to-b from-transparent to-sidebar max-md:block' />
				<div className='absolute inset-inline-0 top-0 hidden border-t border-sidebar-border max-md:block' />
				<NavSecondary />
			</SidebarFooter>
		</Sidebar>
	);
};
