"use client";

import { MessageQuestionIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { askUserQuestionsOutputSchema } from "./ask-user-questions-schema";
import { ToolError, ToolLoading } from "./tool-loading";
import type { ToolState } from "./tool-part-types";

export type AskUserQuestionsPartProps = {
	errorText?: string;
	output?: unknown;
	state: ToolState;
};

export const AskUserQuestionsPart = ({ output, state }: AskUserQuestionsPartProps) => {
	const t = useTranslations("components.chat.message.tool.askUserQuestions");

	if (state === "input-streaming" || state === "approval-requested" || state === "approval-responded") {
		return <ToolLoading message={t("title")} />;
	}

	if (state === "input-available") {
		return (
			<div className='flex items-center gap-2 py-1 text-muted-foreground text-sm'>
				<HugeiconsIcon
					aria-hidden='true'
					className='size-3.5 scale-110'
					icon={MessageQuestionIcon}
					strokeWidth={1.75}
				/>
				<span>{t("asking")}</span>
			</div>
		);
	}

	if (state === "output-error" || state === "output-denied") {
		return <ToolError />;
	}

	const parsedOutput = askUserQuestionsOutputSchema.safeParse(output);
	const { answers = [], dismissed } = parsedOutput.success ? parsedOutput.data : {};

	if (dismissed || answers.length === 0) {
		return (
			<div className='flex items-center gap-2 py-1 text-muted-foreground text-sm'>
				<HugeiconsIcon
					aria-hidden='true'
					className='size-3.5 scale-110'
					icon={MessageQuestionIcon}
					strokeWidth={1.75}
				/>
				<span>{t("dismissed")}</span>
			</div>
		);
	}

	return (
		<div className='flex w-full max-w-xl flex-col gap-2 rounded-2xl border border-border bg-card/50 px-4 py-3'>
			<div className='flex items-center gap-2 text-muted-foreground text-xs'>
				<HugeiconsIcon
					aria-hidden='true'
					className='size-3.5 scale-110'
					icon={MessageQuestionIcon}
					strokeWidth={1.75}
				/>
				<span>{t("title")}</span>
			</div>
			<dl className='flex flex-col gap-2'>
				{answers.map((answer) => {
					const selected = answer.selectedOptions?.filter(Boolean) ?? [];

					const answerText = answer.skipped
						? t("skipped")
						: [selected.join(", "), answer.otherText].filter(Boolean).join(" — ");

					return (
						<div className='flex flex-col gap-0.5' key={answer.questionId}>
							<dt className='text-muted-foreground text-xs'>{answer.question}</dt>
							<dd className='text-foreground text-sm'>{answerText || t("skipped")}</dd>
						</div>
					);
				})}
			</dl>
		</div>
	);
};

AskUserQuestionsPart.displayName = "AskUserQuestionsPart";
