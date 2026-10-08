"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cva } from "class-variance-authority";

import { cn } from "@starter/ui/lib/utils";

const dialogPopupVariants = cva("flex h-dvh flex-col items-center overflow-hidden", {
	variants: {
		fullScreen: {
			false: "pt-6 max-sm:before:flex-1 sm:overflow-y-auto sm:p-4 sm:before:basis-[20vh] sm:after:flex-1",
		},
	},
});

const dialogSurfaceVariants = cva(
	"row-start-2 grid w-full min-w-0 origin-top gap-4 bg-popover p-6 pt-3 text-popover-foreground transition-[scale,opacity,translate] duration-200 ease-[var(--ease-out-quint)] will-change-transform data-ending-style:opacity-0 data-starting-style:opacity-0 max-sm:overflow-y-auto max-sm:opacity-[calc(1-min(var(--nested-dialogs),1))] max-sm:data-ending-style:translate-y-4 max-sm:data-starting-style:translate-y-4 sm:max-w-lg sm:-translate-y-[calc(1.25rem*var(--nested-dialogs))] sm:scale-[calc(1-0.1*var(--nested-dialogs))] sm:rounded-2xl sm:smooth-shadow-ring-lg sm:data-ending-style:scale-98 sm:data-starting-style:scale-98 relative sm:data-nested:data-ending-style:translate-y-8 sm:data-nested:data-starting-style:translate-y-8",
	{
		compoundVariants: [
			{
				class: "h-full min-h-0 bg-background p-0 text-foreground sm:max-w-none sm:translate-y-0 sm:scale-100 sm:rounded-none sm:smooth-shadow-none",
				fullScreen: true,
			},
		],
		variants: {
			fullScreen: { false: null, true: null },
			padding: { default: null, none: "gap-0 p-0" },
			size: { default: null, lg: "sm:max-w-2xl", xl: "sm:max-w-3xl" },
			variant: { default: null, transparent: "bg-transparent smooth-shadow-none sm:smooth-shadow-none" },
		},
	}
);

const dialogHeaderVariants = cva("flex flex-col gap-1 text-center sm:text-start", {
	variants: { variant: { default: null, spacious: "gap-3 p-6 pe-14 sm:p-8 sm:pe-16" } },
});

const dialogTitleVariants = cva("font-heading text-xl leading-none", {
	variants: { size: { default: null, sm: "pe-2 font-semibold text-base text-foreground leading-6" } },
});

const Dialog = DialogPrimitive.Root;

const DialogTrigger = (props: DialogPrimitive.Trigger.Props) => {
	return <DialogPrimitive.Trigger data-slot='dialog-trigger' {...props} />;
};

const DialogPortal = (props: DialogPrimitive.Portal.Props) => {
	return <DialogPrimitive.Portal {...props} />;
};

const DialogClose = (props: DialogPrimitive.Close.Props) => {
	return <DialogPrimitive.Close data-slot='dialog-close' {...props} />;
};

const DialogBackdrop = ({ className, ...props }: DialogPrimitive.Backdrop.Props) => {
	return (
		<DialogPrimitive.Backdrop
			className={cn(
				"fixed inset-0 z-60 bg-foreground/32 backdrop-blur-sm dark:bg-black/56 transition-opacity duration-200 ease-[var(--ease-out-quint)] data-ending-style:opacity-0 data-starting-style:opacity-0",
				className
			)}
			data-slot='dialog-backdrop'
			{...props}
		/>
	);
};

const DialogPopup = ({
	children,
	className,
	closeLabel = "Close",
	fullScreen = false,
	padding = "default",
	showCloseButton = true,
	size = "default",
	variant = "default",
	...props
}: DialogPrimitive.Popup.Props & {
	closeLabel?: string;
	fullScreen?: boolean;
	padding?: "default" | "none";
	showCloseButton?: boolean;
	size?: "default" | "lg" | "xl";
	variant?: "default" | "transparent";
}) => {
	return (
		<DialogPortal>
			<DialogBackdrop />
			<div className='fixed inset-0 z-60'>
				<div className={cn(dialogPopupVariants({ fullScreen }))}>
					<DialogPrimitive.Popup
						className={cn(dialogSurfaceVariants({ fullScreen, padding, size, variant }), className)}
						data-slot='dialog-popup'
						{...props}
					>
						{children}
						{showCloseButton && (
							<DialogPrimitive.Close className="absolute inset-e-2 top-2 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent opacity-72 transition-[color,background-color,box-shadow,opacity] outline-none hover:opacity-100 pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
								<HugeiconsIcon
									aria-hidden='true'
									className='scale-110'
									icon={Cancel01Icon}
									strokeWidth={1.75}
								/>
								<span className='sr-only'>{closeLabel}</span>
							</DialogPrimitive.Close>
						)}
					</DialogPrimitive.Popup>
				</div>
			</div>
		</DialogPortal>
	);
};

const DialogHeader = ({
	className,
	variant = "default",
	...props
}: React.ComponentProps<"div"> & { variant?: "default" | "spacious" }) => {
	return <div className={cn(dialogHeaderVariants({ variant }), className)} data-slot='dialog-header' {...props} />;
};

const DialogFooter = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			className={cn(
				"flex flex-col-reverse gap-2 sm:-mx-6 sm:mt-2 sm:-mb-6 sm:flex-row sm:justify-end sm:rounded-b-xl sm:border-t sm:px-6 sm:py-4",
				className
			)}
			data-slot='dialog-footer'
			{...props}
		/>
	);
};

const DialogTitle = ({
	className,
	size = "default",
	...props
}: DialogPrimitive.Title.Props & {
	size?: "default" | "sm";
}) => {
	return (
		<DialogPrimitive.Title
			className={cn(dialogTitleVariants({ size }), className)}
			data-slot='dialog-title'
			{...props}
		/>
	);
};

const DialogDescription = ({ className, ...props }: DialogPrimitive.Description.Props) => {
	return (
		<DialogPrimitive.Description
			className={cn("text-sm text-muted-foreground", className)}
			data-slot='dialog-description'
			{...props}
		/>
	);
};

export {
	Dialog,
	DialogTrigger,
	DialogPortal,
	DialogClose,
	DialogBackdrop,
	DialogBackdrop as DialogOverlay,
	DialogPopup,
	DialogPopup as DialogContent,
	DialogHeader,
	DialogFooter,
	DialogTitle,
	DialogDescription,
};
