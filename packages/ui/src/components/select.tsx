"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { ArrowDown01Icon, UnfoldMoreIcon, ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cva } from "class-variance-authority";

import { cn } from "@starter/ui/lib/utils";

const selectTriggerVariants = cva(
	"relative inline-flex w-full min-w-36 items-center justify-between gap-2 rounded-lg border bg-clip-padding text-base ring-ring/24 transition-[color,background-color,box-shadow,border-color] outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 in-data-[slot=field]:not-data-filled:text-muted-foreground aria-invalid:border-destructive/36 data-disabled:pointer-events-none data-disabled:opacity-64 sm:text-sm dark:bg-clip-border dark:aria-invalid:ring-destructive/24 pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		compoundVariants: [
			{
				class: "size-9 min-w-0 justify-center px-0 sm:h-8 sm:w-auto sm:min-w-28 sm:justify-between sm:px-2 max-sm:[&_[data-slot=select-icon]]:hidden",
				iconOnMobile: true,
			},
		],
		variants: {
			iconOnMobile: { true: null },
			size: {
				default: "h-9 px-[calc(--spacing(3)-1px)] sm:h-8",
				lg: "h-10 px-[calc(--spacing(3.5)-1px)] sm:h-9",
				sm: "h-8 gap-1.5 px-[calc(--spacing(2.5)-1px)] sm:h-7",
			},
			variant: {
				default: "border-input bg-background dark:bg-input/32",
				subtle: "w-auto min-w-0 border-transparent bg-muted/56 hover:bg-muted/72",
			},
		},
	}
);

const Select = SelectPrimitive.Root;

const SelectTrigger = ({
	children,
	className,
	iconOnMobile = false,
	size = "default",
	variant = "default",
	...props
}: SelectPrimitive.Trigger.Props & {
	iconOnMobile?: boolean;
	size?: "sm" | "default" | "lg";
	variant?: "default" | "subtle";
}) => {
	return (
		<SelectPrimitive.Trigger
			className={cn(selectTriggerVariants({ iconOnMobile, size, variant }), className)}
			data-slot='select-trigger'
			{...props}
		>
			{children}
			<SelectPrimitive.Icon data-slot='select-icon'>
				<HugeiconsIcon
					aria-hidden='true'
					className='-me-1 size-4 opacity-72 scale-110'
					icon={UnfoldMoreIcon}
					strokeWidth={1.75}
				/>
			</SelectPrimitive.Icon>
		</SelectPrimitive.Trigger>
	);
};

const SelectValue = ({ className, ...props }: SelectPrimitive.Value.Props) => {
	return <SelectPrimitive.Value className={cn("truncate", className)} data-slot='select-value' {...props} />;
};

const SelectPopup = ({
	align = "start",
	alignItemWithTrigger = false,
	children,
	className,
	positionerClassName,
	sideOffset = 4,
	...props
}: SelectPrimitive.Popup.Props & {
	align?: SelectPrimitive.Positioner.Props["align"];
	alignItemWithTrigger?: SelectPrimitive.Positioner.Props["alignItemWithTrigger"];
	positionerClassName?: string;
	sideOffset?: SelectPrimitive.Positioner.Props["sideOffset"];
}) => {
	return (
		<SelectPrimitive.Portal>
			<SelectPrimitive.Positioner
				align={align}
				alignItemWithTrigger={alignItemWithTrigger}
				className={cn("z-70 select-none", positionerClassName)}
				data-slot='select-positioner'
				sideOffset={sideOffset}
			>
				<SelectPrimitive.Popup
					className='origin-(--transform-origin) transition-[scale,opacity] duration-150 ease-[var(--ease-out-quint)] has-data-starting-style:scale-98 has-data-starting-style:opacity-0 has-data-[side=none]:scale-100 has-data-[side=none]:transition-none'
					data-slot='select-popup'
					{...props}
				>
					<SelectPrimitive.ScrollUpArrow
						className='top-0 z-50 flex h-6 w-full cursor-default items-center justify-center before:pointer-events-none before:absolute before:inset-inline-px before:top-px before:h-[200%] before:rounded-t-[calc(var(--radius-lg)-1px)] before:bg-gradient-to-b before:from-popover before:from-50%'
						data-slot='select-scroll-up-arrow'
					>
						<HugeiconsIcon
							aria-hidden='true'
							className='relative size-4 scale-110'
							icon={ArrowUp01Icon}
							strokeWidth={1.75}
						/>
					</SelectPrimitive.ScrollUpArrow>
					<span className='relative block h-full rounded-lg bg-popover smooth-shadow-ring-lg'>
						<SelectPrimitive.List
							className={cn(
								"max-h-(--available-height) min-w-(--anchor-width) overflow-y-auto p-1",
								className
							)}
							data-slot='select-list'
						>
							{children}
						</SelectPrimitive.List>
					</span>
					<SelectPrimitive.ScrollDownArrow
						className='bottom-0 z-50 flex h-6 w-full cursor-default items-center justify-center before:pointer-events-none before:absolute before:inset-inline-px before:bottom-px before:h-[200%] before:rounded-b-[calc(var(--radius-lg)-1px)] before:bg-gradient-to-t before:from-popover before:from-50%'
						data-slot='select-scroll-down-arrow'
					>
						<HugeiconsIcon
							aria-hidden='true'
							className='relative size-4 scale-110'
							icon={ArrowDown01Icon}
							strokeWidth={1.75}
						/>
					</SelectPrimitive.ScrollDownArrow>
				</SelectPrimitive.Popup>
			</SelectPrimitive.Positioner>
		</SelectPrimitive.Portal>
	);
};

const SelectItem = ({ children, className, ...props }: SelectPrimitive.Item.Props) => {
	return (
		<SelectPrimitive.Item
			className={cn(
				"grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-sm py-1 ps-2 pe-4 text-base outline-none in-data-[side=none]:min-w-[calc(var(--anchor-width)+1.25rem)] data-disabled:pointer-events-none data-disabled:opacity-64 data-highlighted:bg-accent data-highlighted:text-accent-foreground sm:text-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className
			)}
			data-slot='select-item'
			{...props}
		>
			<SelectPrimitive.ItemIndicator className='col-start-1'>
				<svg
					fill='none'
					height='24'
					stroke='currentColor'
					strokeLinecap='round'
					strokeLinejoin='round'
					strokeWidth='2'
					viewBox='0 0 24 24'
					width='24'
					xmlns='http://www.w3.org/1500/svg'
				>
					<path d='M5.252 12.7 10.2 18.63 18.748 5.37' />
				</svg>
			</SelectPrimitive.ItemIndicator>
			<SelectPrimitive.ItemText className='col-start-2'>{children}</SelectPrimitive.ItemText>
		</SelectPrimitive.Item>
	);
};

const SelectSeparator = ({ className, ...props }: SelectPrimitive.Separator.Props) => {
	return (
		<SelectPrimitive.Separator
			className={cn("mx-2 my-1 h-px bg-border", className)}
			data-slot='select-separator'
			{...props}
		/>
	);
};

const SelectGroup = (props: SelectPrimitive.Group.Props) => {
	return <SelectPrimitive.Group data-slot='select-group' {...props} />;
};

const SelectGroupLabel = (props: SelectPrimitive.GroupLabel.Props) => {
	return (
		<SelectPrimitive.GroupLabel
			className='px-2 py-1.5 text-xs font-medium text-muted-foreground'
			data-slot='select-group-label'
			{...props}
		/>
	);
};

export {
	Select,
	SelectTrigger,
	SelectValue,
	SelectPopup,
	SelectPopup as SelectContent,
	SelectItem,
	SelectSeparator,
	SelectGroup,
	SelectGroupLabel,
};
