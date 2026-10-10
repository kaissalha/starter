"use client";

import { Alert02Icon, MessageQuestionIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";
import { z } from "zod";

import { TextShimmer } from "@starter/ui/components/text-shimmer";

import { ChatActivityOrb } from "../chat-step-item";
import type { ToolState } from "./tool-part";

const askUserQuestionsOutputSchema = z.compile(
	z.object({
		answers: z
			.array(
				z.object({
					otherText: z.string().optional(),
					question: z.string(),
					questionId: z.string(),
					selectedOptions: z.array(z.string()).optional(),
					skipped: z.boolean().optional(),
				})
			)
			.optional(),
		dismissed: z.boolean().optional(),
	})
);

export const AskUserQuestionsPart = ({ output, state }: { output?: unknown; state: ToolState }) => {
	const t = useTranslations("components.chat.message.tool.askUserQuestions");
	const tTool = useTranslations("components.chat.message.tool");

	if (state === "input-streaming" || state === "approval-requested" || state === "approval-responded") {
		return (
			<div className='flex items-center gap-2.5 rounded-2xl border border-border/50 bg-muted/30 px-4 py-3'>
				<ChatActivityOrb state='composing' />
				<TextShimmer variant='muted'>{t("title")}</TextShimmer>
			</div>
		);
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
		return (
			<div className='flex items-center gap-3 rounded-2xl bg-destructive/10 px-4 py-3 text-destructive'>
				<HugeiconsIcon aria-hidden='true' className='size-4 scale-110' icon={Alert02Icon} strokeWidth={1.75} />
				<span className='text-sm'>{tTool("error")}</span>
			</div>
		);
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
