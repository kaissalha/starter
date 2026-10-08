"use client";

import type { ReactNode } from "react";

import type { TooltipContentProps } from "recharts";

import { cn } from "@starter/ui/lib/utils";

import type { GenUISeries } from "./genui-chart-data";

export const ChartTooltipContent = ({ active, label, payload }: Partial<TooltipContentProps<number, string>>) => {
	if (!active || !payload?.length) {
		return null;
	}

	return (
		<div className='min-w-30 rounded-lg bg-popover/90 px-3 py-2 text-xs text-popover-foreground smooth-shadow-sm ring-1 ring-border backdrop-blur-md'>
			{label != null && <p className='mb-1.5 font-medium'>{String(label)}</p>}
			<ul className='flex flex-col gap-1'>
				{payload
					.filter((item) => item.type !== "none")
					.map((item) => (
						<li className='flex items-center gap-2' key={String(item.name)}>
							<span
								aria-hidden
								className='size-2 shrink-0 rounded-xs'
								style={{ backgroundColor: item.color }}
							/>
							<span className='text-muted-foreground'>{item.name}</span>
							<span className='ms-auto font-mono tabular-nums'>{String(item.value ?? "")}</span>
						</li>
					))}
			</ul>
		</div>
	);
};

export const ChartSurface = ({
	ariaLabel,
	children,
	className,
	height,
	labels,
	legend,
	presentation,
	series,
}: {
	ariaLabel?: string;
	children: ReactNode;
	className?: string;
	height: number;
	labels: Array<string>;
	legend: Array<{ color: string; name: string }>;
	presentation: "default" | "sparkline";
	series: Array<GenUISeries>;
}) => (
	<div
		aria-label={ariaLabel}
		className={cn("genui-chart-surface w-full min-w-0 text-muted-foreground", className)}
		role='group'
	>
		<ul
			className={
				presentation === "sparkline"
					? "sr-only"
					: "mb-2 flex flex-wrap justify-end gap-x-3 gap-y-1 text-[11px] tracking-wide"
			}
		>
			{legend.map((item) => (
				<li className='flex items-center gap-1.5' key={item.name}>
					<span
						aria-hidden
						className='size-2 shrink-0 rounded-xs ring-1 ring-border'
						style={{ backgroundColor: item.color }}
					/>
					{item.name}
				</li>
			))}
		</ul>
		<div className='relative min-w-0' style={{ height }}>
			{children}
		</div>
		<div className='sr-only'>
			<table aria-label={ariaLabel}>
				<thead>
					<tr>
						<td />
						{series.map(({ name }) => (
							<th key={name} scope='col'>
								{name}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{labels.map((label, index) => (
						<tr key={label}>
							<th scope='row'>{label}</th>
							{series.map((entry) => (
								<td key={entry.name}>{String(entry.values[index])}</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	</div>
);
