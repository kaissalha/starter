"use client";

import * as React from "react";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@starter/ui/lib/utils";

const Slider = ({
	"aria-label": ariaLabel,
	"aria-labelledby": ariaLabelledBy,
	children,
	className,
	defaultValue,
	max = 100,
	min = 0,
	value,
	...props
}: SliderPrimitive.Root.Props) => {
	const _values = React.useMemo(() => {
		if (value !== undefined) {
			return Array.isArray(value) ? value : [value];
		}

		if (defaultValue !== undefined) {
			return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
		}

		return [min];
	}, [value, defaultValue, min]);

	return (
		<SliderPrimitive.Root
			className='data-[orientation=horizontal]:w-full'
			defaultValue={defaultValue}
			max={max}
			min={min}
			thumbAlignment='edge'
			value={value}
			{...props}
		>
			{children}
			<SliderPrimitive.Control
				className={cn(
					"flex touch-pan-y select-none pointer-coarse:pointer-events-none data-disabled:opacity-64 data-disabled:pointer-events-none data-[orientation=horizontal]:w-full data-[orientation=horizontal]:min-w-44 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:flex-col",
					className
				)}
				data-slot='slider-control'
			>
				<SliderPrimitive.Track
					className='relative grow select-none before:absolute before:rounded-full before:bg-input data-[orientation=horizontal]:h-1 data-[orientation=horizontal]:w-full data-[orientation=horizontal]:before:inset-inline-0.5 data-[orientation=horizontal]:before:inset-y-0 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1 data-[orientation=vertical]:before:inset-inline-0 data-[orientation=vertical]:before:inset-y-0.5'
					data-slot='slider-track'
				>
					<SliderPrimitive.Indicator
						className='rounded-full bg-primary select-none data-[orientation=horizontal]:ms-0.5 data-[orientation=vertical]:mb-0.5'
						data-slot='slider-indicator'
					/>
					{Array.from({ length: _values.length }, (_, index) => (
						<SliderPrimitive.Thumb
							aria-label={ariaLabel}
							aria-labelledby={ariaLabelledBy}
							className='block size-4 shrink-0 touch-none rounded-full border border-input bg-background bg-clip-padding transition-shadow outline-none select-none pointer-coarse:pointer-events-auto pointer-coarse:after:absolute pointer-coarse:after:-inset-3.5 before:absolute before:inset-0 before:rounded-full before:smooth-shadow-sm data-dragging:ring-[3px] data-dragging:ring-ring/24 dark:border-background dark:bg-clip-border'
							data-slot='slider-thumb'
							index={index}
							key={index}
						/>
					))}
				</SliderPrimitive.Track>
			</SliderPrimitive.Control>
		</SliderPrimitive.Root>
	);
};

const SliderValue = ({ className, ...props }: SliderPrimitive.Value.Props) => {
	return (
		<SliderPrimitive.Value
			className={cn("flex justify-end text-sm", className)}
			data-slot='slider-value'
			{...props}
		/>
	);
};

export { Slider, SliderValue };
