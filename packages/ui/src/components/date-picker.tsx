"use client";

import { useState, type ComponentProps } from "react";

import type { DateRange } from "@daypicker/react";
import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { format } from "date-fns";

import { Button } from "@starter/ui/components/button";
import { Calendar } from "@starter/ui/components/calendar";
import { Popover, PopoverPopup, PopoverTrigger } from "@starter/ui/components/popover";
import { cn } from "@starter/ui/lib/utils";

type DatePickerProps = {
	className?: string;
	disabled?: boolean;
	formatStr?: string;
	onChange?: (date: Date | undefined) => void;
	placeholder?: string;
	value?: Date;
};

const DatePicker = ({
	className,
	disabled,
	formatStr = "PPP",
	onChange,
	placeholder = "Pick a date",
	value,
}: DatePickerProps) => {
	const [internalDate, setInternalDate] = useState<Date | undefined>();
	const date = value ?? internalDate;

	const handleSelect = (selected: Date | undefined) => {
		if (!value) {
			setInternalDate(selected);
		}

		onChange?.(selected);
	};

	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button
						className={cn("w-70 justify-start text-start", className)}
						disabled={disabled}
						variant='outline'
					/>
				}
			>
				<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Calendar03Icon} strokeWidth={1.75} />
				{date ? format(date, formatStr) : <span>{placeholder}</span>}
			</PopoverTrigger>
			<PopoverPopup align='start' className='w-auto p-0'>
				<Calendar mode='single' onSelect={handleSelect} selected={date} />
			</PopoverPopup>
		</Popover>
	);
};

type DateRangePickerProps = {
	calendarProps?: Pick<ComponentProps<typeof Calendar>, "disabled" | "startMonth" | "endMonth" | "locale" | "dir">;
	className?: string;
	disabled?: boolean;
	formatStr?: string;
	onChange?: (range: DateRange | undefined) => void;
	placeholder?: string;
	value?: DateRange;
};

const formatDateRangeLabel = ({
	formatStr,
	placeholder,
	range,
}: {
	formatStr: string;
	placeholder: string;
	range: DateRange | undefined;
}) => {
	if (!range?.from) {
		return <span>{placeholder}</span>;
	}

	if (range.to) {
		return (
			<>
				{format(range.from, formatStr)} &ndash; {format(range.to, formatStr)}
			</>
		);
	}

	return format(range.from, formatStr);
};

const DateRangePicker = ({
	calendarProps,
	className,
	disabled,
	formatStr = "LLL dd, y",
	onChange,
	placeholder = "Pick a date range",
	value,
}: DateRangePickerProps) => {
	const [internalRange, setInternalRange] = useState<DateRange | undefined>();
	const range = value ?? internalRange;

	const handleSelect = (selected: DateRange | undefined) => {
		if (!value) {
			setInternalRange(selected);
		}

		onChange?.(selected);
	};

	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button
						className={cn("w-75 justify-start text-start", className)}
						disabled={disabled}
						variant='outline'
					/>
				}
			>
				<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Calendar03Icon} strokeWidth={1.75} />
				{formatDateRangeLabel({ formatStr, placeholder, range })}
			</PopoverTrigger>
			<PopoverPopup align='start' className='w-auto p-0'>
				<Calendar {...calendarProps} mode='range' numberOfMonths={2} onSelect={handleSelect} selected={range} />
			</PopoverPopup>
		</Popover>
	);
};

export { DatePicker, DateRangePicker };

export type { DatePickerProps, DateRangePickerProps };
