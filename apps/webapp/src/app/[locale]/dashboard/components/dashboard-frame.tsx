"use client";

import type { ComponentProps, ReactNode } from "react";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

import { Link } from "@/i18n/navigation";
import { Button } from "@starter/ui/components/button";
import { EmptyMedia } from "@starter/ui/components/empty";
import {
	Frame,
	FrameDescription,
	FrameHeader,
	FrameHeading,
	FrameIcon,
	FramePanel,
	FrameTitle,
} from "@starter/ui/components/frame";
import { cn } from "@starter/ui/lib/utils";

export const ForwardIcon = (props: { "data-icon": "inline-end" }) => (
	<HugeiconsIcon {...props} aria-hidden className='scale-110' icon={ArrowRight01Icon} strokeWidth={1.75} />
);

export const DashboardFrame = ({
	children,
	className,
	label,
}: {
	children: ReactNode;
	className?: string;
	label: string;
}) => (
	<Frame aria-label={label} className={cn("min-w-0", className)} role='region'>
		{children}
	</Frame>
);

export const DashboardFrameHeader = ({
	action,
	badge,
	description,
	heading,
	icon,
	marker,
	title,
}: {
	action?: ReactNode;
	badge?: ReactNode;
	description?: ReactNode;
	heading?: ReactNode;
	icon?: IconSvgElement;
	marker?: ReactNode;
	title: string;
}) => (
	<FrameHeader className='min-h-10 justify-between' layout='row'>
		<FrameHeading>
			<div className='grid min-w-0 gap-0.5'>
				<div className='flex min-w-0 items-center gap-2'>
					{(icon || marker) && (
						<FrameIcon>
							{icon ? (
								<HugeiconsIcon
									aria-hidden
									className='size-4 scale-110'
									icon={icon}
									strokeWidth={1.75}
								/>
							) : (
								marker
							)}
						</FrameIcon>
					)}
					<FrameTitle>
						<h2 className={heading ? "sr-only" : "truncate"}>{title}</h2>
						{heading}
					</FrameTitle>
					{badge}
				</div>
				{description && <FrameDescription>{description}</FrameDescription>}
			</div>
		</FrameHeading>
		{action}
	</FrameHeader>
);

export const DashboardFrameAction = ({
	children,
	href,
	icon,
	onClick,
}: {
	children: ReactNode;
	href?: ComponentProps<typeof Link>["href"];
	icon?: IconSvgElement;
	onClick?: () => void;
}) => {
	const content = (
		<>
			{icon && (
				<HugeiconsIcon
					aria-hidden
					className='scale-110'
					data-icon='inline-start'
					icon={icon}
					strokeWidth={1.75}
				/>
			)}
			{children}
			<ForwardIcon data-icon='inline-end' />
		</>
	);

	if (href) {
		return (
			<Button
				className='-me-3 shrink-0'
				nativeButton={false}
				render={<Link href={href} prefetch={true} />}
				size='xs'
				variant='ghost'
			>
				{content}
			</Button>
		);
	}

	return (
		<Button className='-me-3 shrink-0' onClick={onClick} size='xs' variant='ghost'>
			{content}
		</Button>
	);
};

export const DashboardFramePanel = ({ children }: { children: ReactNode }) => (
	<FramePanel className='flex-1' padding='none'>
		<div className='flex h-full flex-col p-2'>{children}</div>
	</FramePanel>
);

export const DashboardFrameEmpty = ({
	children,
	className,
	icon,
}: {
	children: ReactNode;
	className?: string;
	icon?: IconSvgElement;
}) => (
	<div
		className={cn(
			"flex min-h-40 flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center text-sm font-medium",
			className
		)}
	>
		{icon && (
			<EmptyMedia className='mb-0' variant='icon'>
				<HugeiconsIcon aria-hidden className='scale-110 text-muted-foreground' icon={icon} strokeWidth={1.75} />
			</EmptyMedia>
		)}
		<div className='grid justify-items-center gap-3 text-balance'>{children}</div>
	</div>
);

export const DashboardFrameRow = ({
	href,
	leading,
	secondary,
	title,
	trailing,
}: {
	href: ComponentProps<typeof Link>["href"];
	leading?: ReactNode;
	secondary?: ReactNode;
	title: ReactNode;
	trailing?: ReactNode;
}) => (
	<li>
		<Link
			className='flex min-h-12 min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring'
			href={href}
			prefetch={true}
		>
			{leading}
			<span className='grid min-w-0 flex-1 gap-0.5'>
				<span className='truncate'>{title}</span>
				{secondary && <span className='truncate text-xs text-muted-foreground'>{secondary}</span>}
			</span>
			{trailing && <span className='shrink-0 text-xs text-muted-foreground'>{trailing}</span>}
		</Link>
	</li>
);
