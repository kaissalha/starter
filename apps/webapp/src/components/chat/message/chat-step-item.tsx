"use client";

import type { ReactNode } from "react";

import { ArrowDown01Icon, Brain01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";
import { ThinkingOrb, type OrbState } from "thinking-orbs";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@starter/ui/components/collapsible";
import { TextShimmer } from "@starter/ui/components/text-shimmer";
import { cn } from "@starter/ui/lib/utils";

export type ChatStepStatus = "running" | "done" | "error";

export const ChatActivityOrb = ({ state = "composing" }: { state?: OrbState }) => (
	<ThinkingOrb
		aria-hidden
		className='shrink-0'
		data-thinking-orb-state={state}
		role='presentation'
		size={20}
		state={state}
	/>
);

export const ChatSteps = ({ children }: { children: ReactNode }) => (
	<div className='my-1 flex flex-col'>{children}</div>
);

type ChatStepItemProps = {
	action?: ReactNode;
	activity?: OrbState;
	children?: ReactNode;
	defaultOpen?: boolean;
	icon: ReactNode;
	isLast?: boolean;
	label: ReactNode;
	onOpenChange?: (open: boolean) => void;
	open?: boolean;
	status: ChatStepStatus;
};

const StepIcon = ({ activity, icon, status }: { activity: OrbState; icon: ReactNode; status: ChatStepStatus }) => {
	return (
		<span
			className={cn(
				"flex size-5 shrink-0 items-center justify-center",
				status === "error" ? "text-destructive" : "text-muted-foreground"
			)}
		>
			{status === "running" ? <ChatActivityOrb state={activity} /> : icon}
		</span>
	);
};

export const ChatStepItem = ({
	action,
	activity = "composing",
	children,
	defaultOpen,
	icon,
	isLast = false,
	label,
	onOpenChange,
	open,
	status,
}: ChatStepItemProps) => {
	const hasContent = Boolean(children);

	const rail = (
		<div className='flex flex-col items-center self-stretch'>
			<div className='flex h-7 items-center'>
				<StepIcon activity={activity} icon={icon} status={status} />
			</div>
			{!isLast && <span aria-hidden className='w-px flex-1 bg-border' />}
		</div>
	);

	if (!hasContent) {
		return (
			<div className='flex gap-3'>
				{rail}
				<div className={cn("min-w-0 flex-1", !isLast && "pb-3")}>
					<div className='flex h-7 items-center gap-1'>
						<span className='min-w-0 flex-1 truncate text-sm text-muted-foreground'>{label}</span>
						{action}
					</div>
				</div>
			</div>
		);
	}

	return (
		<Collapsible defaultOpen={defaultOpen} onOpenChange={onOpenChange} open={open}>
			<div className='flex gap-3'>
				{rail}
				<div className={cn("min-w-0 flex-1", !isLast && "pb-3")}>
					<div className='flex h-7 items-center gap-1'>
						<CollapsibleTrigger className='group flex h-7 min-w-0 max-w-full items-center' variant='step'>
							<span className='min-w-0 truncate text-start'>{label}</span>
							<HugeiconsIcon
								aria-hidden='true'
								className='size-4 shrink-0 transition-transform duration-200 group-data-panel-open:rotate-180 scale-110'
								icon={ArrowDown01Icon}
								strokeWidth={1.75}
							/>
						</CollapsibleTrigger>
						{action}
					</div>
					<CollapsibleContent>{children}</CollapsibleContent>
				</div>
			</div>
		</Collapsible>
	);
};

ChatStepItem.displayName = "ChatStepItem";

const thinkingIcon = (
	<HugeiconsIcon aria-hidden='true' className='size-3.5 scale-110' icon={Brain01Icon} strokeWidth={1.75} />
);

export const ThinkingStep = () => {
	const t = useTranslations("components.chat.message");

	return (
		<ChatStepItem
			activity='composing'
			icon={thinkingIcon}
			isLast
			label={<TextShimmer variant='label'>{t("status.thinking")}</TextShimmer>}
			status='running'
		/>
	);
};

export const ThinkingSteps = () => (
	<ChatSteps>
		<ThinkingStep />
	</ChatSteps>
);
