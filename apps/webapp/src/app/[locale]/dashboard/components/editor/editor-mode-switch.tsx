"use client";

import type { ComponentProps } from "react";

import { Edit03Icon, PlayIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Switch } from "@starter/ui/components/switch";

export const EditorModeSwitch = ({
	"aria-label": ariaLabel,
	...props
}: Omit<ComponentProps<typeof Switch>, "checkedIcon" | "uncheckedIcon" | "variant"> & { "aria-label": string }) => (
	<Switch
		{...props}
		aria-label={ariaLabel}
		checkedIcon={<HugeiconsIcon aria-hidden className='scale-110' icon={PlayIcon} strokeWidth={1.75} />}
		uncheckedIcon={<HugeiconsIcon aria-hidden className='scale-110' icon={Edit03Icon} strokeWidth={1.75} />}
		variant='icon'
	/>
);
