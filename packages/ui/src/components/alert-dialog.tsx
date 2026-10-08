"use client";

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";

import { cn } from "@starter/ui/lib/utils";

const AlertDialog = (props: AlertDialogPrimitive.Root.Props) => {
	return <AlertDialogPrimitive.Root data-slot='alert-dialog' {...props} />;
};

const AlertDialogTrigger = (props: AlertDialogPrimitive.Trigger.Props) => {
	return <AlertDialogPrimitive.Trigger data-slot='alert-dialog-trigger' {...props} />;
};

const AlertDialogPortal = (props: AlertDialogPrimitive.Portal.Props) => {
	return <AlertDialogPrimitive.Portal {...props} />;
};

const AlertDialogBackdrop = ({ className, ...props }: AlertDialogPrimitive.Backdrop.Props) => {
	return (
		<AlertDialogPrimitive.Backdrop
			className={cn(
				"fixed inset-0 z-70 bg-foreground/32 backdrop-blur-sm dark:bg-black/56 transition-opacity duration-200 ease-[var(--ease-out-quint)] data-ending-style:opacity-0 data-starting-style:opacity-0",
				className
			)}
			data-slot='alert-dialog-backdrop'
			{...props}
		/>
	);
};

const AlertDialogPopup = ({ className, ...props }: AlertDialogPrimitive.Popup.Props) => {
	return (
		<AlertDialogPortal>
			<AlertDialogBackdrop />
			<div className='fixed inset-0 z-70'>
				<div className='flex h-dvh flex-col items-center overflow-hidden pt-6 max-sm:before:flex-1 sm:overflow-y-auto sm:p-4 sm:before:basis-[20vh] sm:after:flex-1'>
					<AlertDialogPrimitive.Popup
						className={cn(
							"row-start-2 grid w-full min-w-0 origin-top gap-4 bg-popover p-6 text-popover-foreground transition-[scale,opacity,translate] duration-200 ease-[var(--ease-out-quint)] will-change-transform data-ending-style:opacity-0 data-starting-style:opacity-0 max-sm:overflow-y-auto max-sm:opacity-[calc(1-min(var(--nested-dialogs),1))] max-sm:data-ending-style:translate-y-4 max-sm:data-starting-style:translate-y-4 sm:max-w-lg sm:-translate-y-[calc(1.25rem*var(--nested-dialogs))] sm:scale-[calc(1-0.1*var(--nested-dialogs))] sm:rounded-2xl sm:smooth-shadow-ring-lg sm:data-ending-style:scale-98 sm:data-starting-style:scale-98",
							"relative sm:data-nested:data-ending-style:translate-y-8 sm:data-nested:data-starting-style:translate-y-8",
							className
						)}
						data-slot='alert-dialog-popup'
						{...props}
					/>
				</div>
			</div>
		</AlertDialogPortal>
	);
};

const AlertDialogHeader = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			className={cn("flex flex-col gap-2 text-center sm:text-start", className)}
			data-slot='alert-dialog-header'
			{...props}
		/>
	);
};

const AlertDialogFooter = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
			data-slot='alert-dialog-footer'
			{...props}
		/>
	);
};

const AlertDialogTitle = ({ className, ...props }: AlertDialogPrimitive.Title.Props) => {
	return (
		<AlertDialogPrimitive.Title
			className={cn("text-lg font-semibold", className)}
			data-slot='alert-dialog-title'
			{...props}
		/>
	);
};

const AlertDialogDescription = ({ className, ...props }: AlertDialogPrimitive.Description.Props) => {
	return (
		<AlertDialogPrimitive.Description
			className={cn("text-sm text-muted-foreground", className)}
			data-slot='alert-dialog-description'
			{...props}
		/>
	);
};

const AlertDialogClose = (props: AlertDialogPrimitive.Close.Props) => {
	return <AlertDialogPrimitive.Close data-slot='alert-dialog-close' {...props} />;
};

export {
	AlertDialog,
	AlertDialogPortal,
	AlertDialogBackdrop,
	AlertDialogBackdrop as AlertDialogOverlay,
	AlertDialogTrigger,
	AlertDialogPopup,
	AlertDialogPopup as AlertDialogContent,
	AlertDialogHeader,
	AlertDialogFooter,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogClose,
};
