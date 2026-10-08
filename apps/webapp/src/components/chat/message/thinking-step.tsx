"use client";

import { Brain01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { TextShimmer } from "@starter/ui/components/text-shimmer";

import { ChatStepItem } from "./chat-step-item";
import { ChatSteps } from "./chat-steps";

const thinkingIcon = (
	<HugeiconsIcon aria-hidden='true' className='size-3.5 scale-110' icon={Brain01Icon} strokeWidth={1.75} />
);

export const ThinkingStep = ({ isLast = true }: { isLast?: boolean }) => {
	const t = useTranslations("components.chat.message");

	return (
		<ChatStepItem
			activity='composing'
			icon={thinkingIcon}
			isLast={isLast}
			label={<TextShimmer variant='label'>{t("status.thinking")}</TextShimmer>}
			status='running'
		/>
	);
};

ThinkingStep.displayName = "ThinkingStep";

export const ThinkingSteps = () => (
	<ChatSteps>
		<ThinkingStep />
	</ChatSteps>
);

ThinkingSteps.displayName = "ThinkingSteps";
