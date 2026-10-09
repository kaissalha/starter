"use client";

import { useCallback } from "react";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { useChatSession } from "@/components/chat/stores/chat-session-store";
import { Button } from "@starter/ui/components/button";

import {
	AskUserQuestions,
	type AskUserAnswer,
	type AskUserQuestion,
	type PendingAskUserQuestions,
} from "./ask-user-questions";

type Answers = Record<string, AskUserAnswer>;

export const usePendingAskUserQuestions = (): PendingAskUserQuestions | undefined =>
	useChatSession((state) => {
		if (state.status !== "ready") {
			return undefined;
		}

		const lastMessage = state.messages.at(-1);

		if (!lastMessage || lastMessage.role !== "assistant") {
			return undefined;
		}

		for (const part of lastMessage.parts) {
			if (part.type !== "tool-askUserQuestions" || part.state !== "input-available") {
				continue;
			}

			const questions = part.input?.questions;

			if (!questions || questions.length === 0) {
				return undefined;
			}

			return { questions, toolCallId: part.toolCallId };
		}

		return undefined;
	});

const toToolOutput = ({
	answers,
	dismissed,
	questions,
}: {
	answers: Answers;
	dismissed: boolean;
	questions: Array<AskUserQuestion>;
}) => ({
	answers: questions.map((question) => {
		const answer = answers[question.id];

		const selectedOptions = (answer?.selectedIds ?? []).map(
			(optionId) => question.options?.find((option) => option.id === optionId)?.title ?? optionId
		);

		const trimmedOther = answer?.otherText?.trim();
		const skipped = dismissed || answer?.skipped === true;

		return {
			otherText: trimmedOther || undefined,
			question: question.title,
			questionId: question.id,
			selectedOptions,
			skipped: skipped || undefined,
		};
	}),
	dismissed: dismissed || undefined,
});

export const ChatAskUserQuestionsPanel = ({ questions, toolCallId }: PendingAskUserQuestions) => {
	const t = useTranslations("components.chat.chatInput.clarify");
	const answerQuestions = useChatSession((state) => state.actions?.answerQuestions);

	const submitOutput = useCallback(
		async (answers: Answers, dismissed: boolean) => {
			try {
				await answerQuestions?.({ output: toToolOutput({ answers, dismissed, questions }), toolCallId });
			} catch {}
		},
		[answerQuestions, questions, toolCallId]
	);

	return (
		<div className='relative'>
			<AskUserQuestions
				className='max-w-none rounded-3xl border-0 bg-card smooth-shadow-ring-md'
				onComplete={(answers) => submitOutput(answers, false)}
				questions={questions}
			/>
			<Button
				aria-label={t("dismiss")}
				className='absolute end-2.5 top-2.5 z-10'
				onClick={() => submitOutput({}, true)}
				size='icon-xs'
				title={t("dismiss")}
				variant='ghost'
			>
				<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Cancel01Icon} strokeWidth={1.75} />
			</Button>
		</div>
	);
};

ChatAskUserQuestionsPanel.displayName = "ChatAskUserQuestionsPanel";
