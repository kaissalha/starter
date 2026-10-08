"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";

import { cn } from "@starter/ui/lib/utils";

const Checkbox = ({ className, ...props }: CheckboxPrimitive.Root.Props) => {
	return (
		<CheckboxPrimitive.Root
			className={cn(
				"relative inline-flex size-4 shrink-0 items-center justify-center rounded-lg border border-input bg-background bg-clip-padding ring-ring transition-[box-shadow,border-color] outline-none before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(0.25rem-1px)] not-disabled:not-aria-invalid:not-data-checked:before:smooth-shadow-sm disabled:cursor-not-allowed disabled:opacity-64 aria-invalid:border-destructive/36 dark:bg-clip-border dark:shadow-black/24 dark:not-data-checked:bg-input/32 dark:not-disabled:not-data-checked:smooth-shadow-sm dark:aria-invalid:ring-destructive/24",
				className
			)}
			data-slot='checkbox'
			{...props}
		>
			<CheckboxPrimitive.Indicator
				className='absolute -inset-px flex items-center justify-center rounded-lg text-primary-foreground transition-[scale,opacity] duration-150 ease-[var(--ease-out-quint)] data-checked:bg-primary data-indeterminate:text-foreground data-unchecked:scale-50 data-unchecked:opacity-0'
				data-slot='checkbox-indicator'
				keepMounted
				render={(props, state) => (
					<span {...props}>
						{state.indeterminate ? (
							<svg
								className='size-3'
								fill='none'
								height='24'
								stroke='currentColor'
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth='3'
								viewBox='0 0 24 24'
								width='24'
								xmlns='http://www.w3.org/2000/svg'
							>
								<path d='M5.252 12h13.496' />
							</svg>
						) : (
							<svg
								className='size-3'
								fill='none'
								height='24'
								stroke='currentColor'
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth='3'
								viewBox='0 0 24 24'
								width='24'
								xmlns='http://www.w3.org/2000/svg'
							>
								<path d='M5.252 12.7 10.2 18.63 18.748 5.37' />
							</svg>
						)}
					</span>
				)}
			/>
		</CheckboxPrimitive.Root>
	);
};

export { Checkbox };
