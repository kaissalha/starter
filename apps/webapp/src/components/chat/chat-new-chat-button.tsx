"use client";

import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { Button } from "@starter/ui/components/button";
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "@starter/ui/components/tooltip";

export const ChatNewChatButton = ({ onClick }: { onClick: () => void }) => {
	const { can } = useOrganizationPermissions();
	const t = useTranslations("chats");
	const label = t("newChat");

	if (!can("workspace.write")) {
		return null;
	}

	return (
		<TooltipProvider delay={0}>
			<Tooltip>
				<TooltipTrigger
					delay={0}
					render={<Button aria-label={label} onClick={onClick} size='icon' type='button' variant='ghost' />}
				>
					<HugeiconsIcon aria-hidden className='scale-110' icon={Add01Icon} strokeWidth={1.75} />
				</TooltipTrigger>
				<TooltipPopup>{label}</TooltipPopup>
			</Tooltip>
		</TooltipProvider>
	);
};
