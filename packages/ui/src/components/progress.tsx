"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

import { cn } from "@starter/ui/lib/utils";

const Progress = ({ children, className, ...props }: ProgressPrimitive.Root.Props) => {
	return (
		<ProgressPrimitive.Root className={cn("flex w-full flex-col gap-2", className)} {...props}>
			{children ? (
				children
			) : (
				<ProgressTrack>
					<ProgressIndicator />
				</ProgressTrack>
			)}
		</ProgressPrimitive.Root>
	);
};

const ProgressTrack = ({ className, ...props }: ProgressPrimitive.Track.Props) => {
	return (
		<ProgressPrimitive.Track
			className={cn("block h-2 w-full overflow-hidden rounded-full bg-input", className)}
			data-slot='progress-track'
			{...props}
		/>
	);
};

const ProgressIndicator = ({ className, ...props }: ProgressPrimitive.Indicator.Props) => {
	return (
		<ProgressPrimitive.Indicator
			className={cn(
				"h-full w-(--progress-value) bg-primary transition-[width] duration-200 ease-[var(--ease-out-quint)]",
				className
			)}
			data-slot='progress-indicator'
			{...props}
		/>
	);
};

const ProgressLabel = ({ className, ...props }: ProgressPrimitive.Label.Props) => {
	return (
		<ProgressPrimitive.Label
			className={cn("text-sm font-medium", className)}
			data-slot='progress-label'
			{...props}
		/>
	);
};

const ProgressValue = ({ className, ...props }: ProgressPrimitive.Value.Props) => {
	return (
		<ProgressPrimitive.Value
			className={cn("text-sm tabular-nums", className)}
			data-slot='progress-value'
			{...props}
		/>
	);
};

export { Progress, ProgressTrack, ProgressIndicator, ProgressLabel, ProgressValue };
