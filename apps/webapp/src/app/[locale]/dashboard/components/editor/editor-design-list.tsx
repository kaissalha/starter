"use client";

import type { ReactNode } from "react";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@starter/ui/components/button";
import { Frame, FramePanel } from "@starter/ui/components/frame";

export const EditorDesignList = ({ children, title }: { children: ReactNode; title: string }) => (
	<section className='min-h-0 flex-1 overflow-y-auto p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]'>
		<h2 className='px-1 pt-1 pb-2 text-xs font-medium text-muted-foreground'>{title}</h2>
		<ul className='grid gap-4'>{children}</ul>
	</section>
);

export const EditorDesignRow = ({
	disabled,
	onClick,
	preview,
	title,
	value,
}: {
	disabled?: boolean;
	onClick: () => void;
	preview: ReactNode;
	title: string;
	value?: string;
}) => (
	<li className='relative'>
		<Button
			className='peer absolute inset-0 z-10 size-full sm:h-full'
			disabled={disabled}
			onClick={onClick}
			type='button'
			unstyled
		>
			<span className='sr-only'>{title}</span>
		</Button>
		<div
			aria-hidden='true'
			className='transition-opacity peer-disabled:opacity-50 [@media(hover:hover)]:peer-hover:opacity-80 motion-reduce:transition-none'
		>
			<Frame>
				<div className='flex min-h-11 items-center gap-2 px-3 py-1.5'>
					<span className='min-w-0 flex-1'>
						<span className='block truncate text-sm font-medium'>{title}</span>
						{value && <span className='block truncate text-xs text-muted-foreground'>{value}</span>}
					</span>
					<HugeiconsIcon
						className='size-4 shrink-0 text-muted-foreground scale-110'
						icon={ArrowRight01Icon}
						strokeWidth={1.75}
					/>
				</div>
				<FramePanel className='flex h-28 items-center justify-center overflow-hidden' padding='none'>
					{preview}
				</FramePanel>
			</Frame>
		</div>
	</li>
);
