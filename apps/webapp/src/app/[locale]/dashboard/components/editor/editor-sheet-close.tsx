"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { Button } from "@starter/ui/components/button";
import { useSidebar } from "@starter/ui/components/sidebar";

export const EditorSheetClose = ({ onClose }: { onClose: () => void }) => {
	const t = useTranslations("common");
	const { setOpenMobile } = useSidebar("details");

	return (
		<Button
			aria-label={t("close")}
			className='shrink-0 md:hidden'
			onClick={() => {
				onClose();
				setOpenMobile(false);
			}}
			size='icon'
			type='button'
			variant='ghost'
		>
			<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Cancel01Icon} strokeWidth={1.75} />
		</Button>
	);
};
