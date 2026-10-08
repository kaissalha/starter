"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cva } from "class-variance-authority";

import { cn } from "@starter/ui/lib/utils";

const popoverItemVariants = cva(
	"outline-hidden relative flex w-full cursor-pointer select-none items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-foreground has-[>svg:first-child]:ps-2 has-[>svg:last-child]:pe-2 [&_svg:not([class*='size-'])]:size-5",
	{
		defaultVariants: { selected: false },
		variants: {
			disabled: { false: "", true: "pointer-events-none opacity-50" },
			selected: { false: "text-muted-foreground", true: "bg-accent text-foreground" },
		},
	}
);

const popoverPopupVariants = cva(
	"max-h-(--available-height) min-w-[min(20rem,calc(100vw-1rem))] overflow-y-auto text-popover-foreground",
	{
		variants: { padding: { default: "p-4", none: "p-0", sm: "p-2", xs: "p-1" }, stacked: { true: "space-y-4" } },
	}
);

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = (props: PopoverPrimitive.Trigger.Props) => {
	return <PopoverPrimitive.Trigger data-slot='popover-trigger' {...props} />;
};

const PopoverPopup = ({
	align = "center",
	anchor,
	children,
	className,
	padding = "default",
	positionerProps,
	side = "bottom",
	sideOffset = 4,
	stacked = false,
	...props
}: PopoverPrimitive.Popup.Props & {
	align?: PopoverPrimitive.Positioner.Props["align"];
	anchor?: PopoverPrimitive.Positioner.Props["anchor"];
	padding?: "none" | "xs" | "sm" | "default";
	positionerProps?: Omit<PopoverPrimitive.Positioner.Props, "children">;
	side?: PopoverPrimitive.Positioner.Props["side"];
	sideOffset?: PopoverPrimitive.Positioner.Props["sideOffset"];
	stacked?: boolean;
}) => {
	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Positioner
				align={align}
				anchor={anchor}
				{...positionerProps}
				className={cn("z-70", positionerProps?.className)}
				data-slot='popover-positioner'
				side={side}
				sideOffset={sideOffset}
			>
				<span className='relative flex origin-(--transform-origin) rounded-lg bg-popover smooth-shadow-ring-lg transition-[scale,opacity] duration-150 ease-[var(--ease-out-quint)] has-data-starting-style:scale-98 has-data-starting-style:opacity-0'>
					<PopoverPrimitive.Popup
						className={cn(popoverPopupVariants({ padding, stacked }), className)}
						data-slot='popover-content'
						{...props}
					>
						{children}
					</PopoverPrimitive.Popup>
				</span>
			</PopoverPrimitive.Positioner>
		</PopoverPrimitive.Portal>
	);
};

const PopoverClose = ({ ...props }: PopoverPrimitive.Close.Props) => {
	return <PopoverPrimitive.Close data-slot='popover-close' {...props} />;
};

const PopoverTitle = ({ className, ...props }: PopoverPrimitive.Title.Props) => {
	return (
		<PopoverPrimitive.Title
			className={cn("text-lg leading-none font-semibold", className)}
			data-slot='popover-title'
			{...props}
		/>
	);
};

const PopoverDescription = ({ className, ...props }: PopoverPrimitive.Description.Props) => {
	return (
		<PopoverPrimitive.Description
			className={cn("text-sm text-muted-foreground", className)}
			data-slot='popover-description'
			{...props}
		/>
	);
};

const PopoverItem = ({
	className,
	disabled,
	selected,
	...props
}: React.ComponentProps<"div"> & { disabled?: boolean; selected?: boolean }) => (
	<div className={cn(popoverItemVariants({ disabled, selected }), className)} {...props} />
);

export {
	Popover,
	PopoverTrigger,
	PopoverPopup,
	PopoverPopup as PopoverContent,
	PopoverTitle,
	PopoverItem,
	PopoverDescription,
	PopoverClose,
};
