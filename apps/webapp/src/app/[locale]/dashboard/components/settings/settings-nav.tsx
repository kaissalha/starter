"use client";

import { Logout05Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { useSettings } from "@/hooks/use-settings";
import { useSignOut } from "@/hooks/use-sign-out";
import { Button } from "@starter/ui/components/button";

import type { SettingsTabConfig } from "./settings-tabs";

type SettingsNavProps = {
	tabs: Array<SettingsTabConfig>;
};

export const SettingsNav = ({ tabs }: SettingsNavProps) => {
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
