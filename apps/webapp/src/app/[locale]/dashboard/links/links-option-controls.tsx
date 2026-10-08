"use client";

import type { ReactNode } from "react";

import { Delete02Icon, RotateLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Radio, RadioGroup } from "@starter/ui/components/radio-group";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@starter/ui/components/select";
import { Slider } from "@starter/ui/components/slider";
import { Switch } from "@starter/ui/components/switch";
import { ToggleGroup, ToggleGroupItem } from "@starter/ui/components/toggle-group";
import { cn } from "@starter/ui/lib/utils";

export const LinksFieldGroup = ({
	children,
	hideLabel = false,
	label,
}: {
	children: ReactNode;
	hideLabel?: boolean;
	label: string;
}) => (
	<div className='space-y-2'>
		{!hideLabel && <p className='text-sm font-medium'>{label}</p>}
		{children}
	</div>
);

const maxSegments = 4;

export const LinksSelect = <Value extends string>({
	hideLabel = false,
	label,
	onChange,
	options,
	value,
}: {
	hideLabel?: boolean;
	label: string;
	onChange: (value: Value) => void;
	options: ReadonlyArray<{ label: string; value: Value }>;
	value: Value;
}) => (
	<LinksFieldGroup hideLabel={hideLabel} label={label}>
		<Select
			onValueChange={(next) => {
				const option = options.find((candidate) => candidate.value === next);

				if (option) {
					onChange(option.value);
				}
			}}
			value={value}
		>
			<SelectTrigger aria-label={label} className='w-full' size='lg'>
				<SelectValue>
					{(current: Value) => options.find((option) => option.value === current)?.label}
				</SelectValue>
			</SelectTrigger>
			<SelectPopup>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectPopup>
		</Select>
	</LinksFieldGroup>
);

export const LinksSegmented = <Value extends string>({
	hideLabel = false,
	label,
	onChange,
	options,
	value,
}: {
	hideLabel?: boolean;
	label: string;
	onChange: (value: Value) => void;
	options: ReadonlyArray<{ label: string; value: Value }>;
	value: Value;
}) =>
	options.length > maxSegments ? (
		<LinksSelect hideLabel={hideLabel} label={label} onChange={onChange} options={options} value={value} />
	) : (
		<LinksFieldGroup hideLabel={hideLabel} label={label}>
			<ToggleGroup
				aria-label={label}
				className='w-full'
				onValueChange={([next]) => {
					const option = options.find((candidate) => candidate.value === next);

					if (option) {
						onChange(option.value);
					}
				}}
				size='lg'
				value={[value]}
				variant='outline'
			>
				{options.map((option) => (
					<ToggleGroupItem className='flex-1' key={option.value} value={option.value}>
						{option.label}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
		</LinksFieldGroup>
	);

export const LinksToggle = ({
	checked,
	label,
	onChange,
}: {
	checked: boolean;
	label: string;
	onChange: (checked: boolean) => void;
}) => (
	<label className='flex items-center justify-between gap-3 text-sm font-medium'>
		{label}
		<Switch checked={checked} onCheckedChange={onChange} />
	</label>
);

export const LinksTilePicker = <Value extends string>({
	columns = 2,
	label,
	onChange,
	options,
	previewClassName,
	value,
}: {
	columns?: 2 | 3 | 4;
	label: string;
	onChange: (value: Value) => void;
	options: ReadonlyArray<{ description?: string; label: string; preview: ReactNode; value: Value }>;
	previewClassName?: string;
	value: Value;
}) => (
	<RadioGroup
		aria-label={label}
		className={cn(
			"grid grid-cols-2",
			columns === 3 && "@min-[20rem]:grid-cols-3",
			columns === 4 && "@min-[24rem]:grid-cols-4"
		)}
		onValueChange={(next) => {
			const option = options.find((candidate) => candidate.value === next);

			if (option) {
				onChange(option.value);
			}
		}}
		value={value}
	>
		{options.map((option) => (
			<label className='group/tile flex min-w-0 cursor-pointer flex-col gap-1.5' key={option.value}>
				<span
					className={cn(
						"relative flex min-h-24 items-center justify-center overflow-hidden rounded-lg bg-muted/52 outline outline-border outline-offset-2 transition-[outline-color] group-focus-within/tile:outline-2 group-focus-within/tile:outline-ring group-has-data-checked/tile:outline-2 group-has-data-checked/tile:outline-foreground motion-reduce:transition-none",
						previewClassName
					)}
				>
					<Radio value={option.value} variant='card' />
					{option.preview}
				</span>
				<span className='truncate text-center text-xs font-medium text-muted-foreground group-has-data-checked/tile:text-foreground'>
					{option.label}
				</span>
				{option.description && (
					<span className='block text-center text-[11px]/4 text-muted-foreground'>{option.description}</span>
				)}
			</label>
		))}
	</RadioGroup>
);

export const LinksColorList = ({ children }: { children: ReactNode }) => <div className='divide-y'>{children}</div>;

export const LinksColorRow = ({
	fallback,
	label,
	onChange,
	onRemove,
	value,
}: {
	fallback?: string;
	label: string;
	onChange: (value: string | null) => void;
	onRemove?: () => void;
	value: string | null;
}) => {
	const t = useTranslations("links.design");
	const shown = value ?? fallback ?? "#000000";
	const auto = value === null && fallback !== undefined;
	const resettable = value !== null && fallback !== undefined;
	const action = onRemove ? t("removeColor") : t("reset");

	return (
		<div className='relative flex min-h-11 cursor-pointer items-center gap-3 py-1.5'>
			<span
				className={cn(
					"size-6 shrink-0 rounded-md outline outline-1 -outline-offset-1 outline-foreground/12",
					auto && "outline-dashed outline-foreground/32"
				)}
				style={{ backgroundColor: shown }}
			/>
			<span className='min-w-0 flex-1 truncate text-sm font-medium'>{label}</span>
			<span className='font-mono text-xs text-muted-foreground uppercase' dir='ltr'>
				{auto ? t("auto") : shown}
			</span>
			<Input
				aria-label={label}
				onChange={(event) => onChange(event.currentTarget.value)}
				type='color'
				value={shown}
				variant='overlay'
			/>
			{(resettable || onRemove) && (
				<Button
					aria-label={action}
					className='relative z-10'
					onClick={(event) => {
						event.preventDefault();

						if (onRemove) {
							onRemove();
						} else {
							onChange(null);
						}
					}}
					size='icon-xs'
					title={action}
					type='button'
					variant='ghost'
				>
					<HugeiconsIcon
						aria-hidden='true'
						className='scale-110'
						icon={onRemove ? Delete02Icon : RotateLeft01Icon}
						strokeWidth={1.75}
					/>
				</Button>
			)}
		</div>
	);
};

export const LinksRatioSlider = ({
	label,
	onChange,
	scale = 100,
	unit = "%",
	value,
}: {
	label: string;
	onChange: (value: number) => void;
	scale?: number;
	unit?: string;
	value: number;
}) => (
	<div className='space-y-2'>
		<div className='flex items-center justify-between gap-3 text-sm'>
			<span className='font-medium'>{label}</span>
			<span className='text-muted-foreground tabular-nums'>
				{Math.round(value * scale)}
				{unit}
			</span>
		</div>
		<Slider
			aria-label={label}
			className='h-6'
			max={100}
			min={0}
			onValueChange={(next) => onChange(Number(next) / 100)}
			value={Math.round(value * 100)}
		/>
	</div>
);
