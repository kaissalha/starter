"use client";

import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card";
import { cva } from "class-variance-authority";

import { cn } from "@starter/ui/lib/utils";

const previewCardTriggerVariants = cva("", {
	variants: {
		variant: {
			default: null,
			link: "not-typeset truncate rounded-xl bg-muted/50 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[popup-open]:bg-muted data-[popup-open]:text-foreground",
		},
	},
});

const PreviewCard = PreviewCardPrimitive.Root;

const PreviewCardTrigger = ({
	className,
	variant = "default",
	...props
}: PreviewCardPrimitive.Trigger.Props & { variant?: "default" | "link" }) => {
	return (
		<PreviewCardPrimitive.Trigger
			className={cn(previewCardTriggerVariants({ variant }), className)}
			data-slot='preview-card-trigger'
			{...props}
		/>
	);
};

const PreviewCardPopup = ({
	align = "center",
	children,
	className,
	collisionPadding = 5,
	side = "bottom",
	sideOffset = 4,
	...props
}: PreviewCardPrimitive.Popup.Props & {
	align?: PreviewCardPrimitive.Positioner.Props["align"];
	collisionPadding?: PreviewCardPrimitive.Positioner.Props["collisionPadding"];
	side?: PreviewCardPrimitive.Positioner.Props["side"];
	sideOffset?: PreviewCardPrimitive.Positioner.Props["sideOffset"];
}) => {
	return (
		<PreviewCardPrimitive.Portal>
			<PreviewCardPrimitive.Positioner
				align={align}
				className='z-70'
				collisionPadding={collisionPadding}
				data-slot='preview-card-positioner'
				side={side}
				sideOffset={sideOffset}
			>
				<PreviewCardPrimitive.Popup
					className={cn(
						"relative flex w-64 origin-(--transform-origin) text-balance rounded-lg bg-popover p-4 text-popover-foreground text-sm smooth-shadow-ring-lg transition-[scale,opacity] duration-150 ease-[var(--ease-out-quint)] data-ending-style:scale-98 data-starting-style:scale-98 data-ending-style:opacity-0 data-starting-style:opacity-0",
						className
					)}
					data-slot='preview-card-content'
					{...props}
				>
					{children}
				</PreviewCardPrimitive.Popup>
			</PreviewCardPrimitive.Positioner>
		</PreviewCardPrimitive.Portal>
	);
};

export {
	PreviewCard,
	PreviewCard as HoverCard,
	PreviewCardTrigger,
	PreviewCardTrigger as HoverCardTrigger,
	PreviewCardPopup,
	PreviewCardPopup as HoverCardContent,
};
