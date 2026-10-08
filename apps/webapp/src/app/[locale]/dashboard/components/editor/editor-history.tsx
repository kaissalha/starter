"use client";

import { Redo02Icon, Undo02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { Button } from "@starter/ui/components/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@starter/ui/components/tooltip";

export const EditorHistory = ({
	canRedo,
	canUndo,
	onRedo,
	onUndo,
}: {
	canRedo: boolean;
	canUndo: boolean;
	onRedo: () => void;
	onUndo: () => void;
}) => {
	const t = useTranslations("editorShell.history");

	const actions = [
		{ enabled: canUndo, icon: Undo02Icon, key: "undo", onClick: onUndo },
		{ enabled: canRedo, icon: Redo02Icon, key: "redo", onClick: onRedo },
	] as const;

	return (
		<div className='flex items-center'>
			{actions.map(({ enabled, icon, key, onClick }) => (
				<Tooltip key={key}>
					<TooltipTrigger
						render={
							<Button
								aria-label={t(key)}
								disabled={!enabled}
								onClick={onClick}
								size='icon'
								variant='ghost'
							/>
						}
					>
						<HugeiconsIcon
							aria-hidden
							className='scale-110 rtl:-scale-x-110'
							icon={icon}
							strokeWidth={1.75}
						/>
					</TooltipTrigger>
					<TooltipPopup>{t(key)}</TooltipPopup>
				</Tooltip>
			))}
		</div>
	);
};
