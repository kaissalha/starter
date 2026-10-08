import type * as React from "react";

import { Tick02Icon, ArrowDown01Icon, ArrowRight01Icon, Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cva } from "class-variance-authority";

import { cn } from "@starter/ui/lib/utils";

const timelineHeaderVariants = cva("scale-110 size-4 text-muted-foreground transition-transform duration-200", {
	variants: { expanded: { false: "-rotate-90" } },
});

const timelineMarkerVariants = cva(
	"relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted",
	{
		variants: {
			resolvedStatus: {
				active: "border-2 border-dashed border-muted-foreground/40",
				completed: null,
				loading: "border-2 border-dashed border-muted-foreground/40",
				pending: null,
			},
		},
	}
);

const timelineBadgeVariants = cva(
	"inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 text-sm",
	{ variants: { variant: { default: null, mono: "font-mono text-xs" } } }
);

const Timeline = ({ className, ...props }: React.ComponentProps<"div">) => {
	return <div className={cn("relative w-full", className)} data-slot='timeline' {...props} />;
};

type TimelineHeaderProps = Omit<React.ComponentProps<"button">, "onClick"> & {
	expanded: boolean;
	name?: string;
	onToggle: () => void;
	query?: string;
	timestamp?: string;
};

const TimelineHeader = ({ className, expanded, name, onToggle, query, timestamp, ...props }: TimelineHeaderProps) => {
	return (
		<button
			aria-expanded={expanded}
			className={cn("flex w-full cursor-pointer items-center justify-between py-3 text-start", className)}
			data-slot='timeline-header'
			onClick={onToggle}
			type='button'
			{...props}
		>
			<span className='flex items-center gap-1.5 text-sm'>
				<HugeiconsIcon
					aria-hidden='true'
					className={cn(timelineHeaderVariants({ expanded }))}
					icon={ArrowDown01Icon}
					strokeWidth={1.75}
				/>
				{name && <span className='font-medium text-foreground'>{name}</span>}
				{name && query && <span className='text-muted-foreground'>asked</span>}
				{query && <span className='text-muted-foreground'>&ldquo;{query}&rdquo;</span>}
			</span>
			{timestamp && <time className='text-xs text-muted-foreground tabular-nums'>{timestamp}</time>}
		</button>
	);
};

type TimelineStatusProps = React.ComponentProps<"div"> & {
	loading?: boolean;
	remaining?: string;
	status?: string;
};

const TimelineStatus = ({ className, loading = false, remaining, status, ...props }: TimelineStatusProps) => {
	return (
		<div
			className={cn(
				"flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 mb-4",
				className
			)}
			data-slot='timeline-status'
			{...props}
		>
			<div className='flex items-center gap-2.5'>
				{loading && (
					<HugeiconsIcon
						aria-hidden='true'
						className='h-4 w-4 animate-spin text-muted-foreground scale-110'
						icon={Loading03Icon}
						strokeWidth={1.75}
					/>
				)}
				{status && <span className='text-sm font-medium'>{status}</span>}
			</div>
			{remaining && (
				<span className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>{remaining}</span>
			)}
		</div>
	);
};

const TimelineItems = ({ className, ...props }: React.ComponentProps<"ol">) => {
	return <ol className={cn("relative list-none space-y-0", className)} data-slot='timeline-items' {...props} />;
};

const TimelineItem = ({ className, ...props }: React.ComponentProps<"li">) => {
	return <li className={cn("relative flex gap-3.5 group/item", className)} data-slot='timeline-item' {...props} />;
};

type TimelineMarkerStatus = "pending" | "active" | "completed" | "loading";

type TimelineMarkerProps = React.ComponentProps<"div"> & {
	completed?: boolean;
	hasLine?: boolean;
	status?: TimelineMarkerStatus;
};

const TimelineMarker = ({ children, className, completed, hasLine = true, status, ...props }: TimelineMarkerProps) => {
	const resolvedStatus = status ?? (completed ? "completed" : "pending");

	return (
		<div
			className={cn("relative flex flex-col items-center self-stretch", className)}
			data-slot='timeline-marker'
			{...props}
		>
			<div className={cn(timelineMarkerVariants({ resolvedStatus }))}>
				{children ?? (
					<>
						{resolvedStatus === "completed" && (
							<HugeiconsIcon
								aria-hidden='true'
								className='h-3.5 w-3.5 text-foreground/70 scale-110'
								icon={Tick02Icon}
								strokeWidth={2.75}
							/>
						)}
						{(resolvedStatus === "active" || resolvedStatus === "loading") && (
							<div className='h-1.5 w-1.5 rounded-full bg-muted-foreground/50' />
						)}
						{resolvedStatus === "loading" && (
							<HugeiconsIcon
								aria-hidden='true'
								className='absolute h-4 w-4 animate-spin text-muted-foreground/60 scale-110'
								icon={Loading03Icon}
								strokeWidth={1.75}
							/>
						)}
					</>
				)}
			</div>
			{hasLine && <div className='flex-1 w-px bg-muted group-last/item:hidden' />}
		</div>
	);
};

const TimelineContent = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			className={cn("flex-1 flex flex-col gap-1 pb-10 pt-1", className)}
			data-slot='timeline-content'
			{...props}
		/>
	);
};

type TimelineTitleProps = Omit<React.ComponentProps<"h3">, "onClick"> & {
	label?: string;
	onClick?: () => void;
};

const TimelineTitle = ({ children, className, label, onClick, ...props }: TimelineTitleProps) => {
	return (
		<h3
			className={cn("flex flex-row items-center gap-2 font-medium text-base leading-normal", className)}
			data-slot='timeline-title'
			{...props}
		>
			{label && <span className='text-muted-foreground'>{label}</span>}
			{onClick ? (
				<button
					className='inline-flex cursor-pointer items-center gap-2 rounded-sm text-start underline-offset-4 hover:underline outline-none'
					onClick={onClick}
					type='button'
				>
					{children}
					<HugeiconsIcon
						aria-hidden='true'
						className='size-4 text-muted-foreground scale-110'
						icon={ArrowRight01Icon}
						strokeWidth={1.75}
					/>
				</button>
			) : (
				children
			)}
		</h3>
	);
};

type TimelineBadgeProps = React.ComponentProps<"span"> & {
	variant?: "default" | "mono";
};

const TimelineBadge = ({ className, variant = "default", ...props }: TimelineBadgeProps) => {
	return <span className={cn(timelineBadgeVariants({ variant }), className)} data-slot='timeline-badge' {...props} />;
};

const TimelineSubItems = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			className={cn("mt-3 space-y-0 rounded-lg border border-border bg-card p-1", className)}
			data-slot='timeline-sub-items'
			{...props}
		/>
	);
};

type TimelineSubItemStatus = "pending" | "completed" | "loading";

type TimelineSubItemProps = React.ComponentProps<"div"> & {
	status?: TimelineSubItemStatus;
};

const TimelineSubItem = ({ children, className, status = "pending", ...props }: TimelineSubItemProps) => {
	return (
		<div
			className={cn("flex items-start gap-2.5 rounded-md px-3 py-2", className)}
			data-slot='timeline-sub-item'
			{...props}
		>
			<div className='flex h-5 w-5 shrink-0 items-center justify-center'>
				{status === "completed" && (
					<div className='flex h-4 w-4 items-center justify-center rounded-full bg-muted'>
						<HugeiconsIcon
							aria-hidden='true'
							className='h-2.5 w-2.5 text-muted-foreground scale-110'
							icon={Tick02Icon}
							strokeWidth={3.25}
						/>
					</div>
				)}
				{status === "loading" && (
					<HugeiconsIcon
						aria-hidden='true'
						className='h-3.5 w-3.5 animate-spin text-muted-foreground scale-110'
						icon={Loading03Icon}
						strokeWidth={1.75}
					/>
				)}
				{status === "pending" && <div className='h-1.5 w-1.5 rounded-full bg-muted-foreground/40' />}
			</div>
			<div className='flex flex-1 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground'>
				{children}
			</div>
		</div>
	);
};

const TimelineDescription = ({ className, ...props }: React.ComponentProps<"p">) => {
	return (
		<p
			className={cn("text-sm text-muted-foreground leading-relaxed", className)}
			data-slot='timeline-description'
			{...props}
		/>
	);
};

const TimelineTime = ({ className, ...props }: React.ComponentProps<"time">) => {
	return (
		<time
			className={cn("text-sm text-muted-foreground tabular-nums", className)}
			data-slot='timeline-time'
			{...props}
		/>
	);
};

export {
	Timeline,
	TimelineHeader,
	TimelineStatus,
	TimelineItems,
	TimelineItem,
	TimelineMarker,
	TimelineContent,
	TimelineTitle,
	TimelineBadge,
	TimelineSubItems,
	TimelineSubItem,
	TimelineDescription,
	TimelineTime,
};
