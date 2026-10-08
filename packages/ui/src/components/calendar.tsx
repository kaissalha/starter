"use client";

import type * as React from "react";

import { DayPicker } from "@daypicker/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { buttonVariants } from "@starter/ui/components/button";
import { cn } from "@starter/ui/lib/utils";

const IconLeft = ({ className }: React.ComponentPropsWithoutRef<"button">) => (
	<HugeiconsIcon
		aria-hidden='true'
		className={cn("scale-110", "size-4", className)}
		icon={ArrowLeft01Icon}
		strokeWidth={1.75}
	/>
);

const IconRight = ({ className }: React.ComponentPropsWithoutRef<"button">) => (
	<HugeiconsIcon
		aria-hidden='true'
		className={cn("scale-110", "size-4", className)}
		icon={ArrowRight01Icon}
		strokeWidth={1.75}
	/>
);

const Calendar = ({
	className,
	classNames,
	showOutsideDays = true,
	...props
}: React.ComponentProps<typeof DayPicker>) => {
	return (
		<DayPicker
			className={cn("p-3", className)}
			classNames={{
				button_next: cn(
					buttonVariants({ variant: "ghost" }),
					"size-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute end-1"
				),
				button_previous: cn(
					buttonVariants({ variant: "ghost" }),
					"size-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute start-1"
				),
				caption_label: "text-sm font-medium",
				day: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
				day_button: cn(buttonVariants({ variant: "ghost" }), "size-8 p-0 font-normal"),
				disabled: "text-muted-foreground opacity-50",
				hidden: "invisible",
				month: "flex flex-col gap-4",
				month_caption: "flex justify-center pt-1 relative items-center w-full",
				month_grid: "w-full border-collapse",
				months: "flex flex-col sm:flex-row gap-2",
				nav: "flex items-center gap-1",
				outside: "day-outside text-muted-foreground aria-selected:text-muted-foreground",
				range_end: "day-range-end rounded-e-md aria-selected:bg-primary aria-selected:text-primary-foreground",
				range_middle: "rounded-none aria-selected:bg-accent aria-selected:text-accent-foreground",
				range_start:
					"day-range-start rounded-s-md aria-selected:bg-primary aria-selected:text-primary-foreground",
				selected:
					"rounded-md bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
				today: "bg-accent text-accent-foreground",
				week: "flex w-full mt-2",
				weekday: "text-muted-foreground rounded-md w-8 font-normal text-xs",
				weekdays: "flex",
				...classNames,
			}}
			components={{
				NextMonthButton: IconRight,
				PreviousMonthButton: IconLeft,
			}}
			showOutsideDays={showOutsideDays}
			{...props}
		/>
	);
};

export { Calendar };
