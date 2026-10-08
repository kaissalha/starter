"use client";

import { ComputerIcon, SmartPhone01Icon, Tablet01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { ToggleGroup, ToggleGroupItem } from "@starter/ui/components/toggle-group";

const viewportIcons = { desktop: ComputerIcon, mobile: SmartPhone01Icon, tablet: Tablet01Icon } as const;

type EditorViewport = keyof typeof viewportIcons;

export const EditorViewportToggle = <Viewport extends EditorViewport>({
	disabled = false,
	onViewportChange,
	viewport,
	viewports,
}: {
	disabled?: boolean;
	onViewportChange: (viewport: Viewport) => void;
	viewport: Viewport;
	viewports: ReadonlyArray<Viewport>;
}) => {
	const t = useTranslations("website.viewports");
	const labels = { desktop: t("desktop"), mobile: t("mobile"), tablet: t("tablet") };

	return (
		<ToggleGroup
			aria-label={t("label")}
			disabled={disabled}
			onValueChange={([next]) => {
				const match = viewports.find((candidate) => candidate === next);

				if (match) {
					onViewportChange(match);
				}
			}}
			size='sm'
			value={[viewport]}
			variant='outline'
		>
			{viewports.map((item) => (
				<ToggleGroupItem aria-label={labels[item]} key={item} title={labels[item]} value={item}>
					<HugeiconsIcon
						aria-hidden='true'
						className='scale-110'
						icon={viewportIcons[item]}
						strokeWidth={1.75}
					/>
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
};
