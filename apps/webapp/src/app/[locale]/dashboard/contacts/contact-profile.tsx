"use client";

import { Call02Icon, Mail01Icon, UserCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { DashboardDrawerHeader } from "@/app/[locale]/dashboard/components/dashboard-drawer";
import { Button } from "@starter/ui/components/button";

import type { ContactRow } from "./use-contacts-controller";

export const ContactProfile = ({ contact }: { contact: ContactRow | undefined }) => {
	const t = useTranslations("contacts");
	const name = contact?.name || contact?.email || contact?.phone;

	return (
		<DashboardDrawerHeader
			description={
				<span className='flex max-w-full flex-col items-center gap-2 text-foreground md:flex-row md:flex-wrap md:gap-x-6 md:gap-y-2 empty:hidden'>
					{(
						[
							{ field: "email", icon: Mail01Icon },
							{ field: "phone", icon: Call02Icon },
						] as const
					).map(
						({ field, icon }) =>
							contact?.[field] && (
								<span className='flex min-w-0 max-w-full items-center gap-2' key={field}>
									<HugeiconsIcon
										aria-hidden
										className='size-4 shrink-0 scale-110 text-muted-foreground'
										icon={icon}
										strokeWidth={1.75}
									/>
									<bdi className='min-w-0 break-all'>{contact[field]}</bdi>
								</span>
							)
					)}
				</span>
			}
			leading={
				name ? (
					Array.from(name)[0]?.toLocaleUpperCase()
				) : (
					<HugeiconsIcon className='size-6 scale-110' icon={UserCircleIcon} strokeWidth={1.75} />
				)
			}
			title={name || t("contact")}
		>
			{(contact?.email || contact?.phone) && (
				<div className='flex flex-wrap justify-center gap-3 md:justify-start md:gap-2'>
					{(
						[
							{ field: "email", icon: Mail01Icon, label: "message", scheme: "mailto" },
							{ field: "phone", icon: Call02Icon, label: "call", scheme: "tel" },
						] as const
					).map(
						({ field, icon, label, scheme }) =>
							contact[field] && (
								<Button
									key={field}
									nativeButton={false}
									render={
										<a
											aria-label={t(label)}
											href={`${scheme}:${encodeURIComponent(contact[field])}`}
										/>
									}
									variant='outline'
								>
									<HugeiconsIcon aria-hidden className='scale-110' icon={icon} strokeWidth={1.75} />
									{t(label)}
								</Button>
							)
					)}
				</div>
			)}
		</DashboardDrawerHeader>
	);
};
