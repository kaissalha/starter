"use client";

import type { ReactNode } from "react";

import { Button } from "@starter/ui/components/button";

export const EditorPanelFooter = ({
	cancelDisabled,
	cancelLabel,
	children,
	onCancel,
}: {
	cancelDisabled?: boolean;
	cancelLabel: string;
	children: ReactNode;
	onCancel: () => void;
}) => (
	<div className='flex shrink-0 flex-wrap items-center gap-2 border-t p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] *:min-w-0 *:flex-1'>
		<Button disabled={cancelDisabled} onClick={onCancel} type='button' variant='secondary'>
			{cancelLabel}
		</Button>
		{children}
	</div>
);
