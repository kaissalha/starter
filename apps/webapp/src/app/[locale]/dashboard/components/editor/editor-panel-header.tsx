"use client";

import { EditorBackButton } from "./editor-back-button";

export const EditorPanelHeader = ({
	backLabel,
	disabled,
	onBack,
	title,
}: {
	backLabel: string;
	disabled?: boolean;
	onBack: () => void;
	title?: string;
}) => (
	<div className='flex h-12 shrink-0 items-center gap-1.5 border-b px-2.5'>
		<EditorBackButton aria-label={backLabel} disabled={disabled} onClick={onBack} />
		{title && <h2 className='truncate text-sm font-semibold'>{title}</h2>}
	</div>
);
