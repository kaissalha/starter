"use client";

import {
	Notification03Icon,
	Tick02Icon,
	InformationCircleIcon,
	Loading03Icon,
	Alert02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Toaster as Sonner, toast } from "sonner";

import { buttonVariants } from "./button";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const toasterProps = {
	className: "toaster",
	icons: {
		error: (
			<HugeiconsIcon
				aria-hidden='true'
				className='size-5 text-destructive scale-110'
				icon={Alert02Icon}
				strokeWidth={1.75}
			/>
		),
		info: (
			<HugeiconsIcon
				aria-hidden='true'
				className='size-5 text-muted-foreground scale-110'
				icon={InformationCircleIcon}
				strokeWidth={1.75}
			/>
		),
		loading: (
			<HugeiconsIcon
				aria-hidden='true'
				className='size-5 animate-spin scale-110'
				icon={Loading03Icon}
				strokeWidth={1.75}
			/>
		),
		success: (
			<HugeiconsIcon
				aria-hidden='true'
				className='size-5 text-success-foreground scale-110'
				icon={Tick02Icon}
				strokeWidth={1.75}
			/>
		),
		warning: (
			<HugeiconsIcon
				aria-hidden='true'
				className='size-5 text-warning-foreground scale-110'
				icon={Notification03Icon}
				strokeWidth={1.75}
			/>
		),
	},
	toastOptions: {
		classNames: {
			actionButton: buttonVariants({ variant: "secondary" }),
			description: "",
			icon: "m-0! size-5!",
			loader: "",
			toast:
				"toast flex items-center w-full gap-3 text-sm font-medium bg-popover text-muted-foreground smooth-shadow-ring-md rounded-2xl p-4 " +
				"data-[type=success]:smooth-ring-success/20 data-[type=success]:text-success-foreground data-[type=warning]:smooth-ring-warning/20 data-[type=warning]:text-warning-foreground data-[type=error]:smooth-ring-destructive/20 data-[type=error]:text-destructive",
		},
		unstyled: true,
	},
} satisfies ToasterProps;

const Toaster = ({ ...props }: ToasterProps) => {
	return <Sonner {...toasterProps} {...props} />;
};

export { Toaster, toast, toasterProps };
