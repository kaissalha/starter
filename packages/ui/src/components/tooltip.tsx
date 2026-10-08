"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "@starter/ui/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = (props: TooltipPrimitive.Trigger.Props) => {
	return <TooltipPrimitive.Trigger data-slot='tooltip-trigger' {...props} />;
};

const TooltipPopup = ({
	align = "center",
	children,
	className,
	side = "top",
	sideOffset = 4,
	...props
}: TooltipPrimitive.Popup.Props & {
	align?: TooltipPrimitive.Positioner.Props["align"];
	side?: TooltipPrimitive.Positioner.Props["side"];
	sideOffset?: TooltipPrimitive.Positioner.Props["sideOffset"];
}) => {
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Positioner
				align={align}
				className='z-70'
				data-slot='tooltip-positioner'
				side={side}
				sideOffset={sideOffset}
			>
				<TooltipPrimitive.Popup
					className={cn(
						"relative flex w-fit origin-(--transform-origin) rounded-md bg-popover px-2 py-1 text-sm text-wrap text-popover-foreground smooth-shadow-ring-md transition-[scale,opacity] duration-150 ease-[var(--ease-out-quint)] data-ending-style:scale-98 data-ending-style:opacity-0 data-instant:duration-0 data-starting-style:scale-98 data-starting-style:opacity-0 max-w-xs dark:bg-foreground dark:text-background dark:smooth-ring-foreground/20",
						className
					)}
					data-slot='tooltip-content'
					{...props}
				>
					{children}
				</TooltipPrimitive.Popup>
			</TooltipPrimitive.Positioner>
		</TooltipPrimitive.Portal>
	);
};

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipPopup, TooltipPopup as TooltipContent };
