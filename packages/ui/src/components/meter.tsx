"use client";

import { Meter as MeterPrimitive } from "@base-ui/react/meter";

import { cn } from "@starter/ui/lib/utils";

const Meter = ({ children, className, ...props }: MeterPrimitive.Root.Props) => {
	return (
		<MeterPrimitive.Root className={cn("flex w-full flex-col gap-2", className)} {...props}>
			{children ? (
				children
			) : (
				<MeterTrack>
					<MeterIndicator />
				</MeterTrack>
			)}
		</MeterPrimitive.Root>
	);
};

const MeterLabel = ({ className, ...props }: MeterPrimitive.Label.Props) => {
	return <MeterPrimitive.Label className={cn("text-sm font-medium", className)} data-slot='meter-label' {...props} />;
};

const MeterTrack = ({ className, ...props }: MeterPrimitive.Track.Props) => {
	return (
		<MeterPrimitive.Track
			className={cn("block h-2 w-full overflow-hidden bg-input", className)}
			data-slot='meter-track'
			{...props}
		/>
	);
};

const MeterIndicator = ({ className, ...props }: MeterPrimitive.Indicator.Props) => {
	return (
		<MeterPrimitive.Indicator
			className={cn("bg-primary transition-[width] duration-200 ease-[var(--ease-out-quint)]", className)}
			data-slot='meter-indicator'
			{...props}
		/>
	);
};

const MeterValue = ({ className, ...props }: MeterPrimitive.Value.Props) => {
	return (
		<MeterPrimitive.Value className={cn("text-sm tabular-nums", className)} data-slot='meter-value' {...props} />
	);
};

export { Meter, MeterLabel, MeterTrack, MeterIndicator, MeterValue };
