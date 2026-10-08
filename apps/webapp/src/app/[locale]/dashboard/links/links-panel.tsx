"use client";

import { type ReactNode, useId } from "react";

import { ArrowRight01Icon, Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { EditorPanelFooter } from "@/app/[locale]/dashboard/components/editor/editor-panel-footer";
import { EditorPanelHeader } from "@/app/[locale]/dashboard/components/editor/editor-panel-header";
import { Button } from "@starter/ui/components/button";
import { Frame, FramePanel } from "@starter/ui/components/frame";
import { cn } from "@starter/ui/lib/utils";

export const LinksPanel = ({
	children,
	footer,
	onBack,
	title,
}: {
	children: ReactNode;
	footer?: ReactNode;
	onBack: () => void;
	title: string;
}) => {
	const t = useTranslations("links.editor");

	return (
		<div className='flex h-full min-h-0 w-full min-w-0 flex-col overflow-clip'>
			<EditorPanelHeader backLabel={t("back")} onBack={onBack} title={title} />
			<div className='@container min-h-0 flex-1 space-y-4 overflow-y-auto p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]'>
				{children}
			</div>
			{footer}
		</div>
	);
};

export const LinksDraftFooter = ({
	dirty,
	onCancel,
	onDone,
}: {
	dirty: boolean;
	onCancel: () => void;
	onDone: () => void;
}) => {
	const t = useTranslations("common");

	return (
		<EditorPanelFooter cancelLabel={t("cancel")} onCancel={onCancel}>
			<Button disabled={!dirty} onClick={onDone} type='button'>
				{t("done")}
			</Button>
		</EditorPanelFooter>
	);
};

export const LinksAddButton = ({
	disabled,
	label,
	onClick,
}: {
	disabled?: boolean;
	label: string;
	onClick: () => void;
}) => (
	<Button className='w-full' disabled={disabled} onClick={onClick} type='button' variant='outline'>
		<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Add01Icon} strokeWidth={1.75} />
		{label}
	</Button>
);

export const LinksFieldset = ({
	children,
	className,
	description,
	legend,
}: {
	children: ReactNode;
	className?: string;
	description?: string;
	legend?: string;
}) => {
	const id = useId();

	return (
		<Frame
			aria-describedby={description ? `${id}-description` : undefined}
			aria-labelledby={legend ? `${id}-legend` : undefined}
			className={cn("min-w-0", className)}
			role='group'
		>
			{legend && (
				<h3 className='flex min-h-10 items-center px-3 py-1.5 text-sm font-medium' id={`${id}-legend`}>
					{legend}
				</h3>
			)}
			<FramePanel>
				<div className='grid gap-4'>
					{description && (
						<p className='text-sm text-muted-foreground' id={`${id}-description`}>
							{description}
						</p>
					)}
					{children}
				</div>
			</FramePanel>
		</Frame>
	);
};

export const LinksPickerSection = ({ children, title }: { children: ReactNode; title: string }) => {
	const id = useId();

	return (
		<section aria-labelledby={id} className='grid min-w-0 gap-3'>
			<h3 className='px-1 text-sm font-medium' id={id}>
				{title}
			</h3>
			{children}
		</section>
	);
};

export const LinksChoiceList = <Value extends string>({
	onSelect,
	options,
}: {
	onSelect: (value: Value) => void;
	options: ReadonlyArray<{ description?: string; icon: ReactNode; label: string; value: Value }>;
}) => (
	<ul className='space-y-2'>
		{options.map((option) => (
			<li key={option.value}>
				<Button
					className='w-full'
					onClick={() => onSelect(option.value)}
					size='option'
					type='button'
					variant='outline'
				>
					<span className='inline-flex shrink-0 items-center'>{option.icon}</span>
					<span className='min-w-0 flex-1'>
						<span className='block text-sm font-medium'>{option.label}</span>
						{option.description && (
							<span className='mt-0.5 block text-xs font-normal text-muted-foreground'>
								{option.description}
							</span>
						)}
					</span>
					<HugeiconsIcon
						aria-hidden='true'
						className='shrink-0 scale-110'
						icon={ArrowRight01Icon}
						strokeWidth={1.75}
					/>
				</Button>
			</li>
		))}
	</ul>
);
