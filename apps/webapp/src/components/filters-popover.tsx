"use client";

import type { ReactNode } from "react";

import { FilterMailIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@starter/ui/components/button";
import {
	Popover,
	PopoverDescription,
	PopoverPopup,
	PopoverTitle,
	PopoverTrigger,
} from "@starter/ui/components/popover";
import { Separator } from "@starter/ui/components/separator";

export const FiltersPopover = ({
	clearLabel,
	count,
	description,
	groups,
	label,
	onClear,
	title,
	triggerLabel,
}: {
	clearLabel: string;
	count: number;
	description?: string;
	groups: Array<{ content: ReactNode; id: string; label: string }>;
	label: string;
	onClear: () => void;
	title: string;
	triggerLabel: string;
}) => (
	<Popover>
		<PopoverTrigger
			render={<Button aria-label={triggerLabel} size='sm' variant={count > 0 ? "secondary" : "ghost"} />}
		>
			<HugeiconsIcon aria-hidden className='scale-110' icon={FilterMailIcon} strokeWidth={1.75} />
			<span className='hidden sm:inline'>{label}</span>
			{count > 0 && (
				<span aria-hidden className='min-w-4 text-center tabular-nums'>
					{count}
				</span>
			)}
		</PopoverTrigger>
		<PopoverPopup align='end' className='w-72' padding='sm' sideOffset={6}>
			<div className='flex items-start justify-between gap-3 px-2 pt-1 pb-2'>
				<div>
					<PopoverTitle>{title}</PopoverTitle>
					{description && <PopoverDescription className='mt-1'>{description}</PopoverDescription>}
				</div>
				{count > 0 && (
					<Button className='-me-1 -mt-1' onClick={onClear} size='xs' variant='ghost'>
						{clearLabel}
					</Button>
				)}
			</div>
			{groups.map((group, index) => (
				<div key={group.id}>
					{index > 0 && <Separator className='my-1' />}
					<fieldset className='py-1'>
						<legend className='px-2 py-1 text-xs font-medium text-muted-foreground'>{group.label}</legend>
						{group.content}
					</fieldset>
				</div>
			))}
		</PopoverPopup>
	</Popover>
);
