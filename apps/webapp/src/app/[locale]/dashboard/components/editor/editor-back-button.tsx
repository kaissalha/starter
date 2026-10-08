"use client";

import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button, type ButtonProps } from "@starter/ui/components/button";

export const EditorBackButton = ({
	"aria-label": ariaLabel,
	...props
}: Omit<ButtonProps, "children" | "size" | "variant"> & { "aria-label": string }) => (
	<Button aria-label={ariaLabel} size='icon-sm' type='button' variant='ghost' {...props}>
		<HugeiconsIcon aria-hidden className='scale-110' icon={ArrowLeft02Icon} strokeWidth={1.75} />
	</Button>
);
