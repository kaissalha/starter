"use client";

import type { ReactNode } from "react";

import { cn } from "@starter/ui/lib/utils";

type SettingsCardProps = {
	action?: ReactNode;
	children?: ReactNode;
	className?: string;
	description?: string;
	footer?: ReactNode;
	footerHint?: string;
	title: string;
};

export const SettingsCard = ({
	action,
	children,
	className,
	description,
	footer,
	footerHint,
	title,
}: SettingsCardProps) => {
	const hasFooter = footer || footerHint;

	return (
		<div className={cn("rounded-lg border border-border bg-card", className)}>
			<div className='flex flex-col items-start justify-between gap-4 p-6 sm:flex-row'>
				<div className='flex flex-col gap-1'>
					<h3 className='font-semibold'>{title}</h3>
					{description && <p className='text-sm text-muted-foreground'>{description}</p>}
				</div>
				{action && <div className='shrink-0'>{action}</div>}
			</div>

			{children && <div className='px-6 pb-6'>{children}</div>}

			{hasFooter && (
				<div className='flex flex-wrap items-center justify-between gap-4 border-t border-border bg-muted/30 px-6 py-4'>
					{footerHint && <p className='text-xs text-muted-foreground'>{footerHint}</p>}
					{!footerHint && <div />}
					{footer}
				</div>
			)}
		</div>
	);
};
