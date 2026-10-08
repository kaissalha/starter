"use client";

import type { ReactNode } from "react";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@starter/ui/components/button";
import {
	Drawer,
	DrawerClose,
	DrawerDescription,
	DrawerHeader,
	DrawerPopup,
	DrawerTitle,
} from "@starter/ui/components/drawer";
import { useIsMobile } from "@starter/ui/hooks/use-is-mobile";

export const DashboardDrawer = ({
	children,
	closeLabel,
	onOpenChange,
	open,
}: {
	children: ReactNode;
	closeLabel: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) => {
	const isMobile = useIsMobile();

	return (
		<Drawer onOpenChange={onOpenChange} open={open} position={isMobile ? "bottom" : "end"}>
			<DrawerPopup
				barVariant='muted'
				className={
					isMobile
						? "h-[90dvh] overflow-hidden [&_[data-slot=drawer-bar-wrap]]:shrink-0"
						: "overflow-hidden sm:max-w-[44.5rem]"
				}
				showBar={isMobile}
				variant={isMobile ? "default" : "inset"}
			>
				<DrawerClose
					render={
						<Button
							aria-label={closeLabel}
							className='absolute end-3 top-3 z-10 hidden md:inline-flex'
							size='icon'
							type='button'
							variant='ghost'
						/>
					}
				>
					<HugeiconsIcon aria-hidden className='scale-110' icon={Cancel01Icon} strokeWidth={1.75} />
				</DrawerClose>
				{children}
			</DrawerPopup>
		</Drawer>
	);
};

export const DashboardDrawerHeader = ({
	children,
	description,
	leading,
	title,
}: {
	children?: ReactNode;
	description?: ReactNode;
	leading?: ReactNode;
	title: ReactNode;
}) => (
	<DrawerHeader variant='profile'>
		<div className='flex min-w-0 flex-col items-center gap-3 md:flex-row md:gap-5'>
			{leading && (
				<span
					aria-hidden
					className='flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary md:size-12'
				>
					{leading}
				</span>
			)}
			<div className='flex min-w-0 max-w-full flex-col items-center gap-2 md:items-start'>
				<DrawerTitle className='max-w-full break-words text-center md:text-start' multiline size='lg'>
					{title}
				</DrawerTitle>
				{description && (
					<DrawerDescription className='text-center md:text-start'>{description}</DrawerDescription>
				)}
			</div>
		</div>
		{children}
	</DrawerHeader>
);
