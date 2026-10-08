"use client";

import * as React from "react";

import { MinusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { OTPInput, OTPInputContext } from "input-otp";

import { cn } from "../lib/utils";

const InputOTP = ({
	className,
	containerClassName,
	...props
}: React.ComponentProps<typeof OTPInput> & {
	containerClassName?: string;
}) => {
	return (
		<OTPInput
			className={cn("disabled:cursor-not-allowed", className)}
			containerClassName={cn("has-disabled:opacity-50 flex items-center gap-2", containerClassName)}
			data-slot='input-otp'
			{...props}
		/>
	);
};

const InputOTPGroup = ({ className, ...props }: React.ComponentProps<"div">) => {
	return <div className={cn("flex items-center", className)} data-slot='input-otp-group' {...props} />;
};

const InputOTPSlot = ({
	className,
	index,
	...props
}: React.ComponentProps<"div"> & {
	index: number;
}) => {
	const inputOTPContext = React.useContext(OTPInputContext);
	const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {};

	return (
		<div
			className={cn(
				"data-[active=true]:aria-invalid:ring-destructive/20 dark:data-[active=true]:aria-invalid:ring-destructive/40 aria-invalid:border-destructive data-[active=true]:aria-invalid:border-destructive smooth-shadow-xs border-input data-[active=true]:border-ring data-[active=true]:ring-ring/50 outline-hidden relative flex h-9 w-9 items-center justify-center border-y border-e text-sm transition-[color,background-color,border-color,box-shadow] first:rounded-s-md first:border-s last:rounded-e-md data-[active=true]:z-10 data-[active=true]:ring-[3px]",
				className
			)}
			data-active={isActive}
			data-slot='input-otp-slot'
			{...props}
		>
			{char}
			{hasFakeCaret && (
				<div className='pointer-events-none absolute inset-0 flex items-center justify-center'>
					<div className='animate-caret-blink bg-foreground h-4 w-px duration-1000' />
				</div>
			)}
		</div>
	);
};

const InputOTPSeparator = ({ ...props }: React.ComponentProps<"div">) => {
	return (
		<div data-slot='input-otp-separator' role='separator' {...props}>
			<HugeiconsIcon aria-hidden='true' className='scale-110' icon={MinusSignIcon} strokeWidth={1.75} />
		</div>
	);
};

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
