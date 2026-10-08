import type { ComponentProps } from "react";

import { HugeiconsIcon } from "@hugeicons/react";

import { SidebarMenuButton, SidebarMenuItem } from "@starter/ui/components/sidebar";

export const NavItem = ({
	icon,
	title,
	...props
}: ComponentProps<typeof SidebarMenuButton> & {
	icon: ComponentProps<typeof HugeiconsIcon>["icon"];
	title: string;
}) => (
	<SidebarMenuItem>
		<SidebarMenuButton {...props} tooltip={title}>
			<HugeiconsIcon aria-hidden='true' className='scale-110' icon={icon} strokeWidth={1.75} />
			<span data-sidebar-label>{title}</span>
		</SidebarMenuButton>
	</SidebarMenuItem>
);
