"use client";

import type { ReactNode } from "react";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cva } from "class-variance-authority";

import { cn } from "@starter/ui/lib/utils";

const switchVariants = cva(
	"group/switch inline-flex h-4.5 w-7.5 shrink-0 cursor-pointer items-center rounded-full p-px inset-shadow-[0_1px_--theme(--color-black/4%)] transition-[background-color,box-shadow] duration-150 ease-[var(--ease-out-quint)] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-64 data-checked:bg-primary data-unchecked:bg-input",
	{
		variants: {
			variant: {
				default:
					"relative pointer-coarse:after:absolute pointer-coarse:after:-inset-x-2 pointer-coarse:after:-inset-y-3.5",
				icon: "h-9 w-16 p-1 sm:h-8 sm:w-14",
			},
		},
	}
);

const switchThumbVariants = cva(
	"pointer-events-none block size-4 rounded-full bg-background smooth-shadow-sm transition-[translate,width] duration-150 ease-[var(--ease-out-quint)] group-active/switch:w-4.5 data-checked:translate-x-3 data-checked:group-active/switch:translate-x-2.5 data-unchecked:translate-x-0 rtl:data-checked:-translate-x-3 rtl:data-checked:group-active/switch:-translate-x-2.5 motion-reduce:transition-none",
	{
		variants: {
			variant: {
				default: null,
				icon: "relative flex size-7 items-center justify-center text-foreground group-active/switch:w-7 data-checked:translate-x-7 data-checked:group-active/switch:translate-x-7 rtl:data-checked:-translate-x-7 rtl:data-checked:group-active/switch:-translate-x-7 sm:size-6 sm:group-active/switch:w-6 sm:data-checked:translate-x-6 sm:data-checked:group-active/switch:translate-x-6 sm:rtl:data-checked:-translate-x-6 sm:rtl:data-checked:group-active/switch:-translate-x-6",
			},
		},
	}
);

const Switch = ({
	checkedIcon,
	className,
	uncheckedIcon,
	variant = "default",
	...props
}: SwitchPrimitive.Root.Props & {
	checkedIcon?: ReactNode;
	uncheckedIcon?: ReactNode;
	variant?: "default" | "icon";
}) => {
	return (
		<SwitchPrimitive.Root className={cn(switchVariants({ variant }), className)} data-slot='switch' {...props}>
			<SwitchPrimitive.Thumb className={cn(switchThumbVariants({ variant }))} data-slot='switch-thumb'>
				{variant === "icon" && (
					<>
						<span
							aria-hidden='true'
							className='absolute flex items-center justify-center transition-[opacity,scale,rotate] duration-150 group-data-checked/switch:scale-50 group-data-checked/switch:-rotate-45 group-data-checked/switch:opacity-0 motion-reduce:transition-none [&_svg]:size-4'
						>
							{uncheckedIcon}
						</span>
						<span
							aria-hidden='true'
							className='absolute flex scale-50 rotate-45 items-center justify-center opacity-0 transition-[opacity,scale,rotate] duration-150 group-data-checked/switch:scale-100 group-data-checked/switch:rotate-0 group-data-checked/switch:opacity-100 motion-reduce:transition-none [&_svg]:size-4'
						>
							{checkedIcon}
						</span>
					</>
				)}
			</SwitchPrimitive.Thumb>
		</SwitchPrimitive.Root>
	);
};

export { Switch };
