"use client";

import { Toast } from "@base-ui/react/toast";
import {
	AlertCircleIcon,
	CheckmarkCircle02Icon,
	InformationCircleIcon,
	Loading03Icon,
	Alert02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { buttonVariants } from "@starter/ui/components/button";
import { cn } from "@starter/ui/lib/utils";

const toastManager = Toast.createToastManager();

const TOAST_ICONS = {
	error: AlertCircleIcon,
	info: InformationCircleIcon,
	loading: Loading03Icon,
	success: CheckmarkCircle02Icon,
	warning: Alert02Icon,
} as const;

type ToastPosition = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";

type ToastSwipeDirection = "up" | "down" | "left" | "right";

const getToastSwipeDirection = ({
	isTop,
	position,
}: {
	isTop: boolean;
	position: ToastPosition;
}): Array<ToastSwipeDirection> => {
	const verticalDirection: ToastSwipeDirection = isTop ? "up" : "down";

	if (position.includes("center")) {
		return [verticalDirection] satisfies Array<ToastSwipeDirection>;
	}

	if (position.includes("left")) {
		return ["left", verticalDirection] satisfies Array<ToastSwipeDirection>;
	}

	return ["right", verticalDirection] satisfies Array<ToastSwipeDirection>;
};

type ToastProviderProps = {
	position?: ToastPosition;
} & Toast.Provider.Props;

const ToastProvider = ({ children, position = "bottom-right", ...props }: ToastProviderProps) => {
	return (
		<Toast.Provider toastManager={toastManager} {...props}>
			{children}
			<ToastList position={position} />
		</Toast.Provider>
	);
};

const ToastList = ({ position = "bottom-right" }: { position: ToastPosition }) => {
	const { toasts } = Toast.useToastManager();
	const isTop = position.startsWith("top");

	return (
		<Toast.Portal data-slot='toast-portal'>
			<Toast.Viewport
				className={cn(
					"fixed z-50 mx-auto flex w-[calc(100%-var(--toast-inset)*2)] max-w-90 [--toast-inset:--spacing(4)] sm:[--toast-inset:--spacing(8)]",

					"data-[position*=top]:top-(--toast-inset)",
					"data-[position*=bottom]:bottom-(--toast-inset)",

					"data-[position*=left]:start-(--toast-inset)",
					"data-[position*=right]:end-(--toast-inset)",
					"data-[position*=center]:start-1/2 data-[position*=center]:-translate-x-1/2 rtl:data-[position*=center]:translate-x-1/2"
				)}
				data-position={position}
				data-slot='toast-viewport'
			>
				{toasts.map((toast) => {
					const Icon = Object.entries(TOAST_ICONS).find(([type]) => type === toast.type)?.[1] ?? null;

					return (
						<Toast.Root
							className={cn(
								"absolute z-[calc(9999-var(--toast-index))] h-(--toast-calc-height) w-full rounded-lg bg-popover p-4 text-popover-foreground smooth-shadow-ring-lg select-none [transition:transform_.25s_var(--ease-out-quint),opacity_.25s_var(--ease-out-quint),height_.15s]",

								"data-[position*=right]:end-0 data-[position*=right]:start-auto",
								"data-[position*=left]:end-auto data-[position*=left]:start-0",
								"data-[position*=center]:end-0 data-[position*=center]:start-0",
								"data-[position*=top]:top-0 data-[position*=top]:bottom-auto data-[position*=top]:origin-top",
								"data-[position*=bottom]:top-auto data-[position*=bottom]:bottom-0 data-[position*=bottom]:origin-bottom",

								"after:absolute after:start-0 after:h-[calc(var(--toast-gap)+1px)] after:w-full",
								"data-[position*=top]:after:top-full",
								"data-[position*=bottom]:after:bottom-full",

								"[--toast-calc-height:var(--toast-frontmost-height,var(--toast-height))] [--toast-gap:--spacing(3)] [--toast-peek:--spacing(3)] [--toast-scale:calc(max(0,1-(var(--toast-index)*.1)))] [--toast-shrink:calc(1-var(--toast-scale))]",

								"data-[position*=top]:[--toast-calc-offset-y:calc(var(--toast-offset-y)+var(--toast-index)*var(--toast-gap)+var(--toast-swipe-movement-y))]",
								"data-[position*=bottom]:[--toast-calc-offset-y:calc(var(--toast-offset-y)*-1+var(--toast-index)*var(--toast-gap)*-1+var(--toast-swipe-movement-y))]",

								"data-[position*=top]:transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)+(var(--toast-index)*var(--toast-peek))+(var(--toast-shrink)*var(--toast-calc-height))))_scale(var(--toast-scale))]",
								"data-[position*=bottom]:transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--toast-peek))-(var(--toast-shrink)*var(--toast-calc-height))))_scale(var(--toast-scale))]",

								"data-limited:opacity-0",

								"data-expanded:h-(--toast-height)",
								"data-position:data-expanded:transform-[translateX(var(--toast-swipe-movement-x))_translateY(var(--toast-calc-offset-y))]",

								"data-[position*=top]:data-starting-style:transform-[translateY(calc(-100%-var(--toast-inset)))]",
								"data-[position*=bottom]:data-starting-style:transform-[translateY(calc(100%+var(--toast-inset)))]",
								"data-ending-style:opacity-0",

								"data-ending-style:not-data-limited:not-data-swipe-direction:transform-[translateY(calc(100%+var(--toast-inset)))]",
								"data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-100%-var(--toast-inset)))_translateY(var(--toast-calc-offset-y))]",
								"data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+100%+var(--toast-inset)))_translateY(var(--toast-calc-offset-y))]",
								"data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-100%-var(--toast-inset)))]",
								"data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+100%+var(--toast-inset)))]",

								"data-expanded:data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-100%-var(--toast-inset)))_translateY(var(--toast-calc-offset-y))]",
								"data-expanded:data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+100%+var(--toast-inset)))_translateY(var(--toast-calc-offset-y))]",
								"data-expanded:data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-100%-var(--toast-inset)))]",
								"data-expanded:data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+100%+var(--toast-inset)))]"
							)}
							data-position={position}
							key={toast.id}
							swipeDirection={getToastSwipeDirection({ isTop, position })}
							toast={toast}
						>
							<Toast.Content className='flex items-center justify-between gap-1.5 overflow-hidden transition-opacity duration-250 data-behind:pointer-events-none data-behind:opacity-0 data-expanded:pointer-events-auto data-expanded:opacity-100'>
								<div className='flex gap-2'>
									{Icon && (
										<div
											className="mt-.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
											data-slot='toast-icon'
										>
											<HugeiconsIcon
												aria-hidden='true'
												className='in-data-[type=error]:text-destructive in-data-[type=info]:text-info in-data-[type=loading]:animate-spin in-data-[type=loading]:opacity-72 in-data-[type=success]:text-success in-data-[type=warning]:text-warning scale-110'
												icon={Icon}
												strokeWidth={1.75}
											/>
										</div>
									)}

									<div className='flex flex-col'>
										<Toast.Title className='text-sm font-medium' data-slot='toast-title' />
										<Toast.Description
											className='text-sm text-muted-foreground'
											data-slot='toast-description'
										/>
									</div>
								</div>
								{toast.actionProps && (
									<Toast.Action className={buttonVariants({ size: "xs" })} data-slot='toast-action'>
										{toast.actionProps.children}
									</Toast.Action>
								)}
							</Toast.Content>
						</Toast.Root>
					);
				})}
			</Toast.Viewport>
		</Toast.Portal>
	);
};

export { ToastProvider, type ToastPosition, toastManager };
